// ============================================================================
//  00_common.glsl  -  helpers: hash, noise, fbm, SDFs, shape metrics, palette
//  (The uniforms for every parameter + time/resolution are declared by the
//   FFGL quickstart framework and by tools/gen_shader.py - not here.)
// ============================================================================
#define PI  3.14159265359
#define TAU 6.28318530718

// ---- globals filled in main() ----------------------------------------------
vec3  gC0, gC1, gC2, gC3;   // active 4-color palette
int   gNCol;                // how many of those colors the engine uses (2/3/4)
float gT;                   // animated time (speed already applied on the CPU)
float gSeed;                // integer seed 0..9999
vec2  gSO;                  // seed -> noise-domain offset
float gDens, gSm, gBl, gWarp, gShift;
float gAsp;
float gOct, gGain;          // fbm octaves / gain (driven by Blur / Smoothness)
int   gShape;

// ---- hashes (Dave Hoskins) --------------------------------------------------
float hash11(float p){
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}
float hash12(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}
float hash13(vec3 p3){
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 rot2(float a){
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// ---- 3D value noise + fbm ---------------------------------------------------
float vnoise3(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), f.x);
    float b = mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x);
    float c = mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x);
    float d = mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

// oct = number of (fractional) octaves; gain = amplitude falloff
float fbm3(vec3 p, float oct, float gain){
    float a = 0.5, s = 0.0, n = 0.0;
    mat2 R = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 6; i++){
        float w = clamp(oct - float(i), 0.0, 1.0);
        s += a * w * vnoise3(p);
        n += a * w;
        p = vec3(R * p.xy, p.z) * 2.02 + vec3(11.7, 3.1, 1.7);
        a *= gain;
    }
    return s / max(n, 1e-4);
}
// global-parameter version: Blur removes octaves, Smoothness lowers the gain
float fbm(vec2 p, float z){
    return fbm3(vec3(p, z), gOct, gGain);
}

