import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const NOISE = `
  float hash(vec3 p){p=fract(p*0.3183099+vec3(.1,.2,.3));p*=17.0;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float v=0.0,a=0.5;
    for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=0.5;}return v;}`;

const MOON_VERTEX = `${NOISE}
  varying vec3 vN; varying vec3 vView; varying vec3 vPos;
  void main(){
    vPos = position;
    float bump = fbm(position*2.2)*0.16 + fbm(position*7.0)*0.04;
    vec3 p = position + normal*bump;
    vN = normalize(normalMatrix*normal);
    vec4 mv = modelViewMatrix*vec4(p,1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix*mv;
  }`;

const MOON_FRAGMENT = `${NOISE}
  varying vec3 vN; varying vec3 vView; varying vec3 vPos;
  void main(){
    vec3 n = normalize(vN);
    float craters = fbm(vPos*2.6);
    float grain   = fbm(vPos*11.0);
    float h = craters*0.72 + grain*0.28;
    vec3 base = mix(vec3(0.055,0.058,0.070), vec3(0.68,0.70,0.76), smoothstep(0.22,0.86,h));
    vec3 L = normalize(vec3(-0.55,0.42,0.72));
    float diff = max(dot(n,L),0.0);
    float wrap = max(dot(n,L)*0.5+0.5,0.0);
    float rim  = pow(1.0-max(dot(n,normalize(-vView)),0.0),2.6);
    vec3 col = base*(0.035 + diff*1.05 + wrap*0.12);
    col += vec3(0.22,0.30,0.55)*rim*0.62;
    col += vec3(0.95,0.69,0.12)*rim*0.10;
    gl_FragColor = vec4(col,1.0);
  }`;

const STAR_VERTEX = `attribute float aPhase; attribute float aSize;
  uniform float uTime,uDpr; varying float vA;
  void main(){
    vA = 0.35 + 0.65*(sin(uTime*0.8+aPhase)*0.5+0.5);
    vec4 mv = modelViewMatrix*vec4(position,1.0);
    gl_PointSize = aSize*uDpr*(90.0/-mv.z);
    gl_Position = projectionMatrix*mv;
  }`;

const STAR_FRAGMENT = `varying float vA;
  void main(){
    float d = length(gl_PointCoord-0.5);
    if(d>0.5) discard;
    float a = smoothstep(0.5,0.0,d);
    gl_FragColor = vec4(vec3(0.91,0.93,0.98), a*a*vA);
  }`;

const MOON_POSITION: [number, number, number] = [4.4, -1.4, -4];

interface Driver {
  tx: number;
  ty: number;
  sN: number;
}

function makeStarAttributes(count: number) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 42 + Math.random() * 58;
    const t = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(t);
    pos[i * 3 + 1] = r * s * Math.sin(t);
    pos[i * 3 + 2] = r * u;
    phase[i] = Math.random() * 6.283;
    size[i] = Math.random() * 2.1 + 0.5;
  }
  return { pos, phase, size };
}

function Scene({ driver, isMobile, dpr }: { driver: RefObject<Driver>; isMobile: boolean; dpr: number }) {
  const { camera } = useThree();
  const moonRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);
  const smoothed = useRef({ mx: 0, my: 0 });

  const starCount = isMobile ? 2000 : 4200;
  const moonDetail = isMobile ? 24 : 48;

  const starGeometry = useMemo(() => {
    const { pos, phase, size } = makeStarAttributes(starCount);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starCount]);

  const starMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uDpr: { value: dpr } },
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const moonMaterial = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: MOON_VERTEX, fragmentShader: MOON_FRAGMENT }),
    []
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const d = driver.current;
    const sm = smoothed.current;
    sm.mx += (d.tx - sm.mx) * 0.045;
    sm.my += (d.ty - sm.my) * 0.045;

    if (moonRef.current) {
      moonRef.current.rotation.y = t * 0.026;
      moonRef.current.rotation.x = -0.18 + sm.my * 0.05;
      moonRef.current.position.y = -1.4 - d.sN * 2.4;
    }
    if (ringRef.current && moonRef.current) {
      ringRef.current.position.y = moonRef.current.position.y;
      ringRef.current.rotation.z = t * 0.03;
    }
    if (starsRef.current) {
      starsRef.current.rotation.y = t * 0.007;
    }
    starMaterial.uniforms.uTime.value = t;

    camera.position.x = sm.mx * 1.5;
    camera.position.y = -sm.my * 1.0;
    camera.lookAt(0, -d.sN * 0.8, 0);
  });

  return (
    <>
      <mesh ref={moonRef} position={MOON_POSITION} material={moonMaterial}>
        <icosahedronGeometry args={[4.6, moonDetail]} />
      </mesh>
      <mesh ref={ringRef} position={MOON_POSITION} rotation={[1.15, 0.3, 0]}>
        <ringGeometry args={[6.4, 6.9, 160]} />
        <meshBasicMaterial
          color={0x2b3a6b}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <points ref={starsRef} geometry={starGeometry} material={starMaterial} />
    </>
  );
}

export default function Cosmos() {
  const [reducedMotion] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [isMobile] = useState(() => window.innerWidth < 640);
  const driver = useRef<Driver>({ tx: 0, ty: 0, sN: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: PointerEvent) => {
      driver.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      driver.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => {
      driver.current.sN = window.scrollY / window.innerHeight;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  // Fill-rate on a mid-range Android GPU is the actual bottleneck here, and
  // both of these scale it directly: MSAA roughly doubles per-pixel cost for
  // an effect this scene barely needs (a starfield and one low-poly moon),
  // and DPR cost is quadratic. 1.8 on desktop is fine; 1.5 on mobile keeps
  // the moon looking sharp without asking a weak GPU to shade 44% more
  // pixels than it needs to for what's mostly flat black.
  const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.8);

  return (
    <div id="scene" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas
        dpr={dpr}
        gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 45, near: 0.1, far: 300, position: [0, 0, 16] }}
      >
        <Scene driver={driver} isMobile={isMobile} dpr={dpr} />
      </Canvas>
    </div>
  );
}
