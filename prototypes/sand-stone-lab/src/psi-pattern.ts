import * as T from 'three';

/** Original, procedural PSI graphics: stepped pixels and chromatic bands, no borrowed sprites. */
export function psiPattern(variant:number,primary:T.Color,secondary:T.Color){
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
    uniforms:{time:{value:0},opacity:{value:0},variant:{value:variant},primary:{value:primary},secondary:{value:secondary},pulse:{value:1}},
    vertexShader:`varying vec2 uvPsi;void main(){uvPsi=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec2 uvPsi;
      uniform float time,opacity,variant,pulse;
      uniform vec3 primary,secondary;
      void main(){
        vec2 p=(floor(uvPsi*160.)/160.-.5)*2.;
        float t=floor(time*18.)/18.;
        float radius=length(p),angle=atan(p.y,p.x);
        float field,ink,mask;
        if(variant<.5){
          // Offset, expanding diamond/square echoes, like an animated PSI stamp.
          vec2 q=p; q.x+=.10*sin(p.y*6.+t*2.);
          float diamond=abs(q.x)+abs(q.y);
          field=diamond*7.-t*2.2;
          ink=1.-smoothstep(.13,.20,abs(fract(field)-.5));
          mask=1.-smoothstep(.75,1.3,diamond);
        }else if(variant<1.5){
          // Serrated horizontal waves with independently drifting checker tiles.
          float zig=abs(fract(p.x*3.+t*.25)*2.-1.);
          field=p.y*6.+zig*1.3-t*1.7;
          ink=1.-smoothstep(.16,.23,abs(fract(field)-.5));
          float tile=mod(floor((p.x+1.)*10.)+floor((p.y+1.)*8.+t*2.),2.);
          ink=max(ink,tile*.26);
          mask=(1.-smoothstep(.65,.98,abs(p.x)))*(1.-smoothstep(.6,.95,abs(p.y)));
        }else{
          // Warped concentric bands: a psychedelic, pixel-stepped tunnel.
          float warp=radius+.09*sin(angle*6.+t*1.7)+.05*sin(p.y*12.-t*2.);
          field=warp*9.-t*2.;
          ink=1.-smoothstep(.18,.25,abs(fract(field)-.5));
          mask=(1.-smoothstep(.7,1.,radius))*smoothstep(.04,.16,radius);
        }
        float palette=mod(floor(field),3.);
        vec3 color=palette<1.?primary:palette<2.?secondary:vec3(1.,.72,.24);
        float breath=.84+.16*sin(time*2.5*pulse);
        gl_FragColor=vec4(color,ink*mask*opacity*breath);
        #include <colorspace_fragment>
      }`});
  const mesh=new T.Mesh(new T.PlaneGeometry(5.7,3.9),material);mesh.name='psi-pixel-pattern';
  return mesh;
}
