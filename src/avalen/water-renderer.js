// The glyph layer is sampled through the same surface normals as the water.
const vertex = `attribute vec2 a_position; varying vec2 v_uv;
void main(){v_uv=(a_position+1.0)*0.5;gl_Position=vec4(a_position,0.0,1.0);}`;
const fragment = `precision highp float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_time,u_level,u_reduced;
uniform sampler2D u_text,u_surface;
uniform vec4 u_touches[8];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return .55*noise(p)+.27*noise(p*2.06+3.4)+.12*noise(p*4.13+9.7);}
float surface(float x){float spring=(texture2D(u_surface,vec2(clamp(x,0.,1.),.5)).r-.5)*128./u_size.y;
return u_level+spring+(sin(x*6.2+u_time*.72)*.013+sin(x*10.9-u_time*.56)*.006)* (1.-u_reduced);}
void main(){
vec2 uv=vec2(v_uv.x,1.-v_uv.y); float t=u_time*(1.-u_reduced);
float line=surface(uv.x);float depth=max(0.,uv.y-line);
float mask=smoothstep(-1.2/u_size.y,1.2/u_size.y,uv.y-line);
vec2 p=vec2(uv.x*u_size.x/u_size.y,uv.y);
vec2 normal=vec2(sin(p.y*19.+t*.73+p.x*9.),cos(p.x*13.-t*.54+p.y*12.))*.004;
float ringLight=0.;
for(int i=0;i<8;i++){vec4 touch=u_touches[i];float age=u_time-touch.z; if(age>=0.&&age<3.5&&touch.w>0.&&u_reduced<.5){
vec2 delta=(uv-touch.xy)*vec2(u_size.x/u_size.y,1.);float radius=length(delta);float envelope=exp(-pow((radius-age*.28)*13.,2.))*exp(-age*.95)*touch.w;
float phase=radius*90.-age*19.;normal+=normalize(delta+vec2(.00001))*cos(phase)*envelope*.025;ringLight+=sin(phase)*envelope;
}}
float slope=(surface(uv.x+.007)-surface(uv.x-.007))/.014;
normal.x+=slope*.007*exp(-depth*9.);
normal.y+=sin(p.x*15.+t+p.y*5.)*.003;
vec2 bend=normal*(.5+depth*1.9)*mask;
// Snell-like magnification at the meniscus and a drifting submerged image.
vec2 refracted=uv+bend;
refracted.y=mix(uv.y,line+(uv.y-line)*.84+.018,mask)+bend.y;
refracted.x=mix(uv.x,.06+(uv.x-.06)*.972,mask)+bend.x;
vec4 dryText=texture2D(u_text,uv);
vec4 wetText=texture2D(u_text,refracted);
vec3 air=mix(vec3(.43,.55,.64),vec3(.67,.77,.83),clamp(1.-uv.y+uv.x*.2,0.,1.));
air+=vec3(.03,.045,.065)*exp(-length((uv-vec2(.9,.05))*vec2(.8,1.2))*3.);
float cloud=fbm(p*3.+vec2(t*.023,-t*.036));
vec3 water=mix(vec3(.36,.56,.70),vec3(.12,.27,.39),clamp(depth*1.25,0.,1.));
water+=vec3(.035,.07,.10)*(cloud-.4);
// Caustic veins are narrow highlights from crossing refracted wave fields.
vec2 c=p*6.+vec2(t*.065,-t*.06); c+=vec2(fbm(c+t*.04),fbm(c-4.-t*.04))*.95;
float caustic=pow(1.-abs(sin(c.x*3.+sin(c.y*2.1))*sin(c.y*3.2+cos(c.x*1.8))),14.);
water+=vec3(.12,.27,.3)*caustic*.085*(1.-exp(-depth*6.));
float rays=pow(max(0.,sin((p.x+p.y*.19)*15.+t*.17+sin(p.y*4.+t*.1)*.35)),10.);
water+=vec3(.035,.10,.13)*rays*exp(-depth*2.5);
float reflected=pow(max(0.,sin(p.x*10.+t*.22+cloud*2.3)),12.);
water+=vec3(.15,.3,.34)*reflected*exp(-depth*22.);
water+=ringLight*vec3(.16,.27,.30);
vec3 color=mix(air,water,mask);
vec3 glyph=mix(dryText.rgb,wetText.rgb*vec3(.82,.94,1.),mask);
float alpha=mix(dryText.a,wetText.a*.88,mask);
color=mix(color,glyph,alpha);
// A lens-shaped meniscus brightens and bends the type as it crosses the line.
float edge=exp(-abs(uv.y-line)*u_size.y*.46);
float glint=pow(.5+.5*sin(p.x*13.+t*.3),8.);
color+=edge*vec3(.52,.68,.79)*(.22+.55*glint);
color+=exp(-abs(uv.y-line-.009)*u_size.y*.38)*vec3(.015,.08,.11);
gl_FragColor=vec4(color,1.);
}`;

