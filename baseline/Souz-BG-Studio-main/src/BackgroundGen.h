#pragma once
#include <FFGLSDK.h>
#include <memory>
#include "PanelServer.h"
#include "EngineFade.h"
#include "SceneTake.h"

/// Animated background generator (FFGL 2.x source plugin for Resolume).
///
/// Web panel: per-instance HTTP worker, embedded UI, atomic parameter handoff.
/// All the visual work happens in one fragment shader (see shader/*.glsl, assembled by
/// tools/gen_shader.py into ShaderSource.h). The visual C++ side:
///   * registers the parameters (ParamsGenerated.inc, same generator -> always in sync),
///   * integrates "animated time" so the Speed slider changes speed smoothly
///     (multiplying the wall clock by Speed would make the animation jump) and Reverse works.
class BackgroundGen : public ffglqs::Source
{
public:
	BackgroundGen();
	~BackgroundGen();

	void Update() override;
    FFResult Init() override;
    void Clean() override;
    FFResult ProcessOpenGL(ProcessOpenGLStruct* input) override;
    FFResult Render(ProcessOpenGLStruct* input) override;
    FFResult SetFloatParameter(unsigned int index, float value) override;
    float GetFloatParameter(unsigned int index) override;
    char* GetParameterDisplay(unsigned int index) override;

private:
	friend struct BackgroundGenTest; // tests/plugin_render_harness.cpp only
	std::shared_ptr< ffglqs::Param > speedParam;
	std::shared_ptr< ffglqs::Param > reverseParam;
	souz::PanelState panelState;
    std::unique_ptr<souz::PanelServer> panel;
    unsigned int openIndex = 0;
    std::array<uint64_t, souz::ParamCount> appliedParams{};
    char paramDisplay[32]{};
    // Called only by the host, before the base framework uploads uniforms.
    void ApplyPanelParams();

    // Commits a queued TAKE at the start of a frame (render thread, never blocks).
    void CommitTake();
    souz::SceneValues CurrentValues() const;
    // Uploads one scene's parameters and clock to the bound shader.
    void SendScene(const souz::SceneValues& values, double time, float opacity);

    souz::EngineFade engineFade;
    souz::SceneFade sceneFade;
    bool scenePublishPending = false;
    size_t speedIndex = 0, reverseIndex = 0, engineIndex = 0;
    double animTime = 0.0;
};
