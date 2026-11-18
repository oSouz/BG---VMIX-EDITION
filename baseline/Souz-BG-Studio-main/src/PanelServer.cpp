#include "PanelServer.h"
#include "PanelPage.h"
#include "PresetStore.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cctype>
#include <iomanip>
#include <locale>
#include <map>
#include <random>
#include <sstream>
#include <stdexcept>
#include <vector>
#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#include <iphlpapi.h>
#include <bcrypt.h>
#else
#include <arpa/inet.h>
#include <fcntl.h>
#include <ifaddrs.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#include <cerrno>
#endif

namespace souz {
namespace {
#ifdef _WIN32
using Socket = SOCKET;
constexpr Socket invalid = INVALID_SOCKET;
void closeSocket(Socket s) { closesocket(s); }
bool wouldBlock() { return WSAGetLastError() == WSAEWOULDBLOCK; }
void nonblock(Socket s) { u_long v=1; if(ioctlsocket(s,FIONBIO,&v)) throw std::runtime_error("nonblocking"); }
struct Network { Network(){ WSADATA d; if(WSAStartup(MAKEWORD(2,2),&d)) throw std::runtime_error("WSAStartup"); } ~Network(){WSACleanup();} };
#else
using Socket = int;
constexpr Socket invalid = -1;
void closeSocket(Socket s) { close(s); }
bool wouldBlock() { return errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR; }
void nonblock(Socket s) { if(fcntl(s,F_SETFL,O_NONBLOCK)<0) throw std::runtime_error("nonblocking"); }
struct Network {};
#endif
struct Handle {
    Socket s = invalid;
    explicit Handle(Socket socket = invalid):s(socket){}
    ~Handle(){ if(s!=invalid) closeSocket(s); }
    Handle(const Handle&)=delete;
    Handle& operator=(const Handle&)=delete;
};
std::string makeToken() {
    std::array<unsigned char,24> bytes{};
#ifdef _WIN32
    if(BCryptGenRandom(nullptr,bytes.data(),ULONG(bytes.size()),BCRYPT_USE_SYSTEM_PREFERRED_RNG)!=0)
        throw std::runtime_error("random token");
#else
    std::random_device random; for(auto& b:bytes) b=static_cast<unsigned char>(random());
#endif
    std::ostringstream s; for(auto b:bytes) s<<std::hex<<std::setw(2)<<std::setfill('0')<<unsigned(b);
    return s.str();
}
std::vector<std::string> addresses() {
    std::vector<std::string> result{"127.0.0.1"};
    auto add=[&](sockaddr* addr){
        if(!addr || addr->sa_family!=AF_INET) return;
        char buf[INET_ADDRSTRLEN]{};
        auto* ip=&reinterpret_cast<sockaddr_in*>(addr)->sin_addr;
        if(inet_ntop(AF_INET,ip,buf,sizeof buf) && std::string(buf)!="0.0.0.0" &&
           std::find(result.begin(),result.end(),buf)==result.end()) result.emplace_back(buf);
    };
#ifdef _WIN32
    ULONG size=15000; std::vector<unsigned char> buffer(size);
    ULONG error=ERROR_BUFFER_OVERFLOW;
    for(int i=0;i<3 && error==ERROR_BUFFER_OVERFLOW;++i){
        buffer.resize(size);
        error=GetAdaptersAddresses(AF_INET,GAA_FLAG_SKIP_ANYCAST|GAA_FLAG_SKIP_MULTICAST|GAA_FLAG_SKIP_DNS_SERVER,
            nullptr,reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data()),&size);
    }
    if(error==NO_ERROR) for(auto* a=reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data());a;a=a->Next)
        if(a->OperStatus==IfOperStatusUp) for(auto* u=a->FirstUnicastAddress;u;u=u->Next) add(u->Address.lpSockaddr);
#else
    ifaddrs* list=nullptr;
    if(getifaddrs(&list)==0){for(auto* a=list;a;a=a->ifa_next) add(a->ifa_addr);freeifaddrs(list);}
#endif
    return result;
}
std::string response(int code,const std::string& body,const char* type="application/json; charset=utf-8"){
    const char* reason=code==200?"OK":code==403?"Forbidden":code==404?"Not Found":code==204?"No Content":code==409?"Conflict":code==500?"Internal Server Error":"Bad Request";
    return "HTTP/1.1 "+std::to_string(code)+" "+reason+"\r\nContent-Type: "+type+
        "\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'\r\nContent-Length: "+std::to_string(body.size())+"\r\n\r\n"+body;
}
// Worker-owned preview relay. Never accessed by the render/host thread.
struct PreviewRelay {
    std::string publisher, jpeg;
    std::chrono::steady_clock::time_point updated{};
    bool Fresh() const { return !publisher.empty() && std::chrono::steady_clock::now()-updated<std::chrono::seconds(3); }
};
struct Pairing {
    std::string code;
    unsigned attempts=0;
    std::chrono::steady_clock::time_point expires{};
};
const std::string bad = "{\"error\":\"invalid request\"}";
// Empty result means more request bytes are needed. No chunked, pipelined,
// unbounded body, filesystem paths, CORS or arbitrary command execution.
std::string presetResponse(PresetStore::Result result,const std::vector<Preset>& list){
    switch(result){
    case PresetStore::Result::Ok: return response(200,PresetStore::ToJson(list));
    case PresetStore::Result::Full: return response(409,"{\"error\":\"preset list full\"}");
    case PresetStore::Result::NotFound: return response(404,"{\"error\":\"preset not found\"}");
    case PresetStore::Result::StorageError: return response(500,"{\"error\":\"preset storage unavailable\"}");
    default: return response(400,bad);
    }
}
std::string route(const std::string& request,const std::string& token,PanelState& state,unsigned short port,PreviewRelay& preview,Pairing& pairing,PresetStore& presets){
    auto end=request.find("\r\n\r\n");
    if(end==std::string::npos) return request.size()>8192?response(400,bad):"";
    if(end>8192) return response(400,bad);
    std::istringstream lines(request.substr(0,end)); std::string method,path,version,line;
    if(!std::getline(lines,line)) return response(400,bad);
    std::istringstream first(line); std::string extra;
    if(!(first>>method>>path>>version)||first>>extra||version!="HTTP/1.1") return response(400,bad);
    std::map<std::string,std::string> headers;
    while(std::getline(lines,line)){
        if(!line.empty()&&line.back()=='\r') line.pop_back();
        auto colon=line.find(':'); if(colon==std::string::npos) return response(400,bad);
        auto name=line.substr(0,colon),v=line.substr(colon+1);
        std::transform(name.begin(),name.end(),name.begin(),[](unsigned char c){return char(std::tolower(c));});
        auto begin=v.find_first_not_of(" \t"),last=v.find_last_not_of(" \t");
        v=begin==std::string::npos?"":v.substr(begin,last-begin+1);
        if(!headers.emplace(name,v).second) return response(400,bad);
    }
    if(!headers.count("host")||headers.count("transfer-encoding")) return response(400,bad);
    size_t length=0;
    if(headers.count("content-length")){
        auto s=headers["content-length"];
        if(s.empty()||s.size()>6||!std::all_of(s.begin(),s.end(),[](unsigned char c){return std::isdigit(c);}))return response(400,bad);
        length=std::stoul(s); if(length>(path=="/api/preview/frame"?262144u:2048u))return response(400,bad);
    }
    if(request.size()<end+4+length)return "";
    if(request.size()!=end+4+length)return response(400,bad);
    if(method=="GET"&&(path=="/"||path.rfind("/?",0)==0)&&length==0) return response(200,BuildPanelPage(),"text/html; charset=utf-8");
    if(headers.count("origin")&&headers["origin"]!="http://"+headers["host"])return response(403,bad);
    if(path=="/api/pair" && method=="POST") {
        auto supplied=request.substr(end+4,length);
        if(headers["content-type"]!="text/plain" || supplied.size()!=6 ||
           !std::all_of(supplied.begin(),supplied.end(),[](unsigned char c){return std::isdigit(c);}))return response(400,bad);
        if(pairing.code.empty() || pairing.attempts>=5 || std::chrono::steady_clock::now()>=pairing.expires)
            return response(403,"{\"error\":\"expired pairing code\"}");
        ++pairing.attempts;
        if(supplied!=pairing.code)return response(403,"{\"error\":\"invalid pairing code\"}");
        pairing.code.clear(); // one successful pairing per code
        return response(200,"{\"token\":\""+token+"\"}");
    }
    if(headers["x-souz-token"]!=token) return response(403,"{\"error\":\"unauthorized\"}");
    if(path=="/api/pair/start" && method=="POST" && length==0) {
        const auto random=makeToken();
        std::ostringstream code;code<<std::setw(6)<<std::setfill('0')<<(std::stoul(random.substr(0,8),nullptr,16)%1000000);
        pairing.code=code.str();pairing.attempts=0;pairing.expires=std::chrono::steady_clock::now()+std::chrono::minutes(5);
        return response(200,"{\"code\":\""+pairing.code+"\",\"expiresIn\":300}");
    }
    if(path=="/api/preview/start" && method=="POST" && length==0) {
        if(preview.Fresh()) return response(409,"{\"error\":\"preview already in use\"}");
        preview.publisher=makeToken();preview.jpeg.clear();preview.updated=std::chrono::steady_clock::now();
        return response(200,"{\"publisher\":\""+preview.publisher+"\"}");
    }
    if(path=="/api/preview/frame" && method=="POST") {
        if(preview.publisher.empty() || headers["x-souz-publisher"]!=preview.publisher) return response(409,bad);
        const auto jpeg=request.substr(end+4,length);
        if(headers["content-type"]!="image/jpeg" || jpeg.size()<4 ||
           static_cast<unsigned char>(jpeg[0])!=0xff || static_cast<unsigned char>(jpeg[1])!=0xd8 ||
           static_cast<unsigned char>(jpeg[jpeg.size()-2])!=0xff || static_cast<unsigned char>(jpeg.back())!=0xd9)
            return response(400,bad);
        preview.jpeg=jpeg;preview.updated=std::chrono::steady_clock::now();
        return response(200,"{}");
    }
    if(path=="/api/preview/stop" && method=="POST" && length==0) {
        if(preview.publisher.empty() || headers["x-souz-publisher"]!=preview.publisher) return response(409,bad);
        preview.publisher.clear();preview.jpeg.clear();return response(200,"{}");
    }
    if(path=="/api/preview" && method=="GET" && length==0) {
        if(!preview.Fresh()||preview.jpeg.empty())return response(204,"");
        return response(200,preview.jpeg,"image/jpeg");
    }
    // Saved backgrounds. Body: "Name <name>" and every parameter exactly once (like TAKE).
    if(path=="/api/presets" && method=="GET" && length==0) {
        std::vector<Preset> list;return presetResponse(presets.List(list),list);
    }
    if(path=="/api/presets" && method=="POST") {
        if(headers["content-type"]!="text/plain")return response(400,bad);
        std::istringstream input(request.substr(end+4,length));
        std::string name,row;bool haveName=false;std::array<float,ParamCount> values{};std::array<bool,ParamCount> seen{};
        while(std::getline(input,row)){
            if(row.rfind("Name ",0)==0){if(haveName)return response(400,bad);haveName=true;name=row.substr(5);continue;}
            std::istringstream pair(row);pair.imbue(std::locale::classic());
            std::string key;float v;
            if(!(pair>>key>>v))return response(400,bad);
            pair>>std::ws;if(!pair.eof())return response(400,bad);
            const auto index=PanelState::Find(key);
            if(index>=ParamCount||seen[index]||!PanelState::Valid(index,v))return response(400,bad);
            seen[index]=true;values[index]=v;
        }
        if(!haveName||!ValidPresetName(name)||!std::all_of(seen.begin(),seen.end(),[](bool b){return b;}))return response(400,bad);
        std::vector<Preset> list;return presetResponse(presets.Save(name,values,list),list);
    }
    if(path=="/api/presets/delete" && method=="POST") {
        const auto body=request.substr(end+4,length);
        if(headers["content-type"]!="text/plain"||body.size()<4||body.size()>12||body.rfind("Id ",0)!=0||
           !std::all_of(body.begin()+3,body.end(),[](unsigned char c){return std::isdigit(c);}))return response(400,bad);
        std::vector<Preset> list;return presetResponse(presets.Remove(static_cast<unsigned>(std::stoul(body.substr(3))),list),list);
    }
    if(method=="GET"&&path=="/api/info"){
        std::string body="{\"port\":"+std::to_string(port)+",\"urls\":["; bool comma=false;
        for(const auto& ip:addresses()){if(comma)body+=",";comma=true;body+="\"http://"+ip+":"+std::to_string(port)+"\"";}
        return response(200,body+"],\"revision\":\""+PanelRevision+"\"}");
    }
    if(method=="POST"&&path=="/api/take"){
        // Full scene: "Duration d", "Time t" and every parameter exactly once.
        if(headers["content-type"]!="text/plain")return response(400,bad);
        std::istringstream input(request.substr(end+4,length));input.imbue(std::locale::classic());
        SceneRequest take;bool haveDuration=false,haveTime=false;
        std::array<bool,ParamCount> seen{};std::string row;
        while(std::getline(input,row)){
            std::istringstream pair(row);pair.imbue(std::locale::classic());
            std::string name;double v;
            if(!(pair>>name>>v)||!std::isfinite(v))return response(400,bad);
            pair>>std::ws;if(!pair.eof())return response(400,bad);
            if(name=="Duration"){
                if(haveDuration||v<MinTakeDuration||v>MaxTakeDuration)return response(400,bad);
                haveDuration=true;take.duration=float(v);
            }else if(name=="Time"){
                if(haveTime||std::abs(v)>1e9)return response(400,bad);
                haveTime=true;take.time=v;
            }else{
                const auto index=PanelState::Find(name);
                if(index>=ParamCount||seen[index]||!PanelState::Valid(index,float(v)))return response(400,bad);
                seen[index]=true;take.values[index]=float(v);
            }
        }
        if(!haveDuration||!haveTime||!std::all_of(seen.begin(),seen.end(),[](bool b){return b;}))return response(400,bad);
        if(!state.scene.Submit(take))return response(409,"{\"error\":\"scene transition in progress\"}");
    } else if(method=="POST"&&(path=="/api/speed"||path=="/api/params")){
        if(headers["content-type"]!="text/plain")return response(400,bad);
        std::istringstream input(request.substr(end+4,length));input.imbue(std::locale::classic());
        std::map<size_t,float> changes;
        if(path=="/api/speed") {
            float v; if(!(input>>v)) return response(400,bad);
            input>>std::ws; if(!input.eof()) return response(400,bad);
            changes.emplace(PanelState::Find("Speed"),v);
        } else {
            std::string row;
            while(std::getline(input,row)) {
                std::istringstream pair(row);pair.imbue(std::locale::classic());
                std::string name;float v;
                if(!(pair>>name>>v))return response(400,bad);
                pair>>std::ws;if(!pair.eof())return response(400,bad);
                auto index=PanelState::Find(name);
                if(!changes.emplace(index,v).second)return response(400,bad);
            }
        }
        if(changes.empty())return response(400,bad);
        // Validate the ENTIRE body before touching any value.
        for(const auto& change:changes)
            if(!PanelState::Valid(change.first,change.second))return response(400,bad);
        for(const auto& change:changes)state.Set(change.first,change.second,true);
    } else if(!(method=="GET"&&path=="/api/state"))return response(404,bad);
    std::ostringstream body;body.imbue(std::locale::classic());
    body<<"{\"speed\":"<<state.Get(PanelState::Find("Speed"))<<",\"params\":{";
    for(size_t i=0;i<ParamCount;++i){
        if(i)body<<",";
        body<<"\""<<ParamDefs[i].name<<"\":"<<state.Get(i);
    }
    body<<"},\"animTime\":"<<AtomicParam::Value(state.animationTime.Snapshot())
        <<",\"phase\":"<<AtomicParam::Value(state.beatPhase.Snapshot())
        <<",\"bpm\":"<<AtomicParam::Value(state.tempo.Snapshot())
        <<",\"width\":"<<AtomicParam::Value(state.width.Snapshot())
        <<",\"height\":"<<AtomicParam::Value(state.height.Snapshot());
    const auto fade=state.fade.load();
    uint32_t fadeBits=uint32_t(fade);float fadeProgress;
    std::memcpy(&fadeProgress,&fadeBits,sizeof fadeProgress);
    body<<",\"fade\":{\"from\":"<<((fade>>32)&255)<<",\"to\":"<<((fade>>40)&255)
        <<",\"progress\":"<<fadeProgress<<",\"duration\":0.6}";
    const auto scene=state.scene.Describe();
    body<<",\"scene\":{\"status\":"<<scene.status<<",\"progress\":"<<scene.progress
        <<",\"duration\":"<<scene.duration<<",\"oldTime\":"<<scene.oldTime<<",\"from\":{";
    for(size_t i=0;i<ParamCount;++i){
        if(i)body<<",";
        body<<"\""<<ParamDefs[i].name<<"\":"<<scene.from[i];
    }
    body<<"}}}";
    return response(200,body.str());
}
struct Client {
    Handle socket;
    std::string input,output;
    size_t sent=0;
    bool draining=false;
    std::chrono::steady_clock::time_point deadline=std::chrono::steady_clock::now()+std::chrono::seconds(2);
    explicit Client(Socket s):socket(s){}
};
}
PanelServer::PanelServer(PanelState& s):state(s),worker(&PanelServer::Run,this){}
PanelServer::~PanelServer(){stopping.store(true);if(worker.joinable())worker.join();}
void PanelServer::Run() noexcept {
    try {
        [[maybe_unused]] Network network;
        Handle listener(::socket(AF_INET,SOCK_STREAM,IPPROTO_TCP));
        if(listener.s==invalid)throw std::runtime_error("socket");
#ifdef _WIN32
        BOOL exclusive=TRUE;
        if(setsockopt(listener.s,SOL_SOCKET,SO_EXCLUSIVEADDRUSE,reinterpret_cast<const char*>(&exclusive),sizeof exclusive))throw std::runtime_error("exclusive bind");
#endif
        sockaddr_in address{};address.sin_family=AF_INET;address.sin_addr.s_addr=htonl(INADDR_ANY);address.sin_port=0;
        if(bind(listener.s,reinterpret_cast<sockaddr*>(&address),sizeof address)||listen(listener.s,16))throw std::runtime_error("bind/listen");
        nonblock(listener.s);
#ifdef _WIN32
        int length=sizeof address;
#else
        socklen_t length=sizeof address;
#endif
        if(getsockname(listener.s,reinterpret_cast<sockaddr*>(&address),&length))throw std::runtime_error("getsockname");
        token=makeToken();port.store(ntohs(address.sin_port));
        std::vector<std::unique_ptr<Client>> clients;
        PreviewRelay preview;
        Pairing pairing;
        PresetStore presets;
        while(!stopping.load()){
            if(openRequested.exchange(false)){
#ifdef _WIN32
                const std::string url="http://127.0.0.1:"+std::to_string(port.load())+"/#"+token;
                // Shell invocation happens on this worker, never the GL thread.
                const std::wstring wide(url.begin(),url.end());
                const HRESULT com = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
                if(reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr,L"open",wide.c_str(),nullptr,nullptr,SW_SHOWNORMAL))<=32)
                    OutputDebugStringA("Souz Content: could not open default browser.\n");
                if(SUCCEEDED(com)) CoUninitialize();
#endif
            }
            fd_set reads,writes;FD_ZERO(&reads);FD_ZERO(&writes);FD_SET(listener.s,&reads);
            Socket highest=listener.s;
            for(auto& c:clients){FD_SET(c->socket.s,(c->draining||c->output.empty())?&reads:&writes);highest=std::max(highest,c->socket.s);}
            timeval wait{0,10000};
            if(select(int(highest+1),&reads,&writes,nullptr,&wait)<0){if(wouldBlock())continue;throw std::runtime_error("select");}
            // Process existing clients before accepting: a new socket isn't in these sets.
            for(auto it=clients.begin();it!=clients.end();){
                auto& c=**it;bool done=std::chrono::steady_clock::now()>c.deadline;
                if(!done&&c.draining&&FD_ISSET(c.socket.s,&reads)){
                    // Discard unread request bytes after sending a rejection. Closing
                    // with unread bytes can reset TCP on Windows and lose the response.
                    char discard[4096];int n=recv(c.socket.s,discard,sizeof discard,0);
                    if(n==0||(n<0&&!wouldBlock()))done=true;
                }
                if(!done&&!c.draining&&c.output.empty()&&FD_ISSET(c.socket.s,&reads)){
                    char bytes[2048];int n=recv(c.socket.s,bytes,sizeof bytes,0);
                    if(n>0){c.input.append(bytes,n);c.output=route(c.input,token,state,port.load(),preview,pairing,presets);
                        if(!c.output.empty() && c.output.size()>32768)
                            c.deadline=std::chrono::steady_clock::now()+std::chrono::seconds(15);}
                    else if(n==0||!wouldBlock())done=true;
                }
                if(!done&&!c.draining&&!c.output.empty()&&FD_ISSET(c.socket.s,&writes)){
#ifdef _WIN32
                    constexpr int flags=0;
#else
                    constexpr int flags=MSG_NOSIGNAL;
#endif
                    int n=send(c.socket.s,c.output.data()+c.sent,int(c.output.size()-c.sent),flags);
                    if(n>0){
                        c.sent+=size_t(n);
                        if(c.sent==c.output.size()){
#ifdef _WIN32
                            constexpr int sendDirection=SD_SEND;
#else
                            constexpr int sendDirection=SHUT_WR;
#endif
                            if(shutdown(c.socket.s,sendDirection)!=0)done=true;
                            else {
                                c.draining=true;c.input.clear();c.output.clear();
                                // Absolute, bounded drain: no wait on the render thread,
                                // no accumulating oversized bodies or unbounded keepalive.
                                c.deadline=std::chrono::steady_clock::now()+std::chrono::seconds(1);
                            }
                        }
                    }else if(n==0||!wouldBlock())done=true;
                }
                if(done)it=clients.erase(it);else ++it;
            }
            if(FD_ISSET(listener.s,&reads)){
                Socket s=accept(listener.s,nullptr,nullptr);
                if(s!=invalid){
                    auto client=std::make_unique<Client>(s);
#ifndef _WIN32
                    if(s>=FD_SETSIZE)continue;
#endif
                    if(clients.size()<24){nonblock(s);clients.push_back(std::move(client));}
                }
            }
        }
    }catch(const std::exception&){
#ifdef _WIN32
        OutputDebugStringA("Souz Content: HTTP panel stopped after an error.\n");
#endif
    }
    port.store(0);
}
}
