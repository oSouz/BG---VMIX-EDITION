#!/usr/bin/env python3
"""
Single source of truth for the plugin.

Reads  shader/*.glsl  and the tables below and generates:

  src/ShaderSource.h      the fragment-shader body as <16 KB raw-string chunks
                          (MSVC refuses single string literals above ~16 KB)
  src/ParamsGenerated.inc parameter registration code, included by the plugin
                          constructor (so GLSL uniforms and C++ params can
                          never drift apart)
  tools/out/full_shader.frag  the exact shader the host will compile
                          (framework header + uniforms + body), for glslang
                          validation and for tools/preview.py

Run:  python tools/gen_shader.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --------------------------------------------------------------------------
#  Tables
# --------------------------------------------------------------------------
# Engine ids are saved in compositions: never reorder, only append.
# web/engine-catalog.json is the single list of names and categories.
import json as _json
with open(os.path.join(ROOT, "web", "engine-catalog.json"), encoding="utf-8") as _f:
    CATALOG = _json.load(_f)
assert [e["id"] for e in CATALOG["engines"]] == list(range(len(CATALOG["engines"]))), "engine ids must be 0..N-1"
ENGINES = [(e["name"], "ENG_V%02d" % e["id"]) for e in CATALOG["engines"]]
# Removed duplicates keep their id (saved compositions) and render the engine they duplicated;
# they are hidden from Resolume's list, the panel and the catalog.
REMOVED = {e["id"]: e["removed_alias"] for e in CATALOG["engines"] if "removed_alias" in e}
assert all(a not in REMOVED for a in REMOVED.values()), "alias must be an active engine"
ACTIVE = [i for i in range(len(ENGINES)) if i not in REMOVED]
CATEGORIES = [dict(name=c, engines=[e["id"] for e in CATALOG["engines"] if e["category"] == c and e["id"] not in REMOVED]) for c in CATALOG["categories"]]
assert sum(len(c["engines"]) for c in CATEGORIES) == len(ACTIVE), "every engine needs a known category"

# Engines 0-31: classic collection (three Blur taps). Engines 32+: single tap.
# All engines are black and white; the tint maps luminance to color.
LEGACY_ENGINE_COUNT = 32

SHAPES = [
    "Circle", "Square", "Triangle", "Hexagon", "Star", "Diamond", "Cross",
    "Ring", "Pill", "Heart", "Linear", "Angular", "Spiral", "Wave",
]

# name, 4 stops (dark -> light-ish, but any order works)
PALETTES = [(name,[color]*4) for name,color in [
    ('Fire','#FF3030'),('Ember','#FF8500'),('Gold','#FFD020'),
    ('Ocean','#00C9EF'),('Electric Blue','#2860FF'),('Ultraviolet','#992FFF'),
    ('Rose','#FF4399'),('Mono','#FFFFFF'),('Desert','#AD7144')
]]

# (name, kind, default)  kind: option | range | bool | color
# Order here == order in Resolume.  Colour groups must stay at the very end.
PARAMS = [
    ("Engine", "option_engine", 0),
    ("Scale", "range", 0.50),
    ("Speed", "range", 0.35),
    ("Rotation", "range", 0.00),
    ("Density", "range", 0.50),
    ("Smoothness", "range", 0.80),
    ("Blur", "range", 0.20),
    ("Warp", "bool", False),
    ("Reverse", "bool", False),
    ("Brightness", "range", 0.50),
    ("Contrast", "range", 0.50),
    ("Saturation", "range", 0.50),
    ("Pulse", "bool", False),
    ("TintBlackR", "range", 0.0),
    ("TintBlackG", "range", 0.0),
    ("TintBlackB", "range", 0.0),
    ("TintWhiteR", "range", 1.0),
    ("TintWhiteG", "range", 1.0),
    ("TintWhiteB", "range", 1.0),
    # v1.11.0: appended at the end so every earlier saved index is unchanged.
    ("PositionX", "range", 0.5),
    ("PositionY", "range", 0.5),
    # v1.12.0: shape controls for every engine, appended (neutral defaults = no change).
    ("Twist", "range", 0.5),
    ("Ripple", "range", 0.0),
    ("Stretch", "range", 0.5),
    ("Mirror", "option_mirror", 0),
    ("Vignette", "range", 0.0),
    ("Grain", "range", 0.0),
    ("Posterize", "range", 0.0),
]
MIRROR_MODES = ["Off", "Mirror X", "Mirror Y", "Mirror XY", "Kaleido"]

FRAMEWORK_HEADER = """#version 410 core
out vec4 fragColor;
uniform vec2 resolution;
uniform float time;
uniform float deltaTime;
uniform int frame;
uniform float bpm;
uniform float phase;
in vec2 i_uv;
uniform float animTime;
"""

CHUNK = 8000


def hex_to_glsl(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return "vec3(%.4f,%.4f,%.4f)" % (r, g, b)


def build_palette_glsl():
    lines = ["const vec3 PRESETS[%d] = vec3[%d](" % (len(PALETTES) * 4, len(PALETTES) * 4)]
    rows = []
    for name, cols in PALETTES:
        rows.append("    " + ", ".join(hex_to_glsl(c) for c in cols) + "  // " + name)
    # commas between rows, none after the last
    out = []
    for i, r in enumerate(rows):
        head, comment = r.split("  // ")
        out.append(head + ("," if i < len(rows) - 1 else "") + "  // " + comment)
    lines += out
    lines.append(");")
    return "\n".join(lines)


def read(path):
    with open(os.path.join(ROOT, path), "r", encoding="utf-8") as f:
        return f.read()


def engine_call(i):
    """GLSL expression for one engine; the browser preview uses the same text."""
    i = REMOVED.get(i, i)
    name = "eng_v%02d" % i
    if i < LEGACY_ENGINE_COUNT:
        return "(%s(p)+%s(p+vec2(Blur*.03,Blur*.02))+%s(p-vec2(Blur*.03,Blur*.02)))/3.0" % (name, name, name)
    return "%s(p)" % name


DISPATCH_GROUP = 16  # very long switch statements miscompile on some GLSL compilers (Mesa: ~74+ cases)


def build_dispatch():
    """Two-level dispatch: small switch functions of DISPATCH_GROUP engines each."""
    groups, calls = [], []
    for g in range(0, len(ENGINES), DISPATCH_GROUP):
        cases = "\n".join("    case %s: return %s;" % (ENGINES[i][1], engine_call(i))
                          for i in range(g, min(g + DISPATCH_GROUP, len(ENGINES))))
        groups.append("vec3 engineGroup%d(int eng, vec2 p){\n    switch (eng) {\n%s\n    }\n    return vec3(0.0);\n}" % (g // DISPATCH_GROUP, cases))
        calls.append("    %sif (eng < %d) col = engineGroup%d(eng, p);" % ("" if g == 0 else "else ", g + DISPATCH_GROUP, g // DISPATCH_GROUP))
    calls.append("    else col = vec3(0.0);")
    return "\n".join(groups), "\n".join(calls)


def build_body():
    defs = "\n".join("#define %s %d" % (macro, i) for i, (_, macro) in enumerate(ENGINES))
    defs += "\n#define LEGACY_ENGINE_COUNT %d" % LEGACY_ENGINE_COUNT
    common = read("shader/00_common.glsl").replace("//@PALETTES@", build_palette_glsl())
    main = read("shader/90_main.glsl")
    assert "//@ENGINE_GROUPS@" in main and "//@ENGINE_DISPATCH@" in main
    groups, calls = build_dispatch()
    main = main.replace("//@ENGINE_GROUPS@", groups).replace("//@ENGINE_DISPATCH@", calls)
    return "\n".join([
        "// ---- generated engine ids ----", defs, "",
        common, read("shader/10_engines.glsl"), main,
    ])


def uniform_decls():
    out = []
    for name, kind, _ in PARAMS:
        if kind == "bool":
            out.append("uniform bool %s;" % name)
        elif kind == "color":
            out.append("uniform vec4 %s;" % name)
        else:
            out.append("uniform float %s;" % name)
    return "\n".join(out) + "\n"


def chunk_lines(text):
    chunks, cur = [], ""
    for line in text.splitlines(True):
        if len(cur) + len(line) > CHUNK and cur:
            chunks.append(cur)
            cur = ""
        cur += line
    if cur:
        chunks.append(cur)
    return chunks


def cstr(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def gen_shader_header(body):
    chunks = chunk_lines(body)
    for c in chunks:
        assert ")GLSL\"" not in c
        assert len(c) < 15000
    parts = ["#pragma once", "#include <string>", "",
             "// GENERATED by tools/gen_shader.py - do not edit by hand.",
             "// Split into small chunks because MSVC limits a single string literal to ~16 KB.", "",
             "static const char* const kShaderChunks[] = {"]
    for c in chunks:
        parts.append('R"GLSL(' + c + ')GLSL",')
    parts += ["nullptr", "};", "",
              "inline std::string BuildBackgroundShader()", "{",
              "\tstd::string s;",
              "\tfor( const char* const* c = kShaderChunks; *c; ++c )",
              "\t\ts += *c;",
              "\treturn s;", "}", ""]
    return "\n".join(parts)


def gen_params_inc():
    L = ["// GENERATED by tools/gen_shader.py - do not edit by hand.",
         "// Included inside the plugin constructor.", ""]
    index = 0
    for name, kind, default in PARAMS:
        if index == 13:
            L += ['openIndex = static_cast<unsigned int>(params.size());', 'AddParam(ffglqs::ParamEvent::Create("OpenPanel"));', 'SetParamDisplayName(openIndex, "Abrir painel", false);']
        if kind == "option_engine":
            opts = ", ".join('{ %s, %d.0f }' % (cstr(n), i) for i, (n, _) in enumerate(ENGINES) if i not in REMOVED)
            L.append('AddParam( ffglqs::ParamOption::Create( %s, { %s }, %d ) );' % (cstr(name), opts, default))
        elif kind == "option_shape":
            opts = ", ".join('{ %s, %d.0f }' % (cstr(n), i) for i, n in enumerate(SHAPES))
            L.append('AddParam( ffglqs::ParamOption::Create( %s, { %s }, %d ) );' % (cstr(name), opts, default))
        elif kind == "option_mirror":
            opts = ", ".join('{ %s, %d.0f }' % (cstr(n), i) for i, n in enumerate(MIRROR_MODES))
            L.append('AddParam( ffglqs::ParamOption::Create( %s, { %s }, %d ) );' % (cstr(name), opts, default))
        elif kind == "option_mode":
            opts = ", ".join('{ %s, %d.0f }' % (cstr(n), i) for i,n in enumerate(['Off','Color','Palette']))
            L.append('AddParam( ffglqs::ParamOption::Create( %s, { %s }, %d ) );' % (cstr(name), opts, default))
        elif kind == "option_palette":
            names = [n for n, _ in PALETTES]
            opts = ", ".join('{ %s, %d.0f }' % (cstr(n), i) for i, n in enumerate(names))
            L.append('AddParam( ffglqs::ParamOption::Create( %s, { %s }, %d ) );' % (cstr(name), opts, default))
        elif kind == "range":
            L.append('AddParam( ffglqs::ParamRange::Create( %s, %.3ff, ffglqs::ParamRange::Range( 0.0f, 1.0f ) ) );'
                     % (cstr(name), default))
        elif kind == "bool":
            L.append('AddParam( ffglqs::ParamBool::Create( %s, %s ) );' % (cstr(name), "true" if default else "false"))
        elif kind == "color":
            h, s, b = default
            L.append('AddParam( ffglqs::Param::Create( %s, FF_TYPE_HUE, %.3ff ) );' % (cstr(name), h))
            L.append('AddParam( ffglqs::Param::Create( %s, FF_TYPE_SATURATION, %.3ff ) );' % (cstr(name + "_saturation"), s))
            L.append('AddParam( ffglqs::Param::Create( %s, FF_TYPE_BRIGHTNESS, %.3ff ) );' % (cstr(name + "_brightness"), b))
            L.append('AddParam( ffglqs::Param::Create( %s, FF_TYPE_ALPHA, 1.0f ) );' % cstr(name + "_alpha"))
            nice = {"TintBlack":"Tint Black To","TintWhite":"Tint White To","ColorizeColor":"Colorize Color"}[name]
            L.append('SetParamDisplayName( %d, %s, false );' % (index, cstr(nice)))
            L.append('SetParamDisplayName( %d, %s, false );' % (index + 1, cstr(nice + " Sat")))
            L.append('SetParamDisplayName( %d, %s, false );' % (index + 2, cstr(nice + " Bri")))
            L.append('SetParamDisplayName( %d, %s, false );' % (index + 3, cstr(nice + " Alpha")))
            index += 3
        index += 1
    L.append("")
    return "\n".join(L)


def main():
    body = build_body()
    os.makedirs(os.path.join(ROOT, "src"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "tools", "out"), exist_ok=True)

    with open(os.path.join(ROOT, "src", "ShaderSource.h"), "w", encoding="utf-8", newline="\n") as f:
        f.write(gen_shader_header(body))
    with open(os.path.join(ROOT, "src", "ParamsGenerated.inc"), "w", encoding="utf-8", newline="\n") as f:
        f.write(gen_params_inc())
    with open(os.path.join(ROOT, "tools", "out", "full_shader.frag"), "w", encoding="utf-8", newline="\n") as f:
        f.write(FRAMEWORK_HEADER + uniform_decls() + body)

    n_eng, n_sh, n_pal = len(ENGINES), len(SHAPES), len(PALETTES)
    print("engines=%d shapes=%d palettes=%d (single colors)" % (n_eng, n_sh, n_pal))
    print("structural combos (engine x shape x palette) = %d" % (n_eng * n_sh * n_pal))
    print("x 10,000 seeds                              = %d" % (n_eng * n_sh * n_pal * 10000))
    print("wrote src/ShaderSource.h, src/ParamsGenerated.inc, tools/out/full_shader.frag")


if __name__ == "__main__":
    sys.exit(main())
