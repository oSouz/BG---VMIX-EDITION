#pragma once
#include <atomic>
#include <array>
#include <cmath>
#include "PanelSchema.h"
#include "SceneTake.h"
#include <cstdint>
#include <cstring>
#include <memory>
#include <thread>
#include <string>

namespace souz {
// One atomic word is both the authoritative value and its revision. A writer
// cannot publish a revision paired with another writer's value. No locks on GL.
class AtomicParam {
    std::atomic<uint64_t> word{0};
public:
    static_assert(ATOMIC_LLONG_LOCK_FREE == 2, "Requires lock-free 64-bit atomics");
    AtomicParam() = default;
    void Set(float value, bool web) noexcept {
        uint32_t bits; std::memcpy(&bits, &value, sizeof bits);
        auto old = word.load();
        uint64_t next;
        do {
            const auto revision = ((old >> 33) + 1) & 0x7fffffffULL;
            next = (revision << 33) | (uint64_t(web) << 32) | bits;
        } while (!word.compare_exchange_weak(old, next));
    }
    uint64_t Snapshot() const noexcept { return word.load(); }
    static float Value(uint64_t snapshot) noexcept {
        uint32_t bits = uint32_t(snapshot); float value;
        std::memcpy(&value, &bits, sizeof value); return value;
    }
    static bool FromWeb(uint64_t snapshot) noexcept { return (snapshot >> 32) & 1; }
};

class PanelState {
public:
    AtomicParam animationTime, beatPhase, tempo, width, height;
    std::atomic<uint64_t> fade{0x3f800000ULL};
    void PublishFade(int from,int to,float progress) noexcept {
        uint32_t bits; std::memcpy(&bits,&progress,sizeof bits);
        fade.store(uint64_t(bits)|(uint64_t(from)<<32)|(uint64_t(to)<<40));
    }
    std::array<AtomicParam,ParamCount> values;
    SceneExchange scene; // PVW -> PGM TAKE handoff (worker queues, render commits)
    PanelState() {
        for(size_t i=0;i<ParamCount;++i) values[i].Set(ParamDefs[i].defaultValue,false);
    }
    static size_t Find(const std::string& name) {
        for(size_t i=0;i<ParamCount;++i) if(name==ParamDefs[i].name) return i;
        return ParamCount;
    }
    static bool Valid(size_t i,float v) noexcept {
        return i<ParamCount && std::isfinite(v) && v>=0 && v<=ParamDefs[i].maximum &&
            (!ParamDefs[i].discrete || std::floor(v)==v);
    }
    bool Set(size_t i,float v,bool web) noexcept {
        if(!Valid(i,v)) return false;
        values[i].Set(v,web); return true;
    }
    float Get(size_t i) const noexcept { return AtomicParam::Value(values[i].Snapshot()); }
};

class PanelServer {
public:
    explicit PanelServer(PanelState& state);
    ~PanelServer();
    PanelServer(const PanelServer&) = delete;
    PanelServer& operator=(const PanelServer&) = delete;
    void Open() noexcept { openRequested.store(true); }
    unsigned short Port() const noexcept { return port.load(); }
    // Used by the test harness; immutable after startup publication via Port().
    const std::string& Token() const noexcept { return token; }
private:
    void Run() noexcept;
    PanelState& state;
    std::string token;
    std::atomic<bool> stopping{false}, openRequested{false};
    std::atomic<unsigned short> port{0};
    std::thread worker;
};
}
