import * as THREE from 'three';
import {clamp, smoothstep} from './math.js';

// ============================================================================
// 3. SHADERS CUSTOMIZADOS GLSL — PSÍQUICO, VOADOR E FOGO (3 REFERÊNCIAS)
// ============================================================================

export function createEarthboundMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#ff2e7e') },
      uColor2: { value: new THREE.Color('#00f0ff') },
      uColor3: { value: new THREE.Color('#ffe600') },
      uFreq: { value: 5.0 },
      uTurbulence: { value: 1.0 },
      uGlow: { value: 1.2 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uFreq;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float w = sin(p.y * uFreq * 1.6 + uTime * 5.0) * cos(p.x * uFreq * 1.4 - uTime * 4.0);
        p += normal * w * 0.08 * uTurbulence;
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uTurbulence;
      uniform float uGlow;
      float SmoothStepBand(float x) { return floor(x * 4.0) / 4.0; }
      void main() {
        vec2 uv = vUv - 0.5;
        float r = length(uv) * 2.0;
        float ang = atan(uv.y, uv.x);
        float wave = sin(r * uFreq * 3.2 - uTime * 6.0 + sin(ang * 4.0 + uTime * 3.0) * uTurbulence);
        float scan = sin((vPos.y + vPos.x * 0.5) * uFreq * 4.0 + uTime * 8.0);
        float band = fract((wave * 0.5 + 0.5) * 3.0 + scan * 0.18 + uTime * 0.7);
        vec3 col = band < 0.33 ? mix(uColor1, uColor2, SmoothStepBand(band * 3.0))
                 : band < 0.66 ? mix(uColor2, uColor3, SmoothStepBand((band - 0.33) * 3.0))
                 : mix(uColor3, uColor1, SmoothStepBand((band - 0.66) * 3.0));
        float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
        float mask = smoothstep(0.15, 0.85, 0.5 + 0.5 * wave) * (0.45 + 0.55 * rim);
        gl_FragColor = vec4(col * (0.85 + 0.55 * uGlow), clamp(mask * uAlpha, 0.0, 1.0));
      }
    `,
  });
}

export function createPersonaGraphicMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#b829ff') },
      uColor2: { value: new THREE.Color('#ff0055') },
      uColor3: { value: new THREE.Color('#ffd500') },
      uFreq: { value: 6.0 },
      uGlow: { value: 1.3 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float diag = fract((vUv.x * 6.0 - vUv.y * 6.0) + uTime * 2.2);
        float stripe = step(0.42, diag);
        float ring = sin(length(vUv - 0.5) * uFreq * 6.0 - uTime * 9.0);
        float hardRing = step(0.0, ring);
        float ndv = abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
        vec3 neon = mix(uColor1, uColor2, hardRing);
        neon = mix(neon, uColor3, step(0.82, fract(vUv.y * uFreq + uTime * 1.5)));
        float inkBand = step(0.22, ndv) * (1.0 - step(0.42, ndv));
        vec3 finalCol = mix(neon * (0.9 + 0.5 * uGlow), vec3(0.03, 0.01, 0.06), inkBand * 0.88);
        float alpha = (0.65 + 0.35 * stripe) * uAlpha;
        gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 1.0));
      }
    `,
  });
}

