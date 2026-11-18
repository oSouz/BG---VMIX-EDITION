// Souz Content V14: procedural geometry, no reference image sampling.
vec3 eng_v00(vec2 p){

 float r=metric(p+0.025*vec2(sin(gT*.2),cos(gT*.17)),gShape);
 float wave=.5+.5*cos(r*(5.+gDens*8.)-gT*.55+2.*fbm(p*1.5,gT*.08));
 return vec3(pow(wave,1.6)*exp(-length(p)*.3));
}
vec3 eng_v01(vec2 p){
vec2 q=p*(2.+gDens*4.); q+=vec2(gT*.04,.12*sin(gT*.2)); vec2 id=floor(q), f=fract(q); float side=step(f.x,f.y); float h=hash12(id+side*7.); float light=.5+.3*sin(id.x*.5+id.y*.3+gT*.15); return vec3(clamp(light+(h-.5)*.35,0.,1.));
}
vec3 eng_v02(vec2 p){

 float id=floor(p.x*(1.5+gDens*2.5));float w=fract(p.x*(1.5+gDens*2.5));
 float motion=.5+.5*sin(p.y*2.2+gT*(.2+hash11(id)*.6)+id*2.4);
 float edge=smoothstep(0.,.04+gBl*.12,w)*(1.-smoothstep(.9,1.,w));
 return vec3(edge*(.08+.9*motion)*(.3+.7*hash11(id+gSeed)));
}
vec3 eng_v03(vec2 p){

 float row=floor(p.y*(2.+gDens*4.));vec2 q=vec2(p.x+gT*(hash11(row)*.18-.09),p.y);
 vec2 cell=vec2(1.5+gDens*3.,2.+gDens*4.);vec2 id=floor(q*cell),f=fract(q*cell);
 float bars=step(.16,f.y)*step(f.y,.92);float v=hash12(vec2(id.x+floor(row*.3),row)+floor(gT*.25));
 return vec3(bars*(.08+.9*v));
}
vec3 eng_v04(vec2 p){

 vec2 q=p*vec2(1.+gDens*.8,1.3+gDens*.8);vec2 id=floor(q),f=fract(q)-.5;
 float tile=(1.-smoothstep(.4,.49,max(abs(f.x),abs(f.y))));
 float l=.5+.5*sin(gT*.7+hash12(id+gSeed)*TAU);
 return vec3(tile*(.1+.9*l)*(.85+.15*cos(length(f)*5.)));
}
vec3 eng_v05(vec2 p){

 vec2 q=p*1.8+vec2(gT*.035,0.);float n=fbm(q+gSO,gT*.04);
 float cloud=smoothstep(.34,.7,n);float light=fbm(q+vec2(.12,.05)+gSO,gT*.04);
 return vec3(.16+cloud*(.45+.35*light));
}
vec3 eng_v06(vec2 p){

 vec2 q=p+vec2(sin(p.y*2.+gT*.13),cos(p.x*2.-gT*.12))*.2;
 float n=fbm(q*2.+gSO,gT*.12);float caustic=pow(1.-abs(sin(n*20.+p.x*2.)),12.);
 float veil=pow(fbm(q*3.+gSO,gT*.1),3.);
 return vec3(caustic*.14+veil*1.5);
}
vec3 eng_v07(vec2 p){
vec2 q=p; q+=.32*vec2(sin(q.y*2.+gT*.18),cos(q.x*1.7-gT*.14)); float a=sin(q.x*1.8+q.y+gT*.12)+cos(q.y*2.-q.x*.7-gT*.2); return vec3(.5+.48*sin(a*1.6));
}
vec3 eng_v08(vec2 p){
float n=5.+gDens*14.; float id=floor(p.x*n); float f=fract(p.x*n); float curve=.6*sin(id/n*1.8+gT*.22); float edge=p.y-curve; float fold=.15+.75*pow(f,.6); float mask=.5+.5*tanh(edge*9.); return vec3(mix(fold,1.-fold,mask));
}
vec3 eng_v09(vec2 p){

 vec2 q=p*vec2(2.,5.)+gSO;float n=fbm(q+vec2(0.,gT*.3),gT*.1);
 float foam=pow(1.-abs(sin(n*16.+p.y*2.+gT*.4)),4.);
 float center=exp(-p.y*p.y*.5);
 return vec3(center*(.08+.9*foam));
}
vec3 eng_v10(vec2 p){

 vec2 q=p-vec2(0.,-1.2);float angle=atan(q.y,q.x);float r=length(q);
 float rays=pow(.5+.5*sin(angle*(8.+gDens*12.)+sin(r*2.-gT*.25)),3.);
 return vec3(exp(-r*.48)*(.15+rays*.65)*(.55+fbm(p*2.+gSO,gT*.08)));
}
vec3 eng_v11(vec2 p){
vec2 q=p*vec2(2.+gDens*2.,.8); float id=floor(q.x); vec2 f=vec2(fract(q.x)-.5,q.y-.4*sin(id*.7+gT*.3)); vec2 b=abs(f)-vec2(.28,.7); float d=length(max(b,0.))+min(max(b.x,b.y),0.)-.18; float m=1.-smoothstep(-.01,.02,d); return vec3(m*(.25+.7*smoothstep(-1.,1.,f.y)));
}
vec3 eng_v12(vec2 p){
vec2 q=p; q.y+=.3*sin(q.x*2.+gT*.3); q.x+=.2*cos(q.y*2.-gT*.17); float n=12.+gDens*22.; vec2 id=floor(q*n),f=fract(q*n)-.5; float radius=.14+.22*(.5+.5*sin(id.x*.14+id.y*.18+gT*.35)); float dotMask=1.-smoothstep(radius-.025,radius+.025,length(f)); return vec3(dotMask*(.35+.6*(.5+.5*cos(q.y*2.+gT*.2))));
}
vec3 eng_v13(vec2 p){
float col=.12+.1*smoothstep(-1.,1.,p.y); for(int i=0;i<7;i++){float k=float(i);vec2 c=vec2(sin(k*2.4+gT*.12)*1.25,cos(k*1.7+gT*.15)*.65);float rad=.12+.25*hash11(k+3.);vec2 v=(p-c)/rad;float rr=dot(v,v);float m=1.-smoothstep(.96,1.04,rr);float z=sqrt(max(0.,1.-rr));float l=.14+.3*z+.55*exp(-dot(v-vec2(-.3,.4),v-vec2(-.3,.4))*18.);col=mix(col,l,m);}return vec3(col);
}
vec3 eng_v14(vec2 p){

 float n=fbm(p*2.+gSO+vec2(gT*.04,0.),gT*.09);
 float boltY=.12*sin(p.x*13.+gT*.06)+.08*sin(p.x*31.)+.15*(fbm(vec2(p.x*6.,0.)+gSO,0.)-.5);
 float flash=pow(max(0.,sin(gT*.85)),32.);
 float bolt=exp(-abs(p.y-boltY)*(70.-gBl*30.))*flash;
 return vec3(.08+.6*n+bolt*.9);
}
vec3 eng_v15(vec2 p){

 vec2 b=abs(p)-vec2(gAsp*.32,.12);float d=length(max(b,0.))+min(max(b.x,b.y),0.);float rings=.5+.5*cos(d*(35.+gDens*30.)-gT*.4);
 float box=pow(rings,10.);float inner=.5+.5*sin(d*5.-gT*.08);
 return vec3(box*(.25+.75*inner)*exp(-d*.4));
}
vec3 eng_v16(vec2 p){

 vec2 c=vec2(.12*sin(gT*.1),.08*cos(gT*.13));float r=metric(p-c,gShape);
 return vec3(exp(-r*r*(3.+gDens*3.))*.95);
}
vec3 eng_v17(vec2 p){
vec2 q=p;float n=7.+gDens*15.;float x=abs(fract(q.x*n)-.5);float line=exp(-x*x*250.);float glow=exp(-x*x*25.)*.17;float ends=1.-smoothstep(.7,.76,abs(q.y));float chase=.15+.85*pow(.5+.5*sin(q.x*2.5-gT*.7),2.);return vec3((line+glow)*ends*chase);
}
vec3 eng_v18(vec2 p){
return vec3(.5+.46*sin(p.x*.8+gT*.16));
}
vec3 eng_v19(vec2 p){
vec2 q=p-vec2(0.,-1.15);float r=length(q);float f=fract(r*(2.+gDens*5.)-gT*.12);return vec3(pow(1.-f,1.7)*(.5+.5*smoothstep(-1.,1.,q.y)));
}
vec3 eng_v20(vec2 p){
vec2 q=p; q+=.24*vec2(sin(p.y*2.+gT*.25),sin(p.x*2.-gT*.2)); q=rot2(.2*sin(length(p)*2.-gT*.2))*q; q*=3.+gDens*5.; vec2 f=fract(q);float a=smoothstep(.48,.52,f.x),b=smoothstep(.48,.52,f.y);return vec3(.15+.75*(a+b-2.*a*b));
}
vec3 eng_v21(vec2 p){
vec2 q=p*(2.+gDens*3.);q.x+=.22*sin(q.y*3.14+gT*.25);float row=floor(q.y);vec2 f=fract(q+vec2(mod(row,2.)*.5,0.));float boundary=.5+.24*cos(f.y*TAU);return vec3(.15+.75*smoothstep(boundary-.015,boundary+.015,f.x));
}
vec3 eng_v22(vec2 p){

 vec2 q=p/vec2(max(gAsp,1.),1.);float d=max(abs(q.x),abs(q.y));float portal=pow(.5+.5*cos(log(max(d,.025))*20.+gT*.3),5.);
 float plane=.12+.8*abs(q.y)/(max(abs(q.x),abs(q.y))+.02);
 return vec3((.22+.55*portal)*plane*smoothstep(0.,.12,d));
}
vec3 eng_v23(vec2 p){
vec2 q=p*(1.5+gDens*3.);q.y+=gT*.06;vec2 id=floor(q),f=fract(q);float ridge=abs(f.x-.5)*2.;float face=mix(.25,.8,step(.5,f.x));float shadow=1.-.6*exp(-f.y*12.)*(1.-ridge);return vec3(face*shadow);
}
vec3 eng_v24(vec2 p){
float col=.04;for(int i=0;i<8;i++){float k=float(i);vec2 c=vec2(.18*sin(k*.7+gT*.2),-.9+k*.24);vec2 q=(p-c)/vec2(.72,.45);float rr=length(q);float m=1.-smoothstep(.98,1.02,rr);float v=.15+.8*smoothstep(-1.,1.,q.y);col=mix(col,v,m);}return vec3(col);
}
vec3 eng_v25(vec2 p){
vec2 q=p*(1.+gDens*2.);q.y+=gT*.08;vec2 id=floor(q),f=fract(q);vec2 c=vec2(.5,mod(id.y,2.)<1.?1.:0.);float d=length(f-c);float m=1.-smoothstep(.48,.5,d);return vec3(m*(.2+.75*abs(f.y-c.y)));
}
vec3 eng_v26(vec2 p){
float col=.04;for(int i=0;i<3;i++){float k=float(i);vec2 c=vec2(.5*sin(k*2.+gT*.17),.4*cos(k*2.+gT*.13));vec2 q=rot2(.6+gT*.08+k*.8)*(p-c);float d=length(q/vec2(.85,.22));float m=1.-smoothstep(.97,1.03,d);col=mix(col,.25+.65*smoothstep(-.8,.8,q.x),m*.85);}return vec3(col);
}
vec3 eng_v27(vec2 p){
vec2 q=rot2(gT*.06)*p;float v=0.;for(int i=-1;i<=1;i++){float k=float(i)*.45;float a=length(vec2(q.x/1.3,(q.y-k)/.1));float b=length(vec2((q.x-k)/.1,q.y/1.3));v=max(v,max(1.-smoothstep(.8,1.,a),1.-smoothstep(.8,1.,b)));}return vec3(v*(.35+.6*exp(-dot(q,q)*.6)));
}
vec3 eng_v28(vec2 p){
vec2 q=rot2(gT*.12)*p;float a=atan(q.y,q.x);float r=length(q);float boundary=.42+.32*pow(.5+.5*cos(a*5.),2.);float m=1.-smoothstep(boundary-.01,boundary+.01,r);return vec3(.04+m*(.25+.7*smoothstep(-.7,.7,q.x+q.y)));
}
vec3 eng_v29(vec2 p){
vec2 q=p*(2.+gDens*4.);q+=vec2(gT*.035,0.);vec2 big=floor(q);vec2 f=fract(q);float orient=hash12(big);vec2 sub=orient>.5?vec2(f.x*2.,f.y):vec2(f.x,f.y*2.);vec2 cell=floor(sub),uv=fract(sub);float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));float shade=.15+.75*hash12(big*5.+cell);return vec3(shade*smoothstep(.015,.045,edge));
}
vec3 eng_v30(vec2 p){
float wave=p.y+.4*sin(p.x*1.6+gT*.18)+.2*sin(p.x*3.-gT*.13);float light=exp(-wave*wave*7.);float rim=exp(-pow((wave-.18)*12.,2.));return vec3(.02+light*.6+rim*.35);
}
vec3 eng_v31(vec2 p){
vec2 q=rot2(.7)*p*(1.4+gDens*2.);q.y+=gT*.1;vec2 id=floor(q/vec2(1.,2.));vec2 f=mod(q,vec2(1.,2.))-vec2(.5,1.);vec2 b=abs(f)-vec2(.05,.5);float d=length(max(b,0.))+min(max(b.x,b.y),0.)-.43;float m=1.-smoothstep(-.01,.02,d);return vec3(.12+m*(.25+.55*smoothstep(-1.,1.,f.y+.2*sin(gT*.2+id.x))));
}

