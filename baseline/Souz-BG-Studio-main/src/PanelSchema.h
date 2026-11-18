#pragma once
#include <array>
#include <cstddef>
namespace souz {
struct ParamDef { const char* name; float defaultValue; float maximum; bool discrete; };
inline constexpr int EngineCount = 105;
inline constexpr size_t ParamCount = 28;
inline constexpr std::array<ParamDef, ParamCount> ParamDefs = {{
    {"Engine", 0.000000f, 104.000000f, true},
    {"Scale", 0.500000f, 1.000000f, false},
    {"Speed", 0.350000f, 1.000000f, false},
    {"Rotation", 0.000000f, 1.000000f, false},
    {"Density", 0.500000f, 1.000000f, false},
    {"Smoothness", 0.800000f, 1.000000f, false},
    {"Blur", 0.200000f, 1.000000f, false},
    {"Warp", 0.000000f, 1.000000f, true},
    {"Reverse", 0.000000f, 1.000000f, true},
    {"Brightness", 0.500000f, 1.000000f, false},
    {"Contrast", 0.500000f, 1.000000f, false},
    {"Saturation", 0.500000f, 1.000000f, false},
    {"Pulse", 0.000000f, 1.000000f, true},
    {"TintBlackR", 0.000000f, 1.000000f, false},
    {"TintBlackG", 0.000000f, 1.000000f, false},
    {"TintBlackB", 0.000000f, 1.000000f, false},
    {"TintWhiteR", 1.000000f, 1.000000f, false},
    {"TintWhiteG", 1.000000f, 1.000000f, false},
    {"TintWhiteB", 1.000000f, 1.000000f, false},
    {"PositionX", 0.500000f, 1.000000f, false},
    {"PositionY", 0.500000f, 1.000000f, false},
    {"Twist", 0.500000f, 1.000000f, false},
    {"Ripple", 0.000000f, 1.000000f, false},
    {"Stretch", 0.500000f, 1.000000f, false},
    {"Mirror", 0.000000f, 4.000000f, true},
    {"Vignette", 0.000000f, 1.000000f, false},
    {"Grain", 0.000000f, 1.000000f, false},
    {"Posterize", 0.000000f, 1.000000f, false},
}};
}
