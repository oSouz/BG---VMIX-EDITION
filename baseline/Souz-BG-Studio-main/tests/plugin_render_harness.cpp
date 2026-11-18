// Minimal FFGL host for the REAL plugin class (Linux, Mesa EGL surfaceless).
// Drives BackgroundGen through InitGL/ProcessOpenGL like Resolume does, performs
// a full-scene TAKE and an engine change, and dumps every frame plus the exact
// state used for it. tests/test_plugin_render.py renders the expected images
// with tools/preview.py and compares them pixel by pixel.
//
// Built by tests/test_plugin_render.py (needs g++, libEGL, libGL, the FFGL SDK).
#include <EGL/egl.h>
#include <EGL/eglext.h>
#include "BackgroundGen.h"
#include <chrono>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

struct BackgroundGenTest {
    BackgroundGen& p;
    souz::SceneValues Values() const { return p.CurrentValues(); }
    void Set(const char* name, float v) { p.panelState.Set(souz::PanelState::Find(name), v, true); }
    bool Take(souz::SceneValues values, double time, float duration) {
        souz::SceneRequest r; r.values = values; r.time = time; r.duration = duration;
        return p.panelState.scene.Submit(r);
    }
    int SceneStatus() { return p.panelState.scene.Describe().status; }
    bool Fading() const { return p.sceneFade.active || (p.engineFade.progress < 1.0f && p.engineFade.from != p.engineFade.to); }
    std::string State() const {
        auto list = [](const souz::SceneValues& v) {
            std::string s = "{";
            for(size_t i = 0; i < souz::ParamCount; ++i) {
                char buf[64]; std::snprintf(buf, sizeof buf, "%s\"%s\":%.9g", i ? "," : "", souz::ParamDefs[i].name, v[i]);
                s += buf;
            }
            return s + "}";
        };
        const bool engineFading = p.engineFade.progress < 1.0f && p.engineFade.from != p.engineFade.to;
        souz::SceneValues from = p.sceneFade.from; double fromTime = p.sceneFade.fromTime; float progress = p.sceneFade.progress;
        if(!p.sceneFade.active && engineFading) { from = Values(); from[p.engineIndex] = float(p.engineFade.from); fromTime = p.animTime; progress = p.engineFade.progress; }
        char head[160];
        std::snprintf(head, sizeof head, "{\"fading\":%s,\"progress\":%.9g,\"time\":%.9g,\"fromTime\":%.9g,",
                      (p.sceneFade.active || engineFading) ? "true" : "false", progress, float(p.animTime), float(fromTime));
        return std::string(head) + "\"to\":" + list(Values()) + ",\"from\":" + list(from) + "}";
    }
};

static void fail(const char* what) { throw std::runtime_error(what); }