function shader(gl, type, source) {
  const result = gl.createShader(type);
  gl.shaderSource(result, source); gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(result); gl.deleteShader(result); throw new Error(error); }
  return result;
}

export function createWaterRenderer(canvas, { reduced = false, label = '%' } = {}) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) throw new Error('WebGL unavailable');
  const vs = shader(gl, gl.VERTEX_SHADER, vertex), fs = shader(gl, gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, 'a_position'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  const uniform = name => gl.getUniformLocation(program, name);
  const locations = Object.fromEntries(['u_size','u_time','u_level','u_reduced','u_text','u_surface','u_touches[0]'].map(n => [n,uniform(n)]));
  const textCanvas = document.createElement('canvas'), textContext = textCanvas.getContext('2d');
  const makeTexture = unit => { const texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,texture); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return texture; };
  const textTexture = makeTexture(0), surfaceTexture = makeTexture(1);
  const nodes = 128, offsets = new Float32Array(nodes), velocities = new Float32Array(nodes), encoded = new Uint8Array(nodes);
  const touches = new Float32Array(32); for(let i=0;i<8;i++) touches[i*4+2] = -100;
  let touchIndex = 0, width = 1, height = 1, dpr = 1, target = 0, current = 0, display = 0, suffix = label, lastText = '', lastTime = 0, accumulated = 0, lastPointer = null, tilt = 0, targetTilt = 0, dirty = true, initialized = false, interaction = 0, frames = 0;
  gl.uniform1i(locations.u_text,0); gl.uniform1i(locations.u_surface,1); gl.uniform1f(locations.u_reduced,reduced?1:0);
  function resize(w,h) { width=w; height=h; dpr=Math.min(devicePixelRatio||1,1.5); canvas.width=Math.max(1,Math.round(w*dpr)); canvas.height=Math.max(1,Math.round(h*dpr)); textCanvas.width=canvas.width; textCanvas.height=canvas.height; gl.viewport(0,0,canvas.width,canvas.height); lastText=''; dirty=true; }
  function splash(x,y,strength=1,now=performance.now()/1000) {
    if(reduced) return;
    interaction++;
    touches.set([x,y,now,strength],(touchIndex++%8)*4);
    const center=Math.round(x*(nodes-1));
    for(let i=Math.max(0,center-12);i<Math.min(nodes,center+13);i++) velocities[i]+=Math.exp(-Math.pow((i-center)/5,2))*strength*4.5;
    dirty=true;
  }
  function point(x,y,down,now) {
    if(reduced) return;
    const previous=lastPointer; const dx=previous?x-previous.x:0;
    targetTilt=Math.max(-24,Math.min(24,(x-.5)*20+dx*180));
    if(down || (previous && now-previous.time>.075 && Math.abs(dx)+Math.abs(y-previous.y)>.009)) splash(x,y,down?1.15:.5,now);
    lastPointer={x,y,time:now};
  }
  function setValue(percent,textLabel='%') { target=Math.max(0,Math.min(100,percent)); if(!initialized){current=target;initialized=true;} display=percent; suffix=textLabel; dirty=true; }
  function render(now) {
    if(reduced&&!dirty) return;
    const dt=Math.min((now-(lastTime||now))*1000,48); lastTime=now;
    if(!reduced) { current+=(target-current)*(1-Math.exp(-dt/440)); tilt+=(targetTilt-tilt)*(1-Math.exp(-dt/300)); accumulated+=dt; }
    else { current=target; tilt=0; }
    while(accumulated>=16.667) {
      for(let i=0;i<nodes;i++){const neighbors=(offsets[Math.max(0,i-1)]+offsets[Math.min(nodes-1,i+1)])*.5; velocities[i]+=(neighbors-offsets[i])*.34-offsets[i]*.007;velocities[i]*=.977;}
      for(let i=0;i<nodes;i++) offsets[i]=Math.max(-55,Math.min(55,offsets[i]+velocities[i]));
      accumulated-=16.667;
    }
    for(let i=0;i<nodes;i++) encoded[i]=Math.round(Math.max(0,Math.min(255,128+(offsets[i]+(i/(nodes-1)-.5)*tilt)*2)));
    const shown=suffix==='%'?`${Math.round(current+(display-target))}%`:`${display} ${suffix}`;
    const font=getComputedStyle(canvas).fontFamily;
    if(shown!==lastText || dirty) {
      textContext.clearRect(0,0,textCanvas.width,textCanvas.height);
      textContext.font=`400 ${Math.min(width*.24,height*.23)*dpr}px ${font}`;
      textContext.fillStyle='#f7fcff';textContext.textBaseline='alphabetic';textContext.fillText(shown,24*dpr,height*.72*dpr);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textTexture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textCanvas);
      lastText=shown;
    }
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,surfaceTexture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,nodes,1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,encoded);
    gl.uniform2f(locations.u_size,width,height);gl.uniform1f(locations.u_time,now);gl.uniform1f(locations.u_level,1.045-current/100*.925);gl.uniform4fv(locations['u_touches[0]'],touches);
    gl.drawArrays(gl.TRIANGLES,0,6);dirty=false;frames++;
    return {level:current,interactions:interaction,frames};
  }
  return { resize, setValue, splash, point, release:()=>{targetTilt=0;lastPointer=null;}, render, destroy:()=>{gl.deleteTexture(textTexture);gl.deleteTexture(surfaceTexture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);} };
}

