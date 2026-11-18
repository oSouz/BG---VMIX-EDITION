#include "PanelServer.h"
#include <chrono>
#include <iostream>
#include <cmath>
#include <vector>
#include <stdexcept>
using namespace souz;
void require(bool v){if(!v)throw std::runtime_error("state/lifecycle test failed");}
int main(){
    PanelState a,b;
    const size_t speed=PanelState::Find("Speed");
    require(std::abs(a.Get(speed)-.35f)<.0001f);
    a.Set(speed,.7f,true);require(AtomicParam::FromWeb(a.values[speed].Snapshot()));
    a.Set(speed,.2f,false);require(!AtomicParam::FromWeb(a.values[speed].Snapshot()));
    a.Set(speed,.35f,false);
    auto one=std::make_unique<PanelServer>(a);
    auto two=std::make_unique<PanelServer>(b);
    for(int i=0;i<500&&(!one->Port()||!two->Port());++i)std::this_thread::sleep_for(std::chrono::milliseconds(10));
    require(one->Port()&&two->Port()&&one->Port()!=two->Port());
    std::cout<<one->Port()<<" "<<one->Token()<<" "<<two->Port()<<" "<<two->Token()<<std::endl;
    std::string command;
    while(std::cin>>command){
        if(command=="host"){float value;std::cin>>value;a.Set(speed,value,false);std::cout<<"ok"<<std::endl;}
        if(command=="param"){std::string name;float value;std::cin>>name>>value;require(a.Set(PanelState::Find(name),value,false));std::cout<<"ok"<<std::endl;}
        if(command=="stop1"){one.reset();std::cout<<"stopped"<<std::endl;}
        // Render-thread side of TAKE (the plugin does this at the start of a frame).
        if(command=="commit"){
            SceneValues current{};for(size_t i=0;i<ParamCount;++i)current[i]=a.Get(i);
            SceneRequest take;const auto gen=a.scene.TryTake(take,current,7.5);
            if(gen)for(size_t i=0;i<ParamCount;++i)a.Set(i,take.values[i],true);
            std::cout<<gen<<" "<<take.duration<<" "<<take.time<<std::endl;
        }
        if(command=="publish"){unsigned long long gen;float progress;int done;std::cin>>gen>>progress>>done;
            require(a.scene.TryPublish(gen,progress,8.25,done!=0));std::cout<<"ok"<<std::endl;}
        if(command=="quit")break;
    }
    one.reset();two.reset();
    // Repeated create/stop, including stop during asynchronous initialization.
    for(int i=0;i<20;++i){PanelServer rapid(a);}
}