int main(int argc, char** argv) {
    if(argc < 2) { std::fprintf(stderr, "usage: plugin_render_harness <out-dir>\n"); return 2; }
    const std::string out = argv[1];
    auto getDisplay = reinterpret_cast<PFNEGLGETPLATFORMDISPLAYEXTPROC>(eglGetProcAddress("eglGetPlatformDisplayEXT"));
    EGLDisplay dpy = getDisplay ? getDisplay(EGL_PLATFORM_SURFACELESS_MESA, EGL_DEFAULT_DISPLAY, nullptr) : EGL_NO_DISPLAY;
    if(dpy == EGL_NO_DISPLAY || !eglInitialize(dpy, nullptr, nullptr)) fail("EGL display");
    if(!eglBindAPI(EGL_OPENGL_API)) fail("bind GL");
    EGLint cfgAttr[] = { EGL_RENDERABLE_TYPE, EGL_OPENGL_BIT, EGL_NONE };
    EGLConfig cfg = nullptr; EGLint n = 0;  // surfaceless: no config is fine (EGL_KHR_no_config_context)
    if(!eglChooseConfig(dpy, cfgAttr, &cfg, 1, &n) || !n) cfg = nullptr;
    EGLint ctxAttr[] = { EGL_CONTEXT_MAJOR_VERSION, 4, EGL_CONTEXT_MINOR_VERSION, 1,
                         EGL_CONTEXT_OPENGL_PROFILE_MASK, EGL_CONTEXT_OPENGL_CORE_PROFILE_BIT, EGL_NONE };
    EGLContext ctx = eglCreateContext(dpy, cfg, EGL_NO_CONTEXT, ctxAttr);
    if(ctx == EGL_NO_CONTEXT || !eglMakeCurrent(dpy, EGL_NO_SURFACE, EGL_NO_SURFACE, ctx)) fail("GL 4.1 context");
    glewExperimental = GL_TRUE;
    if(glewInit() != GLEW_OK) fail("glewInit");

    const GLuint W = 96, H = 54;
    GLuint tex, fbo;
    glGenTextures(1, &tex); glBindTexture(GL_TEXTURE_2D, tex);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, W, H, 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
    glGenFramebuffers(1, &fbo); glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex, 0);
    if(glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) fail("FBO");
    glViewport(0, 0, W, H);

    auto* plugin = new BackgroundGen();
    BackgroundGenTest t{*plugin};
    FFGLViewportStruct vp{0, 0, W, H};
    if(plugin->InitGL(&vp) != FF_SUCCESS) fail("InitGL (shader compile)");
    ProcessOpenGLStruct frame{0, nullptr, fbo};

    std::ofstream index(out + "/frames.jsonl");
    int count = 0;
    std::vector<unsigned char> pixels(W * H * 4);
    auto render = [&](bool dump) {
        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glClearColor(1, 0, 1, 1); glClear(GL_COLOR_BUFFER_BIT); // stale pixels must not leak through
        if(plugin->ProcessOpenGL(&frame) != FF_SUCCESS) fail("ProcessOpenGL");
        if(glIsEnabled(GL_BLEND)) fail("plugin leaked GL_BLEND state");
        if(!dump) return;
        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glReadPixels(0, 0, W, H, GL_RGBA, GL_UNSIGNED_BYTE, pixels.data());
        const std::string name = "frame" + std::to_string(count++) + ".rgba";
        std::ofstream(out + "/" + name, std::ios::binary).write(reinterpret_cast<char*>(pixels.data()), pixels.size());
        index << "{\"file\":\"" << name << "\",\"state\":" << t.State() << "}\n";
    };
    auto pause = [] { std::this_thread::sleep_for(std::chrono::milliseconds(45)); };

    // Live scene: a classic engine with a custom look.
    t.Set("Engine", 3); t.Set("Scale", .4f); t.Set("Speed", .5f); t.Set("TintWhiteG", .6f);
    for(int i = 0; i < 3; ++i) { render(false); pause(); }
    // Warm-up: software GL builds a separate shader variant for blending on first use,
    // which can take seconds. Run one crossfade before measuring anything.
    t.Set("Engine", 5);
    for(int i = 0; i < 200 && (i < 2 || t.Fading()); ++i) render(false);
    t.Set("Engine", 3);
    for(int i = 0; i < 200 && (i < 2 || t.Fading()); ++i) render(false);
    render(true);

    // TAKE: a Reference Collection engine with different colors, position, speed and clock.
    souz::SceneValues next = t.Values();
    auto set = [&](const char* n, float v) { next[souz::PanelState::Find(n)] = v; };
    set("Engine", 40); set("PositionX", .3f); set("PositionY", .62f); set("Speed", .8f); set("Reverse", 1);
    set("TintWhiteG", 1); set("Rotation", .12f); set("Contrast", .7f);
    if(!t.Take(next, 5.0, 0.4f)) fail("TAKE rejected while idle");
    if(t.Take(next, 5.0, 0.4f)) fail("second TAKE accepted while one is queued");
    for(int i = 0; i < 40 && (i == 0 || t.Fading() || t.SceneStatus() != souz::SceneIdle); ++i) { render(true); pause(); }
    if(t.SceneStatus() != souz::SceneIdle) fail("TAKE did not finish");
    render(true);

    // PGM engine change: 0.6 s crossfade between two engines, same scene otherwise.
    t.Set("Engine", 77);
    for(int i = 0; i < 8; ++i) { render(true); pause(); }

    plugin->DeInitGL(); // as the host does before destroying the instance
    delete plugin;      // stops the HTTP worker
    std::printf("frames=%d\n", count);
    return 0;
}
