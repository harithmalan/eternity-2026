import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { subscribeLaunchVisualPhase, type LaunchVisualPhase } from '../lib/launchVisuals';

const STAR_VERTEX = `attribute float aPhase; attribute float aSize;
  uniform float uTime,uDpr; varying float vA;
  void main(){
    vA = 0.35 + 0.65*(sin(uTime*0.8+aPhase)*0.5+0.5);
    vec4 mv = modelViewMatrix*vec4(position,1.0);
    gl_PointSize = aSize*uDpr*(90.0/-mv.z);
    gl_Position = projectionMatrix*mv;
  }`;

const STAR_FRAGMENT = `varying float vA; uniform float uBrightness;
  void main(){
    float d = length(gl_PointCoord-0.5);
    if(d>0.5) discard;
    float a = smoothstep(0.5,0.0,d);
    gl_FragColor = vec4(vec3(0.91,0.93,0.98), a*a*vA*uBrightness);
  }`;

const BURST_VERTEX = `attribute vec3 aVelocity; attribute float aSize; attribute float aDelay;
  uniform float uElapsed, uDpr; varying float vA;
  void main(){
    float t = clamp((uElapsed - aDelay) / 1.4, 0.0, 1.0);
    float eased = 1.0 - pow(1.0 - t, 3.0);
    vA = 1.0 - t;
    vec3 p = position + aVelocity * eased * 42.0;
    vec4 mv = modelViewMatrix*vec4(p,1.0);
    gl_PointSize = aSize*uDpr*(120.0/-mv.z);
    gl_Position = projectionMatrix*mv;
  }`;

const BURST_FRAGMENT = `varying float vA;
  void main(){
    float d = length(gl_PointCoord-0.5);
    if(d>0.5) discard;
    float a = smoothstep(0.5,0.0,d);
    gl_FragColor = vec4(vec3(0.95,0.71,0.12), a*a*vA);
  }`;

const BURST_COUNT = 120;

function makeBurstAttributes() {
  const pos = new Float32Array(BURST_COUNT * 3);
  const vel = new Float32Array(BURST_COUNT * 3);
  const size = new Float32Array(BURST_COUNT);
  const delay = new Float32Array(BURST_COUNT);
  for (let i = 0; i < BURST_COUNT; i++) {
    const t = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const s = Math.sqrt(1 - u * u);
    vel[i * 3] = s * Math.cos(t);
    vel[i * 3 + 1] = s * Math.sin(t);
    vel[i * 3 + 2] = u * 0.6;
    size[i] = 1.5 + Math.random() * 3;
    delay[i] = Math.random() * 0.25;
  }
  return { pos, vel, size, delay };
}

function BurstParticles({ dpr, startedAt }: { dpr: number; startedAt: number }) {
  const geometry = useMemo(() => {
    const { pos, vel, size, delay } = makeBurstAttributes();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uElapsed: { value: 0 }, uDpr: { value: dpr } },
        vertexShader: BURST_VERTEX,
        fragmentShader: BURST_FRAGMENT,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame((state) => {
    material.uniforms.uElapsed.value = state.clock.getElapsedTime() - startedAt;
  });

  return <points geometry={geometry} material={material} />;
}

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

function Scene({
  driver,
  isMobile,
  dpr,
  launchPhase,
}: {
  driver: RefObject<Driver>;
  isMobile: boolean;
  dpr: number;
  launchPhase: LaunchVisualPhase;
}) {
  const { camera, clock } = useThree();
  const starsRef = useRef<THREE.Points>(null);
  const smoothed = useRef({ mx: 0, my: 0 });
  const spinSpeed = useRef(1);
  const scaleFactor = useRef(1);

  // Set synchronously during render (not inside useFrame, which mutates
  // refs without ever triggering a re-render) so <BurstParticles> mounts
  // on the very first render where launchPhase flips to 'burst', instead
  // of never mounting at all.
  const burstStartRef = useRef<number | null>(null);
  if (launchPhase === 'burst') {
    if (burstStartRef.current === null) burstStartRef.current = clock.getElapsedTime();
  } else {
    burstStartRef.current = null;
  }

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
        uniforms: { uTime: { value: 0 }, uDpr: { value: dpr }, uBrightness: { value: 1 } },
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

    // The launch sequence's "collapse" and "burst" stages ride on this same
    // mounted starfield rather than a second renderer — the vortex is this
    // same field spinning up and rushing inward, not a separate mesh.
    const targetSpin = launchPhase === 'collapse' ? 9 : 1;
    const targetScale = launchPhase === 'collapse' ? 0.32 : launchPhase === 'burst' ? 1.4 : 1;
    const targetBrightness = launchPhase === 'dim' || launchPhase === 'collapse' ? 2.1 : launchPhase === 'burst' ? 1.4 : 1;
    spinSpeed.current += (targetSpin - spinSpeed.current) * 0.06;
    scaleFactor.current += (targetScale - scaleFactor.current) * 0.05;
    starMaterial.uniforms.uBrightness.value += (targetBrightness - starMaterial.uniforms.uBrightness.value) * 0.05;

    if (starsRef.current) {
      starsRef.current.rotation.y += 0.007 * spinSpeed.current * (1 / 60);
      const s = scaleFactor.current;
      starsRef.current.scale.set(s, s, s);
    }
    starMaterial.uniforms.uTime.value = t;

    camera.position.x = sm.mx * 1.5;
    camera.position.y = -sm.my * 1.0;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <points ref={starsRef} geometry={starGeometry} material={starMaterial} />
      {launchPhase === 'burst' && burstStartRef.current !== null && <BurstParticles dpr={dpr} startedAt={burstStartRef.current} />}
    </>
  );
}

export default function Cosmos() {
  const [reducedMotion] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [isMobile] = useState(() => window.innerWidth < 640);
  const driver = useRef<Driver>({ tx: 0, ty: 0 });
  const [launchPhase, setLaunchPhase] = useState<LaunchVisualPhase>('none');

  useEffect(() => subscribeLaunchVisualPhase(setLaunchPhase), []);

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
        <Scene driver={driver} isMobile={isMobile} dpr={dpr} launchPhase={launchPhase} />
      </Canvas>
    </div>
  );
}
