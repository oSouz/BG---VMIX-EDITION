#pragma once
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <mutex>
#include "PanelSchema.h"

namespace souz {
// PVW -> PGM TAKE: a complete scene (every parameter plus its clock) replaces
// the live scene with a crossfade of the selected duration.
//
// The HTTP worker only queues the request. The render thread commits it at the
// start of a frame and draws both scenes (outgoing opaque, incoming blended),
// so colors, scale, position and clocks of the two scenes stay independent.
// The render thread never blocks: it only uses try_lock.
using SceneValues = std::array<float, ParamCount>;

struct SceneRequest {
    SceneValues values{};
    double time = 0.0;
    float duration = 1.0f;
};

enum SceneStatus : int { SceneIdle = 0, SceneQueued = 1, SceneFading = 3 };

constexpr float MinTakeDuration = 0.1f;
constexpr float MaxTakeDuration = 10.0f;

// Speed 0..1 -> 0x..4x, quadratic (same curve as the plugin and the panel preview).
inline double ClockRate(const SceneValues& v, size_t speedIndex, size_t reverseIndex) noexcept {
    const double s = v[speedIndex];
    return s * s * 4.0 * (v[reverseIndex] > 0.5f ? -1.0 : 1.0);
}

// Shared between the HTTP worker and the render thread.
class SceneExchange {
public:
    using Clock = std::chrono::steady_clock;
    // A request the render thread does not pick up (clip not playing) or a fade
    // that stopped being published (clip stopped mid-fade) must not lock TAKE forever.
    static constexpr std::chrono::milliseconds StaleAfter{2000};

    // Worker. False means busy: a TAKE is queued or still fading (HTTP 409).
    bool Submit(const SceneRequest& r) {
        std::lock_guard<std::mutex> lock(m);
        const auto now = Clock::now();
        if(status != SceneIdle && now - touched < StaleAfter) return false;
        request = r; status = SceneQueued; touched = now; ++generation;
        progress = 0; duration = r.duration;
        return true;
    }

    struct View {
        int status; float progress, duration; double oldTime; SceneValues from;
    };
    // Worker.
    View Describe() {
        std::lock_guard<std::mutex> lock(m);
        if(status != SceneIdle && Clock::now() - touched >= StaleAfter) status = SceneIdle;
        return View{status, progress, duration, oldTime, from};
    }

    // Render thread. Picks up a queued request; returns its generation or 0.
    uint64_t TryTake(SceneRequest& out, const SceneValues& current, double currentTime) {
        std::unique_lock<std::mutex> lock(m, std::try_to_lock);
        if(!lock.owns_lock() || status != SceneQueued) return 0;
        out = request; from = current; oldTime = currentTime;
        status = SceneFading; progress = 0; touched = Clock::now();
        return generation;
    }

    // Render thread. Publishes progress of the fade started with `gen`.
    // Returns false if the lock was busy (retry next frame).
    bool TryPublish(uint64_t gen, float p, double fromTime, bool done) {
        std::unique_lock<std::mutex> lock(m, std::try_to_lock);
        if(!lock.owns_lock()) return false;
        if(gen != generation || status != SceneFading) return true; // superseded
        progress = p; oldTime = fromTime; touched = Clock::now();
        if(done) status = SceneIdle;
        return true;
    }

private:
    std::mutex m;
    int status = SceneIdle;
    uint64_t generation = 0;
    SceneRequest request;
    Clock::time_point touched{};
    float progress = 1.0f, duration = 0.0f;
    double oldTime = 0.0;
    SceneValues from{};
};

// Render-thread state of the running crossfade (pure logic, unit tested).
class SceneFade {
public:
    bool active = false;
    uint64_t generation = 0;
    SceneValues from{};
    double fromTime = 0.0;
    float duration = 1.0f, progress = 1.0f;

    void Start(uint64_t gen, const SceneValues& outgoing, double outgoingTime, float seconds) noexcept {
        active = true; generation = gen; from = outgoing; fromTime = outgoingTime;
        duration = std::max(MinTakeDuration, std::min(MaxTakeDuration, seconds)); progress = 0.0f;
    }
    // The outgoing scene keeps animating at its own speed while it fades out.
    void Advance(float dt, size_t speedIndex, size_t reverseIndex) noexcept {
        if(!active) return;
        if(!std::isfinite(dt) || dt < 0) dt = 0;
        dt = std::min(dt, 0.25f);
        fromTime += dt * ClockRate(from, speedIndex, reverseIndex);
        progress = std::min(1.0f, progress + dt / duration);
        if(progress >= 1.0f) active = false;
    }
    // Opacity of the incoming scene: smoothstep, identical to the panel preview.
    static float Weight(float p) noexcept { p = std::max(0.0f, std::min(1.0f, p)); return p * p * (3.0f - 2.0f * p); }
};
}