export function createParasiteBioMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#00e676') },
      uColor2: { value: new THREE.Color('#ff6d00') },
      uColor3: { value: new THREE.Color('#00e5ff') },
      uFreq: { value: 4.0 },
      uTurbulence: { value: 1.0 },
      uGlow: { value: 1.3 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uFreq;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float bio = sin(p.x * uFreq * 2.2 + uTime * 4.2) * cos(p.y * uFreq * 2.5 - uTime * 3.7) * sin(p.z * uFreq * 2.0 + uTime * 3.1);
        p += normal * bio * 0.14 * uTurbulence;
        vWorldPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.7);
        float veins = abs(sin(vWorldPos.x * uFreq * 4.5 + uTime * 3.0) * cos(vWorldPos.y * uFreq * 4.5 - uTime * 2.5) + sin(vWorldPos.z * uFreq * 4.0 + uTime * 4.0));
        float synapse = smoothstep(0.72, 0.98, veins);
        vec3 membrane = mix(uColor1, uColor3, fresnel);
        vec3 col = mix(membrane, uColor2 * 1.4, synapse);
        float a = clamp((0.28 + 0.72 * fresnel + 0.45 * synapse) * uAlpha, 0.0, 1.0);
        gl_FragColor = vec4(col * (0.85 + 0.55 * uGlow), a);
      }
    `,
  });
}

export function createWindFunnelMaterial(styleIndex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: styleIndex === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#7dd3fc') },
      uColor2: { value: new THREE.Color('#e7e5e4') },
      uColor3: { value: new THREE.Color('#38bdf8') },
      uFreq: { value: 5.0 },
      uTurbulence: { value: 1.0 },
      uGlow: { value: 1.2 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uFreq;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float h = clamp(uv.y, 0.0, 1.0);
        vHeight = h;
        float swayX = sin(h * 4.2 - uTime * 4.8) * 0.24 * uTurbulence * (0.25 + h);
        float swayZ = cos(h * 3.8 - uTime * 4.2) * 0.24 * uTurbulence * (0.25 + h);
        p.x += swayX;
        p.z += swayZ;
        float spiral = sin(uv.x * 18.8495 + h * uFreq * 3.0 - uTime * 10.0);
        p += normal * spiral * 0.06 * uTurbulence;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader:
      styleIndex === 0
        ? `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float scroll = fract(vUv.x * 3.0 + vHeight * uFreq * 0.85 - uTime * 1.9);
        float ribbon = smoothstep(0.18, 0.24, scroll) * (1.0 - smoothstep(0.68, 0.76, scroll));
        float fineLine = smoothstep(0.84, 0.88, scroll) * (1.0 - smoothstep(0.93, 0.97, scroll));
        float edgeFade = sin(vHeight * 3.14159);
        vec3 baseCol = mix(uColor2, uColor1, smoothstep(0.05, 0.45, vHeight));
        vec3 col = mix(baseCol, uColor3 * 1.25, fineLine);
        float mask = clamp((ribbon * 0.82 + fineLine * 1.1) * edgeFade, 0.0, 1.0);
        gl_FragColor = vec4(col * (0.85 + 0.45 * uGlow), mask * uAlpha);
      }
    `
        : styleIndex === 1
        ? `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float slash = fract(vUv.x * 4.0 - vHeight * uFreq * 1.1 - uTime * 2.6);
        float hardBand = step(0.32, slash) * (1.0 - step(0.78, slash));
        float border = (step(0.24, slash) - step(0.32, slash)) + (step(0.78, slash) - step(0.86, slash));
        float edgeFade = sin(vHeight * 3.14159);
        vec3 neon = mix(uColor1, uColor3, step(0.55, slash));
        neon = mix(uColor2, neon, smoothstep(0.0, 0.35, vHeight));
        vec3 finalCol = mix(neon * (0.95 + 0.5 * uGlow), vec3(0.03, 0.04, 0.07), clamp(border, 0.0, 1.0));
        float a = clamp((hardBand + border) * edgeFade, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(finalCol, a);
      }
    `
        : `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float n1 = sin(vUv.x * 25.132 + vHeight * uFreq * 4.0 - uTime * 9.0);
        float n2 = cos(vUv.x * 12.566 - vHeight * uFreq * 2.5 - uTime * 6.5);
        float turb = 0.5 + 0.5 * (n1 * 0.6 + n2 * 0.4);
        float fresnel = 0.35 + 0.65 * (1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))));
        float edgeFade = sin(vHeight * 3.14159);
        vec3 stormCol = mix(uColor2 * 1.1, uColor1, smoothstep(0.08, 0.58, vHeight));
        stormCol = mix(stormCol, uColor3, smoothstep(0.68, 0.96, turb));
        float a = clamp(turb * fresnel * edgeFade * 1.15, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(stormCol * (0.8 + 0.5 * uGlow), a);
      }
    `,
  });
}

// ---- SHADERS EXCLUSIVOS DO TIPO FOGO (MITOLÓGICO JAPONÊS, TINTA SUMI-E, FOGO MÁGICO) ----

export function createFireMaterial(styleIndex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // Opção B (Tinta Sumi-e) usa NormalBlending para que o nanquim negro tenha peso sólido ao redor da brasa!
    blending: styleIndex === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uColor1: { value: new THREE.Color('#ff2a1f') },
      uColor2: { value: new THREE.Color('#ff9500') },
      uColor3: { value: new THREE.Color('#ffe66d') },
      uFreq: { value: 5.5 },
      uTurbulence: { value: 1.1 },
      uGlow: { value: 1.4 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uFreq;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float h = clamp(uv.y, 0.0, 1.0);
        vHeight = h;
        // Línguas de fogo ascendentes que serpenteiam e afilam com turbulência
        float lickX = sin(h * uFreq * 1.5 - uTime * 7.5 + uv.x * 6.2831) * 0.16 * uTurbulence * h;
        float lickZ = cos(h * uFreq * 1.3 - uTime * 6.8 + uv.x * 6.2831) * 0.16 * uTurbulence * h;
        p.x += lickX;
        p.z += lickZ;
        p += normal * sin(h * uFreq * 3.2 - uTime * 11.0 + uv.x * 12.566) * 0.07 * uTurbulence;
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader:
      styleIndex === 0
        ? `
      // Opção A: Fogo Mitológico Japonês (Ukiyo-e / Hinokami Kagura / Okami Amaterasu)
      // Espirais tradicionais Kaen em degraus nítidos (Vermelhão Lacado -> Laranja -> Ouro -> Núcleo Branco-Solar)
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        // Padrão de voluta/espiral japonesa Kaen subindo
        float coil = sin(vUv.x * 18.8495 + sin(vHeight * uFreq * 2.2 - uTime * 5.5) * 2.4 - uTime * 4.0);
        float tongues = fract(vUv.x * 4.0 + vHeight * uFreq * 0.9 - uTime * 2.4 + coil * 0.22);
        // Faixas concêntricas de xilogravura japonesa (Ukiyo-e)
        float step1 = step(0.16, tongues) * (1.0 - step(0.86, tongues));
        float step2 = step(0.32, tongues) * (1.0 - step(0.72, tongues));
        float step3 = step(0.46, tongues) * (1.0 - step(0.58, tongues));
        // Filete tradicional escuro/dourado entre as faixas
        float goldLine = (step(0.29, tongues) - step(0.32, tongues)) + (step(0.72, tongues) - step(0.75, tongues));
        vec3 col = uColor1;
        col = mix(col, uColor2, step2);
        col = mix(col, uColor3 * 1.25, step3 + goldLine);
        float verticalMask = smoothstep(0.0, 0.12, vHeight) * (1.0 - smoothstep(0.72, 0.99, vHeight));
        float a = clamp((step1 * 0.92 + goldLine) * verticalMask, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(col * (0.9 + 0.45 * uGlow), a);
      }
    `
        : styleIndex === 1
        ? `
      // Opção B: Fogo Estilizado em Tinta (Sumi-e Ink-Wash & Dry-Brush Flame — SF4 / SF6)
      // Cerdas de pincel secas com contorno pesado de nanquim preto e brasa incandescente no centro
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        // Textura de cerdas de pincel caligráfico (dry brush)
        float bristles = sin(vUv.x * 62.8318 + vHeight * 8.0) * 0.5 + 0.5;
        float stroke = fract(vUv.x * 3.0 - vHeight * uFreq * 0.95 - uTime * 2.5);
        float erosion = sin(vUv.x * 18.849 + vHeight * uFreq * 3.0 - uTime * 7.0) * 0.15;
        float body = smoothstep(0.18 + erosion, 0.28, stroke) * (1.0 - smoothstep(0.74, 0.85 - erosion, stroke));
        // Núcleo de brasa viva vs Borda de Nanquim Preto (Sumi-e Ink)
        float emberCore = smoothstep(0.36, 0.46, stroke) * (1.0 - smoothstep(0.56, 0.66, stroke));
        float hotHeart = smoothstep(0.45, 0.50, stroke) * (1.0 - smoothstep(0.51, 0.56, stroke));
        float ndv = abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
        // Borda de tinta preta nas extremidades do golpe de pincel e silhueta
        vec3 inkBlack = mix(vec3(0.03, 0.02, 0.04), uColor2 * 0.35, 0.4);
        vec3 fireCol = mix(uColor1, uColor3 * 1.3, hotHeart);
        vec3 finalCol = mix(inkBlack, fireCol * (0.95 + 0.55 * uGlow), clamp(emberCore * (0.55 + 0.45 * bristles) * step(0.22, ndv), 0.0, 1.0));
        float verticalMask = smoothstep(0.0, 0.10, vHeight) * (1.0 - smoothstep(0.75, 0.99, vHeight));
        float a = clamp(body * (0.65 + 0.35 * bristles) * verticalMask, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(finalCol, a);
      }
    `
        : `
      // Opção C: Fogo Mágico & Arcano (Astral Pyromancy / Prism Hellfire)
      // Plasma místico iridescente (Rubi / Violeta Arcano / Ouro Solar) com grade rúnica geométrica
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vHeight;
      varying vec3 vPos;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uFreq;
      uniform float uGlow;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
        float plasma1 = sin(vUv.x * 18.8495 + vHeight * uFreq * 3.5 - uTime * 7.0);
        float plasma2 = cos(vUv.x * 12.5663 - vHeight * uFreq * 2.8 - uTime * 5.2);
        // Interferência geométrica de runas/sigilos arcanos na chama
        float sigilGrid = abs(sin(vUv.x * 37.699 + uTime * 3.0) * sin(vHeight * uFreq * 6.0 - uTime * 6.0));
        float runeGlow = smoothstep(0.82, 0.97, sigilGrid);
        float flameWave = 0.5 + 0.5 * (plasma1 * 0.6 + plasma2 * 0.4);
        vec3 arcaneCol = mix(uColor2, uColor1, smoothstep(0.2, 0.75, flameWave));
        arcaneCol = mix(arcaneCol, uColor3 * 1.35, runeGlow + smoothstep(0.78, 0.98, flameWave) * 0.7);
        float verticalMask = smoothstep(0.0, 0.10, vHeight) * (1.0 - smoothstep(0.72, 1.0, vHeight));
        float a = clamp((flameWave * 0.8 + fresnel * 0.5 + runeGlow * 0.6) * verticalMask, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(arcaneCol * (0.9 + 0.55 * uGlow), a);
      }
    `,
  });
}
