#pragma once
#include <algorithm>
#include <cmath>
#include "PanelSchema.h"
namespace souz {
// At most two engines per frame. During a fade the latest requested engine
// waits until the current fade ends, avoiding a discontinuity or a GPU spike.
class EngineFade {
public:
    static constexpr float Duration = 0.6f;
    int from = 0, to = 0;
    float progress = 1.0f;
    bool initialized = false;
    void Advance(int requested, float dt) noexcept {
        requested = std::max(0, std::min(EngineCount-1, requested));
        if(!initialized) { from=to=requested; progress=1; initialized=true; return; }
        if(!std::isfinite(dt) || dt<0) dt=0;
        dt=std::min(dt,0.25f);
        if(progress>=1 && requested!=to) { from=to; to=requested; progress=0; }
        if(progress<1) {
            progress=std::min(1.0f,progress+dt/Duration);
            // Start the queued change at exactly the completed image.
            if(progress>=1 && requested!=to) { from=to; to=requested; progress=0; }
        }
    }
};
}