// Canvas fallback retains the submerged text and touch interaction without WebGL.
export function createWaterFallback(canvas, { reduced = false } = {}) {
  const ctx=canvas.getContext('2d'), glyph=document.createElement('canvas'), type=glyph.getContext('2d');
  let w=1,h=1,dpr=1,target=0,level=0,display=0,suffix='%',points=[],tilt=0,interactions=0,frames=0,dirty=true,initialized=false;
  function resize(width,height){dirty=true;w=width;h=height;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=w*dpr;canvas.height=h*dpr;glyph.width=canvas.width;glyph.height=canvas.height;ctx.setTransform(dpr,0,0,dpr,0,0);}
  function splash(x,y,amp=1,time=performance.now()/1000){if(reduced)return;points.push({x,y,amp,time});points=points.slice(-8);interactions++;}
  function render(time){if(reduced&&!dirty)return;dirty=false;level+=reduced?target-level:(target-level)*.055;points=points.filter(p=>time-p.time<3.5);const line=h*(1.045-level/100*.925);
    const surface=x=>line+(reduced?0:Math.sin(x/w*6+time*.72)*5+Math.sin(x/w*10-time*.56)*2+(x/w-.5)*tilt+points.reduce((s,p)=>s+Math.sin(Math.abs(x/w-p.x)*32-(time-p.time)*9)*p.amp*12*Math.exp(-(time-p.time)*1.6),0));
    const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#adc3d1');bg.addColorStop(1,'#628195');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    type.clearRect(0,0,glyph.width,glyph.height);type.font=`400 ${Math.min(w*.24,h*.23)*dpr}px ${getComputedStyle(canvas).fontFamily}`;type.fillStyle='#f7fcff';type.fillText(suffix==='%'?`${Math.round(level+display-target)}%`:`${display} ${suffix}`,24*dpr,h*.72*dpr);
    ctx.drawImage(glyph,0,0,w,h);ctx.save();ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,surface(0));for(let x=0;x<=w+4;x+=4)ctx.lineTo(x,surface(x));ctx.lineTo(w,h);ctx.closePath();ctx.clip();
    const water=ctx.createLinearGradient(0,line,0,h);water.addColorStop(0,'#90aec3');water.addColorStop(.45,'#6489a3');water.addColorStop(1,'#294c67');ctx.fillStyle=water;ctx.fillRect(0,0,w,h);
    ctx.globalAlpha=.7;
    for(let y=0;y<h;y+=3){const shift=reduced?0:Math.sin(y*.035+time*.9)*2+points.reduce((s,p)=>{const age=time-p.time;return s+Math.sin(Math.abs(y/h-p.y)*35-age*9)*p.amp*5*Math.exp(-age*1.4);},0);ctx.drawImage(glyph,0,y*dpr,glyph.width,3*dpr,shift,y+4,w,3);}
    ctx.globalAlpha=.1;ctx.strokeStyle='#b5f5ff';for(const p of points){ctx.beginPath();ctx.ellipse(p.x*w,p.y*h,(time-p.time)*h*.28,(time-p.time)*h*.15,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
    ctx.beginPath();ctx.moveTo(0,surface(0));for(let x=0;x<=w;x+=3)ctx.lineTo(x,surface(x));ctx.strokeStyle='#a7ebeb88';ctx.lineWidth=1.5;ctx.stroke();frames++;return{level,interactions,frames};
  }
  return{resize,setValue:(value,textLabel='%')=>{dirty=true;target=Math.max(0,Math.min(100,value));if(!initialized){level=target;initialized=true;}display=value;suffix=textLabel;},splash,point:(x,y,down,time)=>{tilt=(x-.5)*22;if(down)splash(x,y,1.1,time);},release:()=>{tilt=0;},render,destroy:()=>{points=[];}};
}
