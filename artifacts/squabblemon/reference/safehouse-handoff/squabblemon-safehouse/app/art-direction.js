import * as T from './three.module.js';

// A separate art pass keeps story text, picking and game state independent of styling.
export function installFightingGameStyle({renderer,scene,camera,screenMaterials=[]}) {
  const pixelRatio={value:renderer.getPixelRatio()};
  const unstyled=new Set(screenMaterials),styled=new Set();
  const diffuseLine='vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;';
  scene.traverse(object=>{
    if(!object.isMesh)return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(styled.has(material)||unstyled.has(material)||material.transparent||!material.isMeshStandardMaterial)continue;
      styled.add(material);
      material.onBeforeCompile=shader=>{
        shader.uniforms.sqPixelRatio=pixelRatio;
        shader.fragmentShader='uniform float sqPixelRatio;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace(diffuseLine,`
          // Broad light bands preserve the base colors instead of posterizing screen text.
          float sqBase = max(dot(diffuseColor.rgb, vec3(0.2126,0.7152,0.0722)), 0.035);
          float sqLight = dot(totalDiffuse,vec3(0.2126,0.7152,0.0722)) / sqBase;
          float sqBand = 0.19 + 0.24*smoothstep(0.29,0.33,sqLight)
            + 0.38*smoothstep(0.64,0.69,sqLight)
            + 0.50*smoothstep(1.16,1.23,sqLight)
            + 0.65*smoothstep(1.98,2.08,sqLight);
          totalDiffuse *= mix(1.0,sqBand/max(sqLight,0.035),0.84);
          float sqShadow=1.0-smoothstep(0.26,0.86,sqLight);
          totalDiffuse *= mix(vec3(1.045,1.015,0.96),vec3(0.68,0.70,1.12),sqShadow*0.72);
          // Tiny print dots only in the shaded material; screens are excluded above.
          vec2 sqCell=fract(gl_FragCoord.xy/(5.0*sqPixelRatio))-0.5;
          float sqDot=1.0-smoothstep(0.16,0.23,length(sqCell));
          totalDiffuse *= 1.0-sqDot*sqShadow*0.15;
          // Retain metallic reflections with firmer highlight transitions.
          float sqSpec=dot(totalSpecular,vec3(0.2126,0.7152,0.0722));
          totalSpecular *= mix(0.76,1.18,smoothstep(0.16,0.28,sqSpec));
          vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
        `);
      };
      material.customProgramCacheKey=()=> 'squabblemon-ink-cel-v1';
      material.needsUpdate=true;
    }
  });

  const size=new T.Vector2();renderer.getDrawingBufferSize(size);
  const colorTarget=new T.WebGLRenderTarget(size.x,size.y,{type:T.HalfFloatType,samples:2});
  const normalTarget=new T.WebGLRenderTarget(size.x,size.y,{minFilter:T.NearestFilter,magFilter:T.NearestFilter});
  normalTarget.depthTexture=new T.DepthTexture(size.x,size.y,T.UnsignedIntType);
  const normalMaterial=new T.MeshNormalMaterial();
  const skip=[];
  scene.traverse(object=>{if(object.isPoints||object.isLine||(object.isMesh&&(Array.isArray(object.material)?object.material.some(m=>m.transparent):object.material.transparent)))skip.push(object);});
  const postScene=new T.Scene(),postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const uniforms={colorMap:{value:colorTarget.texture},normalMap:{value:normalTarget.texture},depthMap:{value:normalTarget.depthTexture},resolution:{value:size.clone()},pixelRatio,nearPlane:{value:camera.near},farPlane:{value:camera.far}};
  const composite=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`
      varying vec2 vUv;
      uniform sampler2D colorMap,normalMap,depthMap;
      uniform vec2 resolution;
      uniform float pixelRatio,nearPlane,farPlane;
      #include <common>
      #include <packing>
      float viewDepth(vec2 uv){return -perspectiveDepthToViewZ(texture2D(depthMap,uv).x,nearPlane,farPlane);}
      void main(){
        vec3 color=texture2D(colorMap,vUv).rgb;
        vec3 n=texture2D(normalMap,vUv).rgb*2.0-1.0;
        float center=viewDepth(vUv);
        // A constant pixel width keeps cards and the bag legible at every camera distance.
        vec2 stepUV=vec2(1.35*pixelRatio)/resolution;
        float depthEdge=0.0,normalEdge=0.0;
        for(int x=-1;x<=1;x++){
          for(int y=-1;y<=1;y++){
            if(x==0&&y==0)continue;
            vec2 uv=clamp(vUv+vec2(float(x),float(y))*stepUV,vec2(0.0),vec2(1.0));
            float d=viewDepth(uv);
            depthEdge=max(depthEdge,abs(center-d)/max(min(center,d),0.1));
            vec3 other=texture2D(normalMap,uv).rgb*2.0-1.0;
            // Smooth curvature stays clean; corners and silhouettes receive black ink.
            normalEdge=max(normalEdge,length(n-other));
          }
        }
        float ink=max(smoothstep(0.012,0.03,depthEdge),smoothstep(0.43,0.75,normalEdge));
        color=mix(color,vec3(0.005,0.003,0.009),ink*0.96);
        // The final pass owns tone mapping and display color conversion exactly once.
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),composite);quad.frustumCulled=false;postScene.add(quad);
  const clearColor=new T.Color();
  function resize(){renderer.getDrawingBufferSize(size);colorTarget.setSize(size.x,size.y);normalTarget.setSize(size.x,size.y);uniforms.resolution.value.copy(size);pixelRatio.value=renderer.getPixelRatio();}
  function render(){
    renderer.setRenderTarget(colorTarget);renderer.render(scene,camera);
    const background=scene.background,override=scene.overrideMaterial;
    renderer.getClearColor(clearColor);const clearAlpha=renderer.getClearAlpha();
    const shadowUpdate=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
    const visibility=skip.map(object=>object.visible);skip.forEach(object=>object.visible=false);
    scene.background=null;scene.overrideMaterial=normalMaterial;
    renderer.setClearColor(0x000000,0);renderer.setRenderTarget(normalTarget);renderer.render(scene,camera);
    scene.background=background;scene.overrideMaterial=override;skip.forEach((object,i)=>object.visible=visibility[i]);
    renderer.shadowMap.autoUpdate=shadowUpdate;renderer.setClearColor(clearColor,clearAlpha);
    renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
  }
  function dispose(){colorTarget.dispose();normalTarget.dispose();normalMaterial.dispose();quad.geometry.dispose();composite.dispose();}
  return {render,resize,dispose,styledMaterialCount:styled.size};
}
