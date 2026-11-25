import { Scene, ShaderMaterial, Texture } from '@babylonjs/core';

// Repeat the Darkon rock and molten textures in world space. The original tile
// atlas stays on the mesh for instant restoration when leaving the crater.
export function craterMaterial(scene: Scene) {
  const mat = new ShaderMaterial('crater-rock-and-lava',scene,{
    vertexSource: `precision highp float;
    attribute vec3 position; uniform mat4 world, worldViewProjection; varying vec3 p;
    void main(){p=(world*vec4(position,1.)).xyz;gl_Position=worldViewProjection*vec4(position,1.);}`,
    fragmentSource: `precision highp float;
    uniform sampler2D stone, magma; uniform float clock; uniform vec3 eye, haze; varying vec3 p;
    void main(){
      vec2 uv=p.xz*.115;
      vec3 rock=texture2D(stone,uv+vec2(p.y*.043)).rgb;
      float river=abs(sin(p.x*.024+sin(p.z*.021)*1.4+p.z*.011));
      float flow=(1.-smoothstep(.04,.15,river))*smoothstep(.12,.44,sin(p.z*.009-p.x*.006));
      vec3 melt=texture2D(magma,uv*.54+vec2(clock*.014,clock*.008)).rgb;
      vec3 ash=mix(vec3(.15,.105,.10),vec3(.54,.38,.28),rock.r);
      vec3 lava=vec3(.66,.10,.015)+melt*vec3(1.15,.70,.25);
      vec3 col=mix(ash*(.72+rock*.6),lava,flow);
      gl_FragColor=vec4(mix(col,haze,smoothstep(145.,400.,distance(eye,p))),1.);
    }`},{attributes:['position'],uniforms:['world','worldViewProjection','clock','eye','haze'],samplers:['stone','magma']});
  mat.setTexture('stone',new Texture('./mugroup/ui/basalt.webp',scene));
  mat.setTexture('magma',new Texture('./mugroup/ui/magma.webp',scene));
  mat.backFaceCulling=false;
  mat.onBindObservable.add(()=>{
    mat.setFloat('clock',(performance.now()%3600000)/1000);
    if(scene.activeCamera) mat.setVector3('eye',scene.activeCamera.globalPosition);
    mat.setColor3('haze',scene.fogColor);
  });
  return mat;
}