// ---- 2D SDFs (all roughly unit size, centred at the origin) -----------------
float sdCircle(vec2 p){ return length(p) - 0.9; }
float sdBox(vec2 p){
    vec2 d = abs(p) - vec2(0.78);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdTri(vec2 p){
    const float k = 1.7320508;
    float r = 0.95;
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
}
float sdHex(vec2 p){
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    float r = 0.8;
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}
float sdStar(vec2 p){
    const vec2 k1 = vec2(0.809016994375, -0.587785252292);
    const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
    float r = 0.95;
    float rf = 0.42;
    p.x = abs(p.x);
    p -= 2.0 * max(dot(k1, p), 0.0) * k1;
    p -= 2.0 * max(dot(k2, p), 0.0) * k2;
    p.x = abs(p.x);
    p.y -= r;
    vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
    float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
    return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float sdDiamond(vec2 p){
    return (abs(p.x) + abs(p.y)) * 0.70710678 - 0.80;
}
float sdCross(vec2 p){
    vec2 b = vec2(0.95, 0.30);
    p = abs(p);
    p = (p.y > p.x) ? p.yx : p.xy;
    vec2 q = p - b;
    float k = max(q.y, q.x);
    vec2 w = (k > 0.0) ? q : vec2(b.y - p.x, -k);
    return sign(k) * length(max(w, 0.0));
}
float sdRing(vec2 p){
    return abs(length(p) - 0.68) - 0.22;
}
float sdPill(vec2 p){
    vec2 q = vec2(p.x - clamp(p.x, -0.55, 0.55), p.y);
    return length(q) - 0.36;
}
float sdHeartRaw(vec2 p){
    p.x = abs(p.x);
    if (p.y + p.x > 1.0){
        vec2 d = p - vec2(0.25, 0.75);
        return sqrt(dot(d, d)) - 0.35355339;
    }
    vec2 a = p - vec2(0.0, 1.0);
    vec2 b = p - 0.5 * max(p.x + p.y, 0.0);
    return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}
float sdHeart(vec2 p){
    return sdHeartRaw(vec2(p.x, p.y + 0.55) * 0.95) / 0.95;
}

// Shape ids: 0 Circle 1 Square 2 Triangle 3 Hexagon 4 Star 5 Diamond 6 Cross
//            7 Ring 8 Pill 9 Heart   (10 Linear 11 Angular 12 Spiral 13 Wave:
//            only meaningful for the gradient / lines engines)
float shapeSD(vec2 p, int sh){
    if (sh >= 10) sh = (sh - 10) * 2 + 1;     // Linear/Angular/Spiral/Wave -> Square/Hex/Diamond/Ring
    if (sh == 0) return sdCircle(p);
    if (sh == 1) return sdBox(p);
    if (sh == 2) return sdTri(p);
    if (sh == 3) return sdHex(p);
    if (sh == 4) return sdStar(p);
    if (sh == 5) return sdDiamond(p);
    if (sh == 6) return sdCross(p);
    if (sh == 7) return sdRing(p);
    if (sh == 8) return sdPill(p);
    return sdHeart(p);
}

// A "distance-like" scalar field per shape. Used by gradient + line engines.
// ~0 at the centre and growing outwards (range roughly 0..2 across the screen).
float metric(vec2 p, int sh){
    if (sh == 10) return p.y * 0.5 + 1.0;                                     // Linear
    if (sh == 11) return (atan(p.y, p.x) / TAU + 0.5) * 2.0;                  // Angular
    if (sh == 12) return (atan(p.y, p.x) / TAU + 0.5 + length(p) * 0.35) * 2.0; // Spiral
    if (sh == 13) return (p.y * 0.5 + 1.0) + 0.22 * sin(p.x * 2.4 + gT * 0.6); // Wave
    return max(shapeSD(p, sh) + 0.9, 0.0) * 1.1;
}

// ---- palette ----------------------------------------------------------------
vec3 gcol(int i){
    i = i - (i / 4) * 4;
    if (i == 0) return gC0;
    if (i == 1) return gC1;
    if (i == 2) return gC2;
    return gC3;
}

// t is any real number; it is ping-ponged into 0..1 (so colour never "jumps"),
// ColorShift slides it along the palette, Smoothness < ~0.6 posterises it.
vec3 pal(float t){
    t = t + gShift;
    t = 1.0 - abs(fract(t * 0.5) * 2.0 - 1.0);

    float steps = 6.0;
    float s = t * steps;
    float f = fract(s);
    float w = mix(0.03, 0.5, gSm);
    f = smoothstep(0.5 - w, 0.5 + w, f);
    float tq = (floor(s) + f) / steps;
    t = mix(tq, t, smoothstep(0.55, 0.95, gSm));
    t = clamp(t, 0.0, 1.0);

    if (gNCol == 2) return mix(gC0, gC1, t);
    if (gNCol == 3){
        float x = t * 2.0;
        return mix(mix(gC0, gC1, clamp(x, 0.0, 1.0)), gC2, clamp(x - 1.0, 0.0, 1.0));
    }
    float x = t * 3.0;
    return mix(mix(mix(gC0, gC1, clamp(x, 0.0, 1.0)), gC2, clamp(x - 1.0, 0.0, 1.0)), gC3, clamp(x - 2.0, 0.0, 1.0));
}

//@PALETTES@
// Reference Collection primitives. No bitmap/video sampling.
float bgNoise(vec2 p){return fbm3(vec3(p,gT*.09),3.,.48);}
float bgSoft(){return .008+gBl*.065+(1.-gSm)*.025;}
float bgLine(float d,float width){return exp(-abs(d)/max(width,.0001));}
vec3 bgTriColor(float f,vec3 a,vec3 b,vec3 c){return mix(mix(a,b,smoothstep(0.,.5,f)),c,smoothstep(.5,1.,f));}
vec3 bgGradient(vec2 p,float mode,vec3 a,vec3 b,vec3 c){
 float t=gT*.13;float f=0.;
 if(mode<.5) f=exp(-pow((p.y-.08*sin(t))*(2.5+gDens*2.),2.));
 else if(mode<1.5)f=(1.-smoothstep(-.8,.5,p.y-.22*sin(p.x*1.4+t)));
 else if(mode<2.5)f=exp(-max(p.y+1.,0.)*(1.7+.3*sin(t)));
 else if(mode<3.5)f=clamp(.5+p.x/(2.*max(gAsp,1.))+.025*sin(t),0.,1.);
 else if(mode<4.5)f=.5+.5*tanh((p.y-.48*sin(p.x*1.7+t)-.14*cos(p.x*2.7-t))*(3.-gBl*1.8));
 else if(mode<5.5){vec2 q=p+.3*vec2(sin(p.y+t),cos(p.x-t));f=.5+.5*sin(length(q+vec2(.6,.3))*3.-t);}
 else if(mode<6.5)f=pow(.5+.5*sin(p.x*3.+.65*sin(p.x*1.2+t)+t),1.6);
 else if(mode<7.5)f=exp(-dot(p,p)*(4.5-gBl*2.))*(.94+.06*sin(t));
 else if(mode<8.5){float x=fract(p.x*.7+t*.18)-.5; f=exp(-abs(p.y+x*x*5.-.2*sin(t))*2.);}
 else{float w=p.y-.4*sin(p.x*1.6+t);f=.5+.5*sin(w*3.+t);vec3 col=bgTriColor(f,a,b,c);return col*(.25+.75*(1.-bgLine(w,.055)))+c*bgLine(w-.035,.018)*.4;}
 vec3 col=bgTriColor(f,a,b,c);
 if(mode>3.5&&mode<5.5)col+=(hash12(floor(p*700.))-.5)*.025;
 return col;
}
vec3 bgFacets(vec2 p,float mode){
 vec2 q=p*(4.+gDens*8.);q.x+=q.y*.5;q+=vec2(gT*.025,0.);vec2 id=floor(q),f=fract(q);float tri=step(f.x,f.y);float h=hash12(id+tri*13.);
 vec2 center=(id+vec2(tri*.3+.25,.6))/12.;
 vec3 col=mix(vec3(.12,.52,.88),vec3(.47,.03,.52),clamp(.5+center.x*.3-center.y*.5,0.,1.));
 col=mix(col,vec3(.72,.94,.89),clamp(center.y*.5-center.x*.3,0.,.9));
 float edge=min(min(f.x,1.-f.x),min(min(f.y,1.-f.y),abs(f.x-f.y)*.707));
 if(mode>.5&&mode<1.5)col=vec3(.08,.13,.17)*(.55+h*.8)*(1.-.7*bgLine(edge,.025));
 else if(mode>1.5)col=bgTriColor(h,vec3(.18,.015,.13),vec3(.85,.12,.16),vec3(1.,.65,.27))*(.5+.5*sin(f.x*3.+f.y*2.+gT*.1));
 else col*=.85+h*.3;
 return col;
}
vec3 bgHalftone(vec2 p,float mode){
 float n=5.+gDens*9.;vec2 q=(p+vec2(gT*.008,0.))*n;vec2 id=floor(q);vec2 f=fract(q)-.5;
 float fade=mode<.5?clamp(.5-p.y*.5+.1*sin(p.x*2.+gT*.2),0.,1.):clamp(.5-p.x/(2.*gAsp),0.,1.);
 float size=mix(.015,.69,fade)*(.75+.25*hash12(id));float d=length(f);
 if(mode>.5){f.x*=mod(id.x+id.y,2.)<1.?1.:-1.; d=max(-f.x*.85,abs(f.y)*.866+f.x*.5);size*=.6;}
 float m=1.-smoothstep(size-bgSoft(),size+bgSoft(),d);
 if(mode<.5)return mix(vec3(.015,.23,.46),mix(vec3(.1,.55,.73),vec3(.98),fade),m);
 return mix(vec3(.98),vec3(.08,.6,.92)*(.8+.2*hash12(id)),m);
}
vec3 bgFolds(vec2 p,float mode){
 vec2 q=p;float row=floor(q.y*1.8);float y=fract(q.y*1.8)-.5;
 float bend=.3*tanh(q.x*3.+sin(row*2.+gT*.12));float d=y-bend;
 float v=.025+.075*exp(-abs(d)*3.)+.5*bgLine(d,.012+gBl*.012);
 return vec3(v)+(hash12(floor(p*650.))-.5)*.008;
}
vec3 bgBlades(vec2 p){
 vec2 q=rot2(.65)*p;float v=fract(q.x*(4.+gDens*8.));float glow=exp(-length(p-vec2(1.7+.5*sin(gT*.15),1.2))*.8);
 return vec3(.02,.025,.04)*(.2+v)+vec3(1.,.13,.23)*glow*(pow(v,4.)*.6+bgLine(v,.014)*.7);
}
vec3 bgWorld(vec2 p,float mode){
 vec3 a=vec3(.52,.62,.87),b=vec3(.63,.9,.88),c=vec3(.57,.32,.88);
 float wave=.5+.5*sin(p.y*2.+sin(p.x+gT*.1));vec3 col=bgTriColor(wave,a,b,c);
 vec2 q=p-vec2(-.2,.15);float rad=mode>.5?.85:.55;float d=length(q);
 float z=sqrt(max(0.,1.-dot(q/rad,q/rad)));vec3 sphere=bgTriColor(.5+q.x*.4+q.y*.3,a,b,c)*( .65+.35*z);
 sphere=mix(sphere,vec3(.97,.87,.54),clamp(-q.x-q.y,0.,1.)*.65);
 col=mix(col,sphere,1.-smoothstep(rad-.005,rad+.005,d));
 if(mode<.5){q=p-vec2(-.77,.7);float m=1.-smoothstep(.07,.075,length(q));col=mix(col,vec3(.85,.82,.6),m);}
 return col;
}
vec3 bgColumns(vec2 p,float mode){
 float n=7.+gDens*17.;float cell=floor(p.x*n);float f=fract(p.x*n);float x=cell/n;
 float wave=p.y-.45*sin(x*1.7+gT*.18);float light=.5+.5*tanh(wave*3.);vec3 col;
 if(mode<.5)col=bgTriColor(light,vec3(1.,.96,.85),vec3(1.,.46,.015),vec3(.13,.25,.7));
 else if(mode<1.5)col=mix(vec3(.015,.03,.08),vec3(.55,.87,.91),light);
 else if(mode<2.5){float h=hash11(cell);col=bgTriColor(.5+.5*sin(p.y*2.+gT*(.2+h*.2)+cell*.7),vec3(.015,.03,.08),vec3(.15,.5,.7),vec3(1.,.5,.15));col*=step(.15,h);}
 else if(mode<3.5)col=mix(vec3(.015,.01,.28),vec3(.5,.9,1.),pow(abs(wave)*.8,2.));
 else col=bgTriColor(light,vec3(.02,.0,.03),vec3(1.,.13,.015),vec3(.95,.68,.28));
 return col*(.7+.3*pow(f,.7))+vec3(.1)*bgLine(f,.015);
}
vec3 bgLines(vec2 p,float mode){
 if(mode<.5){vec2 q=p;float a=atan(q.y,q.x);float r=length(q);float phase=r*(25.+gDens*30.)+a*2.+gT*.15;float line=pow(.5+.5*cos(phase),12.);return mix(vec3(.98),vec3(.03,.2,.65),line*(.25+.75*abs(sin(a))));}
 float wave=p.y-.4*sin(p.x*2.+gT*.12);float line=pow(.5+.5*cos(wave*(65.+gDens*90.)),16.);float envelope=exp(-wave*wave*2.);
 return vec3(.015,.035,.12)+vec3(.05,.8,.9)*line*envelope*(.3+.7*pow(.5+.5*sin(p.x*2.+gT*.12),2.));
}
vec3 bgStars(vec2 p,float mode){
 vec3 col=vec3(.0);for(int layer=0;layer<3;layer++){
 float z=float(layer)+1.;vec2 q=p*(12.+gDens*15.)/z+vec2(gT*.015*z,0.);vec2 id=floor(q);vec2 f=fract(q)-.5;vec2 at=(hash22(id+z)-.5)*.6;float d=length(f-at);float h=hash12(id+z*7.);float sparkle=.5+.5*sin(gT*(.3+h)+h*50.);float star=exp(-d*d/(.0008+.002*z))*(.4+.6*sparkle)*step(.65,h);
 col+=vec3(.45,.6,1.)*star/z;}
 return col*(mode>.5?exp(-p.y*p.y*.7):1.);
}
vec3 bgRain(vec2 p,float mode){
 float n=18.+gDens*32.;float id=floor(p.x*n);float x=fract(p.x*n)-.5;float h=hash11(id);float y=fract(p.y*.5+gT*(.12+h*.15)+h*9.);float v=bgLine(x,.022+gBl*.03)*pow(y,12.)*step(.1,h)*3.;
 return (mode<.5?vec3(.95):bgTriColor(h,vec3(1.,.08,.02),vec3(1.,.5,.1),vec3(.2,.4,1.)))*v;
}
vec3 bgRefraction(vec2 p,float mode){
 vec2 q=p+.55*vec2(bgNoise(p*1.5),bgNoise(p*1.5+4.));float n=bgNoise(q*2.);float caustic=pow(1.-abs(sin(n*11.+p.x)),6.);float v=caustic*.5+pow(n,3.);
 if(mode<.5)return vec3(.5,.57,.7)*v*.75;
 return bgTriColor(n,vec3(.05,.12,.18),vec3(.65,.23,.07),vec3(1.,.7,.44))*v*1.6;
}
vec3 bgLiquid(vec2 p,float mode){
 vec2 q=p*2.;q+=vec2(bgNoise(q),bgNoise(q+9.))*1.3;
 float n=bgNoise(q*2.);float ridge=pow(1.-abs(sin(n*18.+p.y)),5.);float shade=clamp(.5+(bgNoise(q+vec2(.045,0.))-n)*14.,0.,1.);
 if(mode<.5)return vec3(.85,.22,.07)*(ridge*.45+shade*.5)*(.3+n);
 if(mode<1.5)return bgTriColor(shade,vec3(.015,.035,.1),vec3(.52,.52,.68),vec3(1.,.86,.75))*(.4+ridge*.9);
 return bgTriColor(shade,vec3(.005,.005,.04),vec3(.04,.03,.6),vec3(.6,.57,1.))*(.3+ridge*.9);
}
float bgWave(vec2 p){return sin(p.x*3.+sin(p.y*2.+gT*.23))*.22+sin(p.y*5.-gT*.4+p.x)*.15+sin(p.x*9.+p.y*7.-gT*.35)*.035;}
vec3 bgWater(vec2 p,float mode){
 vec2 q=p;float horizon=1.;
 if(mode>2.5){if(p.y>.05)return mix(vec3(.07,.37,.67),vec3(.43,.9,.95),exp(-p.y*4.));float depth=max(.06,.1-p.y);q=vec2(p.x/depth,2./depth);horizon=smoothstep(0.,.18,depth);}
 if(mode<1.5)q.y*=2.5;else q*=2.;
 float h=bgWave(q);float dx=(bgWave(q+vec2(.015,0.))-h)/.015;float dy=(bgWave(q+vec2(0.,.015))-h)/.015;vec3 normal=normalize(vec3(-dx,-dy,1.));
 float spec=pow(max(dot(normal,normalize(vec3(-.3,.5,1.))),0.),mode<1.5?28.:12.);
 if(mode<.5)return vec3(.42,.48,.65)*spec+vec3(.004);
 if(mode<1.5)return vec3(.02,.4,.85)*spec*.7;
 vec3 col=vec3(.015,.22,.39)*( .6+normal.z*.4)+vec3(.36,.8,.95)*spec;
 return mix(vec3(.4,.88,.95),col,horizon);
}
vec3 bgRings(vec2 p){
 float r=length(p-vec2(0.,-.85));float w=fract(r*(2.+gDens*3.)-gT*.12);return vec3(.03,.35,.95)*(pow(w,.6)*.8+.1)+vec3(.25,.65,1.)*bgLine(w,.025);
}
vec3 bgPaint(vec2 p){
 vec2 q=rot2(.6)*p*vec2(2.,6.);float n=bgNoise(q+bgNoise(q)*2.);float strokes=bgNoise(q*vec2(1.,3.));return bgTriColor(n,vec3(.015,.03,.14),vec3(.18,.5,.6),vec3(.94,.94,.83))*(.6+.5*strokes);
}
vec3 bgFilaments(vec2 p){
 float n=18.+gDens*24.;float x=fract(p.x*n)-.5;float h=.35*sin(p.x*2.+gT*.13)+.12*sin(p.x*6.-gT*.3);float v=bgLine(x,max(.045+gBl*.03,fwidth(p.x)*n*.5))*exp(-abs(p.y-h)*1.5);return bgTriColor(clamp(.5-p.y*.5,0.,1.),vec3(.2,.015,.015),vec3(.85,.2,.025),vec3(1.,.85,.23))*v*1.4;
}
vec3 bgRoom(vec2 p){
 vec2 q=p/vec2(gAsp,1.);vec2 a=abs(q);float wall=max(a.x,a.y);float inner=.65;float frame=bgLine(wall-inner,.015);float v=.75-.45*smoothstep(inner,1.,wall);float diagonal=bgLine(a.x-a.y,.008)*smoothstep(inner,1.,wall);return vec3(.46,.8,.84)*(v+.15*sin(gT*.15+q.x)*smoothstep(inner,1.,wall))-vec3(.1)*frame-vec3(.12)*diagonal;
}
vec3 bgCascade(vec2 p){
 vec2 q=p*vec2(3.,6.);q.y+=gT*.35;float n=bgNoise(q);float v=pow(n,2.)*exp(-p.y*p.y*1.1)*2.5;return vec3(.55,.88,.9)*v;
}
vec3 bgMatrix(vec2 p){
 vec2 q=(p/vec2(gAsp,1.)*.5+.5)*vec2(5.,3.);vec2 id=floor(q),f=fract(q);float h=hash12(id);float v=.5+.5*sin((f.x*(4.+h*20.)+f.y*h*10.)*6.+gT*(.2+h));if(h>.6)v=.5+.5*sin(length(f-.5)*40.-gT*.6);float mask=step(.06,f.x)*step(f.x,.94)*step(.06,f.y)*step(f.y,.94);return bgTriColor(h,vec3(.7,.13,.02),vec3(.08,.15,.5),vec3(.55,.25,.65))*v*mask;
}
vec3 bgRays(vec2 p,float mode){
 vec2 q=p-(mode<.5?vec2(-1.8,1.3):mode>1.5?vec2(0.,-1.2):vec2(0.));float a=atan(q.y,q.x);float rad=length(q);float v;
 if(mode<.5){v=pow(.5+.5*sin(a*90.+sin(a*34.+gT*.12)*4.),5.)*exp(-rad*.3);return vec3(v*.7);}
 if(mode<1.5){v=pow(.5+.5*sin(a*90.+sin(a*19.)*6.+rad*.5-gT*.5),4.)*smoothstep(.03,.5,rad);return vec3(.12,.2,.8)*v+vec3(.15,.5,1.)*pow(v,8.);}
 float band=floor(a*(9.+gDens*15.));float h=hash11(band);v=.4+.6*sin(rad*2.-gT*.8+band);return bgTriColor(h,vec3(.015,.025,.16),vec3(.05,.7,.5),vec3(.85,.07,.6))*v;
}
vec3 bgBeams(vec2 p){
 float n=15.+gDens*20.;float id=floor(p.x*n);float x=fract(p.x*n)-.5;float gate=smoothstep(.55,.65,.5+.5*sin(id*.13+gT*.5));float v=bgLine(x,.045+gBl*.04)*(1.-smoothstep(.43,.5,abs(p.y)))*gate;return vec3(.8,.8,1.)*v;
}
vec3 bgRaster(vec2 p){
 vec2 q=p*vec2(7.,25.)+vec2(.0001);vec2 id=floor(q);float v=step(.47,hash12(vec2(id.x,floor(id.y*.2))+floor(gT*.7)));float line=1.-smoothstep(.65,.9,fract(q.y));return vec3(v*line*.9);
}
vec3 bgSmoke(vec2 p,float mode){
 vec2 q=p*1.8;q+=vec2(bgNoise(q+3.),bgNoise(q+7.))*1.8;float n=bgNoise(q*2.);float ridge=pow(1.-abs(sin(n*13.)),4.);float glow=pow(n,2.);
 if(mode<.5)return bgTriColor(smoothstep(.2,.75,n),vec3(.035,.012,.005),vec3(.55,.32,.12),vec3(1.,.94,.65));
 if(mode<1.5)return vec3(.3,.0,.9)*ridge+vec3(1.,.05,.3)*pow(ridge,7.)*.6;
 return bgTriColor(glow*1.8,vec3(.055,.002,.07),vec3(.35,.01,.6),vec3(.85,.45,1.)) +vec3(.2,.02,.5)*ridge;
}
vec3 bgFrames(vec2 p,float mode){
 vec2 q=mode<.5?p:p.yx;vec2 freq=mode<.5?vec2(1.5,1.):vec2(1.5,.55);q*=freq;vec2 id=floor(vec2(q.x,0.));vec2 f=vec2(fract(q.x)-.5,q.y);float d=max(abs(f.x)-.38,abs(f.y)-.78);float edge=bgLine(d,.009+gBl*.015);float inside=1.-smoothstep(0.,.02,d);float shine=.5+.5*sin(q.y*2.+gT*.3+id.x);vec3 col=mode<.5?vec3(1.,.2,.025):vec3(.05,.85,.64);return col*(edge*(.3+.7*shine)+inside*.13*shine);
}
vec3 bgDiamonds(vec2 p){
 vec2 q=rot2(.6)*p*(7.+gDens*7.)+vec2(gT*.08,0.);vec2 id=floor(q),f=fract(q)-.5;float h=hash12(id);float v=exp(-dot(f,f)*35.)*step(.5,h)*(.5+.5*sin(gT*.3+h*15.));float dots=pow(.5+.5*cos(f.x*55.)*cos(f.y*55.),3.);return vec3(v*dots);
}
vec3 bgTunnel(vec2 p,float mode){
 vec2 q=rot2(mode<.5?.65:.25)*p;float r=max(abs(q.x),abs(q.y));float f=fract(log(max(r,.03))*6.-gT*.137);float line=bgLine(f,.04);float sparkle=pow(hash12(floor(q*100.)),18.);float fade=smoothstep(.15,.5,r)*(1.-smoothstep(1.,2.,r));return (mode<.5?vec3(.36,.7,.8):vec3(.5,.15,1.))*(line+sparkle*.4)*fade;
}
vec3 bgMesh(vec2 p,float mode){
 vec2 q=rot2(.35)*p;float n=bgNoise(q*2.);vec3 col=bgTriColor(n,vec3(.015,.02,.2),vec3(.55,.02,.42),vec3(.1,.8,.5));
 if(mode>.5&&mode<1.5){vec2 id=floor(q*2.);col=mix(vec3(.08,.015,.4),vec3(.85,.02,.45),.5+.5*sin(hash12(id)*7.+gT*.13));}
 float dotMask=.35+.65*pow(.5+.5*cos(q.x*220.)*cos(q.y*220.),2.);
 if(mode>1.5)col=bgTriColor(.5+.5*sin(q.x*2.+q.y+gT*.15),vec3(.01,.03,.3),vec3(.05,.24,.65),vec3(.5,.3,.65));return col*dotMask;
}
vec3 bgRibbons(vec2 p,float mode){
 float a=atan(p.y+.2*sin(gT*.1),p.x+.4);float rad=length(p);float w=.5+.5*sin(a*2.+rad*2.+gT*.1);float sector=floor((a+PI)*3.);vec3 col=mix(vec3(.015,.04,.18),vec3(.04,.5,.55),w*.7);if(mode>.5)col+=vec3(0.,.3,.08)*hash11(sector)*smoothstep(.3,1.5,rad);return col*(.7+.3*fract(rad*.7+a*.3));
}
vec3 bgBrush(vec2 p,float mode){
 vec2 q=rot2(.65)*p*vec2(2.,8.);float n=bgNoise(q+vec2(gT*.1,0.));vec3 col=bgTriColor(n,vec3(.08,.005,.2),vec3(.8,.025,.17),vec3(.5,.1,.7));
 if(mode>.5){col=bgTriColor(n,vec3(.95,.25,.25),vec3(.52,.8,.66),vec3(.55,.95,.82));float m=1.-smoothstep(.69,.7,length(p));col=mix(col,col.bgr*.9,m);}return col;
}
vec3 bgDunes(vec2 p,float mode){
 vec2 q=mode<.5?rot2(.1)*p:rot2(.9)*p;float wave=q.y+.25*sin(q.x*1.3+gT*.1);float f=fract(wave*(1.4+gDens*2.)-gT*.04);float v=pow(f,2.)*(.6+.4*sin(q.x*.8+gT*.1));return (mode<.5?vec3(.33,.015,.9):vec3(1.,.6,.09))*v;
}