// ---- v1.11.0 Reference Collection (ids 32-104): procedural interpretations, no bitmap/video sampling ----
vec3 eng_v32(vec2 p){return bgGradient(p,0.0,vec3(.015,.008,.005),vec3(1.,.62,.18),vec3(.95,.98,1.));}
vec3 eng_v33(vec2 p){return bgGradient(p,1.0,vec3(.01,.01,.02),vec3(1.,.1,.45),vec3(1.,.64,.48));}
vec3 eng_v34(vec2 p){return bgGradient(p,2.0,vec3(.02,.015,.01),vec3(1.,.62,.18),vec3(.95,.98,1.));}
vec3 eng_v35(vec2 p){return bgGradient(p,3.0,vec3(.98,.22,.4),vec3(.65,.25,.64),vec3(.23,.32,.96));}
vec3 eng_v36(vec2 p){return bgFacets(p,0.);}
vec3 eng_v37(vec2 p){return bgGradient(p,4.0,vec3(.01,.2,.6),vec3(.24,.4,.95),vec3(1.,.64,.48));}
vec3 eng_v38(vec2 p){return bgGradient(p,5.0,vec3(.015,.05,.16),vec3(.05,.8,.86),vec3(1.,.64,.48));}
vec3 eng_v39(vec2 p){return bgHalftone(p,0.);}
vec3 eng_v40(vec2 p){return bgHalftone(p,1.);}
vec3 eng_v42(vec2 p){return bgFolds(p,0.);}
vec3 eng_v43(vec2 p){float w=p.y-.4*sin(p.x*1.6+gT*.15);float veil=exp(-abs(w)*4.)*(.6+.4*bgNoise(p*vec2(3.,.5)));return vec3(0.,.8,.65)*veil+bgStars(p,0.)*.2;}
vec3 eng_v44(vec2 p){vec2 q=p; q.y=abs(q.y);float d=length(q-vec2(0.,.75+.07*sin(gT*.15)));float v=exp(-pow((d-.66)*7.,2.));return mix(vec3(.25,.17,.9),vec3(.05,.5,1.),smoothstep(-.2,.2,p.y))*v+vec3(.015,.015,.25);}
vec3 eng_v45(vec2 p){return bgBlades(p);}
vec3 eng_v46(vec2 p){return bgFacets(p,1.);}
vec3 eng_v47(vec2 p){vec3 c=vec3(.01,.035,.15);for(int i=0;i<2;i++){vec2 q=p-vec2(float(i)*1.65-.8,.35-float(i)*.7);float d=abs(length(q)-.85);float m=1.-smoothstep(.18,.2,d);c=mix(c,mix(vec3(.1,.04,.3),vec3(.8,.04,.48),.5+.5*sin(q.x+gT*.1)),m);}return c;}
vec3 eng_v48(vec2 p){return bgWorld(p,0.);}
vec3 eng_v49(vec2 p){return bgColumns(p,0.);}
vec3 eng_v50(vec2 p){return bgLines(p,0.);}
vec3 eng_v51(vec2 p){return bgLines(p,1.);}
vec3 eng_v52(vec2 p){return bgColumns(p,1.);}
vec3 eng_v53(vec2 p){return bgRain(p,0.);}
vec3 eng_v54(vec2 p){return bgStars(p,1.);}
vec3 eng_v55(vec2 p){return bgRefraction(p,0.);}
vec3 eng_v56(vec2 p){return bgColumns(p,2.);}
vec3 eng_v57(vec2 p){return bgLiquid(p,0.);}
vec3 eng_v58(vec2 p){return bgGradient(p,6.0,vec3(.005),vec3(.25,.3,.36),vec3(.95,.98,1.));}
vec3 eng_v59(vec2 p){return bgWater(p,0.);}
vec3 eng_v60(vec2 p){return bgGradient(p,7.0,vec3(.0),vec3(1.,.62,.18),vec3(1.,.88,.56));}
vec3 eng_v61(vec2 p){return bgRings(p);}
vec3 eng_v62(vec2 p){return bgPaint(p);}
vec3 eng_v63(vec2 p){return bgFilaments(p);}
vec3 eng_v64(vec2 p){return bgRoom(p);}
vec3 eng_v65(vec2 p){return bgCascade(p);}
vec3 eng_v66(vec2 p){return bgMatrix(p);}
vec3 eng_v67(vec2 p){return bgRays(p,0.);}
vec3 eng_v69(vec2 p){return bgBeams(p);}
vec3 eng_v70(vec2 p){return bgLiquid(p,1.);}
vec3 eng_v71(vec2 p){return bgRaster(p);}
vec3 eng_v73(vec2 p){return bgSmoke(p,0.);}
vec3 eng_v74(vec2 p){return bgGradient(p,8.0,vec3(.01,.04,.3),vec3(.3,.01,.6),vec3(.05,.8,.86));}
vec3 eng_v75(vec2 p){return bgGradient(p,9.0,vec3(.005,.008,.02),vec3(.3,.01,.6),vec3(.05,.8,.86));}
vec3 eng_v76(vec2 p){return bgFrames(p,0.);}
vec3 eng_v77(vec2 p){return bgFrames(p,1.);}
vec3 eng_v78(vec2 p){return bgWater(p,2.);}
vec3 eng_v79(vec2 p){return bgWater(p,3.);}
vec3 eng_v81(vec2 p){return bgFacets(p+vec2(bgNoise(p*2.),bgNoise(p*2.+5.))*.3,2.);}
vec3 eng_v82(vec2 p){return bgRain(rot2(.65)*p,1.);}
vec3 eng_v83(vec2 p){return bgDiamonds(p);}
vec3 eng_v85(vec2 p){p=rot2(-.7)*p;return bgGradient(p,6.0,vec3(.01,.01,.02),vec3(1.,.64,.48),vec3(.05,.8,.86));}
vec3 eng_v87(vec2 p){return bgTunnel(p,0.);}
vec3 eng_v88(vec2 p){return bgTunnel(p,1.);}
vec3 eng_v89(vec2 p){return bgRays(p,1.);}
vec3 eng_v90(vec2 p){return bgRays(p,2.);}
vec3 eng_v91(vec2 p){return bgMesh(p,0.);}
vec3 eng_v92(vec2 p){return bgMesh(p,1.);}
vec3 eng_v93(vec2 p){return bgMesh(p,2.);}
vec3 eng_v94(vec2 p){return bgRibbons(p,0.);}
vec3 eng_v95(vec2 p){return bgWorld(p,1.);}
vec3 eng_v96(vec2 p){return bgRibbons(p,1.);}
vec3 eng_v97(vec2 p){return bgBrush(p,0.);}
vec3 eng_v98(vec2 p){return bgBrush(p,1.);}
vec3 eng_v99(vec2 p){return bgColumns(p,3.);}
vec3 eng_v101(vec2 p){return bgSmoke(p,1.);}
vec3 eng_v103(vec2 p){return bgDunes(p,0.);}
vec3 eng_v104(vec2 p){return bgDunes(p,1.);}
