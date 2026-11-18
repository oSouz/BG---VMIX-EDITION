// ============================================================================
//  90_main.glsl  -  parameter decoding, engine dispatch, final grading
// ============================================================================
// Internal uniform, not a parameter (saved FFGL indices stay unchanged).
// The plugin draws a crossfade as two passes: the outgoing scene opaque,
// then the incoming scene with sceneOpacity = smoothstep(progress).
uniform float sceneOpacity;

// Engines 0-31 (classic collection) average three Blur taps; engines 32+ are
// evaluated once. Every engine is black and white: color comes only from the
// tint (Black To / White To), which maps the luminance.
//@ENGINE_GROUPS@

vec3 renderEngine(int eng, vec2 p){
    vec3 col;
    gNCol = 4;
//@ENGINE_DISPATCH@

    // ---- final grade ----
    col=pow(max(col,vec3(0.0)),vec3(mix(1.3,0.9,Smoothness)));
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, mix(0.0, 2.0, Saturation));
    col = (col - 0.5) * mix(0.4, 1.6, Contrast) + 0.5;
    col *= mix(0.0, 2.0, Brightness);
    float beat = pow(1.0 - fract(phase * 4.0), 3.0);
    col *= 1.0 + (Pulse ? 1.0 : 0.0) * 0.8 * beat;

    float tintLuma = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    // Posterize: 0 = off, then 12 -> 2 luminance bands.
    if (Posterize > 0.0) { float bands = floor(mix(12.0, 2.0, Posterize)); tintLuma = floor(tintLuma * bands + 0.5) / bands; }
    col = mix(vec3(TintBlackR,TintBlackG,TintBlackB), vec3(TintWhiteR,TintWhiteG,TintWhiteB), tintLuma);
    // Vignette and animated grain (0 = off).
    col *= 1.0 - Vignette * smoothstep(0.35, 1.0, length(i_uv - 0.5) * 1.414);
    col += Grain * 0.2 * (hash12(i_uv * resolution + fract(gT * 7.31) * 97.0) - 0.5);
    return clamp(col, 0.0, 1.0);
}

void main(){
    gShape = 0;
    gAsp   = resolution.x / max(resolution.y, 1.0);
    gT     = animTime;
    gSeed  = 0.0;
    gSO    = vec2(hash11(gSeed * 1.13 + 0.5), hash11(gSeed * 2.71 + 3.0)) * 80.0;
    gDens  = Density;
    gSm    = Smoothness;
    gBl    = Blur;
    gWarp  = Warp ? 0.4 : 0.0;
    gShift = 0.0;
    gOct   = mix(5.5, 1.3, gBl);
    gGain  = mix(0.62, 0.34, gSm);

    // Neutral luminance ramp: tint defines shadow and highlight colors.
    gC0=vec3(0.03);gC1=vec3(0.25);gC2=vec3(0.65);gC3=vec3(1.0);

    vec2 p = (i_uv - 0.5 - vec2((PositionX-.5)*2.0,(PositionY-.5)*2.0)) * vec2(gAsp, 1.0) * 2.0;
    p = rot2(Rotation * TAU) * p;
    p /= exp2(mix(-1.5, 1.5, Scale));

    // Shape controls (neutral defaults leave the image unchanged).
    int mirror = int(Mirror + 0.5);
    if (mirror == 1 || mirror == 3) p.x = abs(p.x);
    if (mirror == 2 || mirror == 3) p.y = abs(p.y);
    if (mirror == 4) { float seg = TAU / 6.0, a = mod(atan(p.y, p.x), seg) - seg * 0.5; p = length(p) * vec2(cos(abs(a)), sin(abs(a))); }
    p *= vec2(exp2((Stretch - 0.5) * 2.0), exp2((0.5 - Stretch) * 2.0));
    float twist = (Twist - 0.5) * 2.0;
    if (twist != 0.0) p = rot2(twist * 3.0 * exp(-length(p) * 0.6)) * p;
    p += Ripple * 0.25 * vec2(sin(p.y * 4.0 + gT * 0.6), sin(p.x * 4.0 - gT * 0.5));

    p *= mix(0.8,1.2,Density);
    p += gWarp * 0.18 * vec2(sin(p.y*2.3+gT*.2),cos(p.x*1.7-gT*.16));
    vec3 col = renderEngine(int(Engine + 0.5), p);
    fragColor = vec4(col, sceneOpacity);
}
