// Pattern functions adapted from the user-supplied HoloCard.
// Render only a transparent finish; live art and labels remain in CardView.
export const fragment = `#version 300 es\nprecision highp float;
float ramp(float a, float b, float x) {
  float t = clamp((x-a)/(b-a),0.0,1.0);
  return t*t*(3.0-2.0*t);
}
uniform vec2 uOrigin;


uniform sampler2D uArt;
uniform vec2 uSize;
uniform float uAspect;
uniform vec2 uTilt;
uniform vec2 uLight;
uniform float uDistance;
uniform int uPreset;
uniform float uIntensity;
uniform float uScale;
uniform float uEdge;
uniform float uFrame;
uniform float uRadius;
uniform float uGlare;
uniform vec3 uFoil;
uniform float uReady;

out vec4 outColor;

const float TAU = 6.28318530718;

struct Foil {
  float mask;
  float angle;
  float jitter;
  vec2 facet;
};

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

vec2 hash2(vec2 p) {
  return vec2(hash(p), hash(p + 17.31));
}

vec3 hue(float t) {
  t = abs(fract(t * 0.5) * 2.0 - 1.0);
  vec3 c = mix(vec3(0.1, 0.25, 1.0), vec3(0.0, 0.85, 1.0), ramp(0.0, 0.25, t));
  c = mix(c, vec3(0.25, 1.0, 0.2), ramp(0.25, 0.45, t));
  c = mix(c, vec3(1.0, 0.92, 0.05), ramp(0.45, 0.65, t));
  c = mix(c, vec3(1.0, 0.45, 0.05), ramp(0.65, 0.85, t));
  return mix(c, vec3(0.95, 0.12, 0.3), ramp(0.85, 1.0, t));
}

Foil bursts(vec2 p) {
  vec2 q = mat2(0.7071068, 0.7071068, -0.7071068, 0.7071068) * (p - vec2(0.5, 0.5 * uAspect)) / (0.283 / uScale);
  vec2 d = fract(q) - 0.5;
  float u = length(d) / 0.49;
  float angle = atan(d.y, d.x);
  if (u < 0.12) {
    float ring = min(floor(u / 0.045 + 0.5), 2.0);
    float count = max(1.0, ring * 6.0);
    float spot = (floor(angle / TAU * count) + 0.5) / count * TAU;
    vec2 dot = vec2(cos(spot), sin(spot)) * ring * 0.045;
    float m = ramp(0.024, 0.012, length(d / 0.49 - dot));
    return Foil(m, angle, 0.5, vec2(0.0));
  }
  bool inner = u < 0.66;
  float slot = angle / TAU * (inner ? 56.0 : 72.0);
  bool shifted = mod(floor(slot), 2.0) > 0.5;
  vec2 band = inner ? (shifted ? vec2(0.45, 0.61) : vec2(0.33, 0.49)) : (shifted ? vec2(0.84, 0.99) : vec2(0.7, 0.85));
  float across = abs(u - (band.x + band.y) * 0.5) / ((band.y - band.x) * 0.5);
  float along = abs(fract(slot) - 0.5) * 2.0;
  float width = inner ? 0.72 : 0.6;
  float m = ramp(1.0, 0.78, across) * ramp(width, width - 0.2, along);
  return Foil(m, angle, 0.5, vec2(0.0));
}

Foil stars(vec2 p) {
  Foil best = Foil(0.0, 0.0, 0.0, vec2(0.0));
  vec2 g = p / (0.08 / uScale);
  vec2 base = floor(g);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = base + vec2(float(i), float(j));
      float pick = hash(id + 1.3);
      vec2 d = g - (id + 0.5 + (hash2(id) - 0.5) * 0.55);
      float m = ramp(0.07, 0.035, length(d));
      if (pick < 0.62) {
        float size = mix(0.16, 0.5, pow(hash(id + 9.0), 1.8));
        float sector = TAU / (pick < 0.3 ? 4.0 : 5.0);
        float k = abs(fract((atan(d.y, d.x) + hash(id + 4.0) * TAU) / sector) - 0.5) * 2.0;
        float edge = size * mix(1.0, 0.36, pow(k, 0.6));
        m = ramp(edge, edge * 0.8, length(d));
      }
      if (m > best.mask) best = Foil(m, hash(id + 6.0) * TAU, hash(id + 8.0), (hash2(id + 2.0) - 0.5) * 0.6);
    }
  }
  return best;
}

Foil shards(vec2 p) {
  vec2 g = p * 19.0 * uScale;
  vec2 base = floor(g);
  float best = 9.0;
  float second = 9.0;
  vec2 id = base;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = base + vec2(float(i), float(j));
      float d = length(cell + 0.08 + hash2(cell) * 0.84 - g);
      if (d < best) {
        second = best;
        best = d;
        id = cell;
      } else if (d < second) {
        second = d;
      }
    }
  }
  float crack = ramp(0.015, 0.07, second - best);
  float shine = 0.25 + 0.75 * pow(hash(id + 7.7), 2.0);
  return Foil((0.2 + 0.8 * crack) * shine, hash(id + 3.17) * TAU, hash(id + 11.73), (hash2(id + 5.0) - 0.5) * 0.5);
}

Foil cosmos(vec2 p) {
  Foil best = Foil(0.0, 0.0, 0.0, vec2(0.0));
  vec2 g = p / (0.16 / uScale);
  vec2 base = floor(g);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = base + vec2(float(i), float(j));
      vec2 d = g - (id + 0.5 + (hash2(id) - 0.5) * 0.7);
      float size = mix(0.16, 0.52, hash(id + 2.0));
      float r = length(d);
      float m = max(ramp(0.05, 0.0, abs(r - size)), ramp(size, size - 0.04, r) * 0.22);
      if (m > best.mask) best = Foil(m, hash(id + 6.0) * TAU + atan(d.y, d.x) * 0.5, hash(id + 1.0), (hash2(id + 4.0) - 0.5) * 0.5);
    }
  }
  vec2 fine = p / (0.035 / uScale);
  vec2 cell = floor(fine);
  float dots = ramp(0.2, 0.1, length(fine - cell - 0.5 - (hash2(cell + 9.0) - 0.5) * 0.6)) * step(0.55, hash(cell + 2.0));
  if (dots > best.mask) best = Foil(dots, hash(cell) * TAU, hash(cell + 3.0), (hash2(cell + 7.0) - 0.5) * 0.6);
  return best;
}

Foil rainbow(vec2 p) {
  return Foil(0.86 + 0.14 * hash(floor(p * 700.0 * uScale)), 0.2, 0.5, vec2(0.0));
}

Foil swirl(vec2 p) {
  vec2 d = p - vec2(0.5, 0.42 * uAspect);
  float angle = atan(d.y, d.x);
  float rays = 0.55 + 0.45 * ramp(0.3, 0.7, abs(fract(angle / TAU * 60.0 * uScale) - 0.5) * 2.0);
  return Foil(rays, angle, length(d), vec2(0.0));
}

Foil glitter(vec2 p) {
  vec2 g = p * 72.0 * uScale;
  vec2 cell = floor(g);
  float size = mix(0.18, 0.4, hash(cell + 3.0));
  float m = ramp(size, size * 0.55, length(fract(g) - 0.5 - (hash2(cell) - 0.5) * 0.5)) * step(0.25, hash(cell + 5.0));
  return Foil(m, hash(cell + 7.0) * TAU, hash(cell + 9.0), (hash2(cell + 11.0) - 0.5) * 0.9);
}

Foil gold(vec2 p) {
  Foil flake = glitter(p * 0.8);
  if (flake.mask > 0.5) return flake;
  float etch = 0.55 + 0.45 * ramp(0.2, 0.8, abs(fract((p.x * 0.6 + p.y) * 140.0 * uScale) - 0.5) * 2.0);
  return Foil(etch, 0.9, 0.4, vec2(0.0));
}

vec3 sparkles(vec2 p, vec3 halfway, vec2 sweep, float awake) {
  vec2 g = p * 62.0;
  vec2 cell = floor(g);
  vec2 d = fract(g) - 0.5 - (hash2(cell) - 0.5) * 0.36;
  float spin = hash(cell + 3.0) * TAU;
  d = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * d;
  vec2 a = abs(d);
  float hexagon = max(a.x * 0.866 + a.y * 0.5, a.y);
  float size = mix(0.22, 0.38, hash(cell + 2.0));
  float piece = ramp(size, size - 0.07, hexagon) * step(0.42, hash(cell + 4.0));
  vec3 facet = normalize(vec3((hash2(cell + 6.0) - 0.5) * 0.9, 1.0));
  float flash = pow(max(dot(facet, halfway), 0.0), 6.0);
  vec3 tint = hue(dot(sweep, vec2(cos(spin), sin(spin))) * 1.2 + dot(sweep, vec2(0.8, 0.6)) * 0.8 + hash(cell + 8.0) * 0.5);
  vec3 color = piece * tint * (0.3 + 1.6 * flash) * awake;
  vec2 fine = p * 210.0;
  vec2 speckCell = floor(fine);
  float speck = ramp(0.24, 0.0, length(fract(fine) - 0.5 - (hash2(speckCell) - 0.5) * 0.5)) * step(0.72, hash(speckCell + 1.0));
  float speckFlash = pow(max(dot(normalize(vec3((hash2(speckCell + 2.0) - 0.5) * 0.9, 1.0)), halfway), 0.0), 10.0);
  return color + vec3(1.2) * speck * speckFlash * (1.0 - piece);
}


// Gold uses reflected studio bands and engraved stock, with no rainbow tint.
vec4 engravedGold(vec2 uv) {
  vec2 motion=vec2(uLight.x-.5,uLight.y-.5);
  float axis=uv.x*.91+uv.y*.37;
  float travel=.62+motion.x*1.08+motion.y*.24+sin(uTilt.y)*.7;
  float broad=exp(-pow((axis-travel)/.25,2.0));
  float ribbon=exp(-pow((axis-travel+.035)/.037,2.0));
  float second=exp(-pow((axis-travel-.33)/.12,2.0));
  float dark=exp(-pow((axis-travel+.29)/.095,2.0));
  vec3 bronze=vec3(.18,.075,.018);
  vec3 gold=vec3(.91,.59,.145);
  vec3 champagne=vec3(1.0,.94,.70);
  vec3 color=mix(bronze,gold,.36+.60*broad);
  color=mix(color,vec3(.12,.055,.012),dark*.55);
  color+=vec3(.11,.067,.018)*second;
  color=mix(color,champagne,clamp(ribbon*(.48+uIntensity*.46),0.0,.92));

  // Interlaced banknote-style cuts, lit on one edge and recessed on the other.
  vec2 d=vec2((uv.x-.5)*1.02,(uv.y-.39)*uAspect);
  float a=atan(d.y,d.x),r=length(d);
  float weave=r*76.0+sin(a*12.0)*.67+sin(a*24.0+r*8.0)*.16;
  float line=1.0-ramp(.025,.15,abs(fract(weave)-.5));
  float lip=1.0-ramp(.02,.12,abs(fract(weave+.15)-.5));
  float quietCenter=ramp(.17,.37,r);
  color*=1.0-line*(.10+.08*broad)*quietCenter;
  color+=vec3(.14,.10,.035)*lip*quietCenter*(.28+.72*broad);

  // Brushed directional microtexture replaces the earlier coarse glitter.
  float brushed=hash(vec2(floor(uv.x*1400.0),floor(uv.y*430.0)))-.5;
  float hair=sin((uv.x*.18+uv.y)*1600.0+hash(floor(uv*110.0))*1.7);
  color+=vec3(.035,.027,.012)*brushed+vec3(.010,.008,.003)*hair;

  // A fine double engraved border catches the moving reflection.
  float e=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
  float inlay=1.0-ramp(.001,.004,abs(e-.021));
  float inner=1.0-ramp(.0008,.003,abs(e-.034));
  color+=vec3(.26,.20,.075)*inlay*(.6+.4*broad);
  color*=1.0-inner*.22;
  float paper=1.0-ramp(.63,.79,uv.y);
  float alpha=(.48+.40*uIntensity)*paper;
  return vec4(clamp(color,0.0,1.0)*alpha,alpha);
}

float velvetNoise(vec2 p) {
  vec2 cell=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(cell),hash(cell+vec2(1,0)),f.x),mix(hash(cell+vec2(0,1)),hash(cell+vec2(1,1)),f.x),f.y);
}

// Separate depths respond to the light at different speeds, like embossed foil.
// No independent particle loop or extra GPU context is required.
vec3 astralStars(vec2 p,vec2 light,float density,float depth) {
  vec2 g=(p+light*depth)*density,base=floor(g);
  vec3 result=vec3(0);
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++) {
    vec2 id=base+vec2(float(i),float(j));
    vec2 d=g-id-.5-(hash2(id+depth)-.5)*.7;
    float pick=hash(id+depth*31.0);
    float r=length(d),size=mix(.025,.065,hash(id+12.0));
    float core=exp(-r*r/(size*size));
    float lightMatch=.5+.5*cos(dot(light,vec2(8,-5))+pick*TAU);
    float flash=pow(lightMatch,10.0);
    float rays=exp(-abs(d.x)*95.0-abs(d.y)*10.0)+exp(-abs(d.y)*95.0-abs(d.x)*10.0);
    float glow=exp(-r*r/.035)*.12;
    float rare=step(.88,pick);
    vec3 tint=mix(vec3(.43,.68,1),vec3(1,.84,.48),hash(id+4.0));
    result+=tint*(core*(.35+flash)+rare*flash*(rays*.8+glow))*step(.48,pick);
  }
  return result;
}

vec4 astralCosmos(vec2 uv) {
  vec2 light=(uLight-.5)*vec2(1,uAspect);
  vec2 p=vec2(uv.x,uv.y*uAspect);
  vec2 q=p+light*.06;
  float cloud=velvetNoise(q*4.0)*.57+velvetNoise(q*9.0+7.0)*.29+velvetNoise(q*21.0)*.14;
  float ribbonAxis=q.x*.75+q.y*.54;
  float fold=sin(q.y*6.0+cloud*3.5)*.10;
  float nebula=exp(-pow((ribbonAxis-.61-fold)/.19,2.0));
  float lit=exp(-pow((ribbonAxis-(.64+light.x*.9+light.y*.24))/.24,2.0));
  vec3 color=mix(vec3(.018,.026,.065),vec3(.055,.075,.18),cloud);
  vec3 interference=mix(vec3(.10,.23,.45),vec3(.28,.12,.40),.5+.5*sin(q.x*4.0+q.y*3.0+light.x*5.0));
  color+=interference*nebula*(.18+.60*lit)*cloud;
  color+=vec3(.10,.42,.43)*exp(-pow((ribbonAxis-.85-fold)/.055,2.0))*lit*.30;

  // Retain the original small cosmos circles as the main foil identity.
  // Each printed ring catches a different angle over the deeper star stock.
  Foil circles=cosmos(p+light*.035);
  float circlePhase=dot(light,vec2(cos(circles.angle),sin(circles.angle)))*4.0+circles.jitter*TAU;
  float circleShine=pow(.5+.5*cos(circlePhase),3.0);
  vec3 circleTint=mix(vec3(.30,.39,.60),vec3(.95,.75,.63),.5+.5*sin(circlePhase+.8));
  color+=circleTint*circles.mask*(.42+.75*circleShine)*(.62+.58*uIntensity);

  color+=astralStars(p,light,29.0,.025)*.28;
  color+=astralStars(p,light,5.8,.16)*.62;

  // A narrow spectral reflection crosses the stock without washing out the art.
  float sweep=uv.x*.90+uv.y*.36-(.67+light.x*.9+light.y*.25);
  float beam=exp(-pow(sweep/.029,2.0));
  vec3 spectrum=mix(vec3(.25,.65,.78),vec3(.86,.70,.37),.5+.5*sin(sweep*48.0+light.x*4.0));
  color+=spectrum*beam*.40;
  float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
  float inlay=exp(-pow((edge-.023)/.0016,2.0));
  color+=mix(vec3(.52,.10,.16),vec3(.95,.42,.42),lit)*inlay*(.26+lit*.4);
  color+=(hash(floor(uv*vec2(900,1200)))-.5)*.012;
  float paper=1.0-ramp(.64,.79,uv.y);
  float alpha=(.68+.29*uIntensity)*paper;
  return vec4(clamp(color*(.72+.55*uIntensity),0.0,1.0)*alpha,alpha);
}

void main() {
  vec2 uv = vec2((gl_FragCoord.x-uOrigin.x)/uSize.x, 1.0-(gl_FragCoord.y-uOrigin.y)/uSize.y);
  if(uPreset==7){outColor=engravedGold(uv);return;}
  if(uPreset==3){outColor=astralCosmos(uv);return;}
  vec2 p = vec2(uv.x,uv.y*uAspect);
  vec2 centered = p-vec2(.5,.5*uAspect);
  vec3 light = normalize(vec3((uLight-.5)*vec2(1.25,1.25*uAspect),1.1));
  vec3 view = normalize(vec3(sin(uTilt.y)*1.6,-sin(uTilt.x)*1.6,1.5));
  vec3 halfway = normalize(light+view);
  vec2 sweep = light.xy+view.xy;
  Foil f;
  if(uPreset==7) f=gold(p);
  else if(uPreset==2) f=shards(p);
  else f=cosmos(p);
  vec2 dir = vec2(cos(f.angle),sin(f.angle));
  float phase = dot(sweep,dir)*.7+dot(sweep,vec2(.8,.6))*1.3+f.jitter*.55;
  vec3 tint = hue(phase);
  if(uPreset==7) tint=mix(tint,vec3(1.0,.72,.3),.88);
  if(uPreset==2) tint=mix(tint,vec3(.63,.73,1.0),.62);
  if(uPreset==3) tint=mix(tint,vec3(.9,.28,.42),.50);
  float glint=pow(max(dot(normalize(vec3(f.facet,1.0)),halfway),0.0),30.0);
  float band=.35+.65*ramp(.25,.98,.5+.5*cos(phase*TAU*.5+1.3));
  float sheen=pow(max(halfway.z,0.0),25.0);
  float edge=1.0-ramp(.01,.055,min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y)));
  float paper=1.0-ramp(.66,.79,uv.y);
  float mask=clamp((f.mask*(.5+.5*band)+glint*.16)*uIntensity,0.0,.63)*paper;
  vec3 rgb=clamp(tint*(.6+.2*sheen)+uFoil*glint*.2,0.0,1.0);
  rgb+=sparkles(p,halfway,sweep,.45)*edge*uEdge*.25;
  rgb=pow(clamp(rgb,0.0,1.0),vec3(1.0/2.2));
  float alpha=clamp(mask+edge*.22*uIntensity,0.0,.7);
  outColor=vec4(rgb*alpha,alpha);
}
`;
