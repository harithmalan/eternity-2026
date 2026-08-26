import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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

interface Driver {
  tx: number;
  ty: number;
}

function makeStarAttributes(count: number) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 30 + Math.random() * 90;
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
  const starsRef = useRef<THREE.Points>(null);
  const smoothed = useRef({ mx: 0, my: 0 });

  const starCount = isMobile ? 2000 : 6000;

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

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const d = driver.current;
    const sm = smoothed.current;
    sm.mx += (d.tx - sm.mx) * 0.045;
    sm.my += (d.ty - sm.my) * 0.045;

    if (starsRef.current) {
      starsRef.current.rotation.y = t * 0.007;
    }
    starMaterial.uniforms.uTime.value = t;

    camera.position.x = sm.mx * 1.5;
    camera.position.y = -sm.my * 1.0;
    camera.lookAt(0, 0, 0);
  });

  return <points ref={starsRef} geometry={starGeometry} material={starMaterial} />;
}

export default function Cosmos() {
  const [reducedMotion] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [isMobile] = useState(() => window.innerWidth < 640);
  const driver = useRef<Driver>({ tx: 0, ty: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: PointerEvent) => {
      driver.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      driver.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  // Fill-rate on a mid-range Android GPU is the actual bottleneck here, and
  // both of these scale it directly: MSAA roughly doubles per-pixel cost and
  // DPR cost is quadratic. 1.8 on desktop is fine; 1.5 on mobile keeps the
  // starfield sharp without asking a weak GPU to shade 44% more pixels than
  // it needs to for what's mostly flat black.
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
