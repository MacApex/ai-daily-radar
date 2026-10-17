import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Float, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type Props = { theme: 'dark' | 'light'; mobile: boolean; active: boolean; picks: number }

const PALETTE = {
  dark: { a: '#8b7bff', b: '#3ee6c4', c: '#ff9d5c', glass: '#d9d4ff', pts: '#c9c3ff', blob: 0.7, env: 1.25 },
  light: { a: '#a79bff', b: '#7fe8d2', c: '#ffbf91', glass: '#cfc8ff', pts: '#5b45e0', blob: 0.5, env: 0.65 },
}

/** Soft gradient blobs behind the glass so transmission has colour to refract. */
function Backdrop({ theme, boost }: { theme: 'dark' | 'light'; boost: number }) {
  const p = PALETTE[theme]
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uA: { value: new THREE.Color(p.a) },
          uB: { value: new THREE.Color(p.b) },
          uC: { value: new THREE.Color(p.c) },
          uK: { value: Math.min(p.blob * boost, 0.95) },
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `
          varying vec2 vUv; uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uK;
          float blob(vec2 uv, vec2 c, float r){ return smoothstep(r, 0.0, distance(uv, c)); }
          void main(){
            float t = uTime * 0.12;
            float a = blob(vUv, vec2(0.62 + 0.06*sin(t), 0.58 + 0.05*cos(t*1.3)), 0.34);
            float b = blob(vUv, vec2(0.80 + 0.05*cos(t*0.8), 0.36 + 0.06*sin(t)), 0.26);
            float c = blob(vUv, vec2(0.48 + 0.05*sin(t*1.1), 0.30 + 0.04*cos(t)), 0.22);
            c *= 0.6;
            vec3 col = uA*a + uB*b + uC*c;
            float alpha = clamp(a + b + c, 0.0, 1.0) * uK;
            gl_FragColor = vec4(col / max(a+b+c, 0.001), alpha);
          }`,
      }),
    [p.a, p.b, p.c, p.blob, boost],
  )
  useFrame((_, dt) => { mat.uniforms.uTime.value += dt })
  return (
    <mesh position={[0, 0, -6]} scale={[40, 40, 1]} material={mat}>
      <planeGeometry />
    </mesh>
  )
}

function Constellation({ count, color, picks }: { count: number; color: string; picks: number }) {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const r = 5.5 + Math.random() * 3.5
      const s = Math.sqrt(1 - u * u)
      pos.set([r * s * Math.cos(th), r * u * 0.7, r * s * Math.sin(th) - 2], i * 3)
      size[i] = i < picks ? 5 : 0.6 + Math.random() * 1.6
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('size', new THREE.BufferAttribute(size, 1))
    return g
  }, [count, picks])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uPx: { value: Math.min(window.devicePixelRatio, 1.5) } },
        vertexShader: `attribute float size; uniform float uPx; varying float vS;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vS=size; gl_PointSize = size * uPx * (14.0 / -mv.z); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uColor; varying float vS;
          void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.0, d); a = pow(a, vS > 4.0 ? 1.2 : 2.0);
            vec3 c = vS > 4.0 ? vec3(1.0, 0.82, 0.6) : uColor; gl_FragColor = vec4(c, a * (vS > 4.0 ? 1.0 : 0.75)); }`,
      }),
    [color],
  )
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.025 })
  return <points ref={ref} geometry={geo} material={mat} />
}

function Glass({ geometry, position, scale, color, speed, env }: { geometry: JSX.Element; position: [number, number, number]; scale: number; color: string; speed: number; env: number }) {
  return (
    <Float speed={speed} rotationIntensity={0.9} floatIntensity={1.1}>
      <mesh position={position} scale={scale}>
        {geometry}
        <meshPhysicalMaterial
          color={color}
          transmission={1}
          thickness={1.4}
          roughness={0.08}
          ior={1.45}
          iridescence={1}
          iridescenceIOR={1.35}
          iridescenceThicknessRange={[120, 680]}
          clearcoat={1}
          clearcoatRoughness={0.1}
          envMapIntensity={env}
          attenuationColor={color}
          attenuationDistance={3}
        />
      </mesh>
    </Float>
  )
}

/** Adapts camera fov to the viewport aspect so portrait screens get a framed, full-bleed scene. */
function CameraFit() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / Math.max(size.height, 1)
    // portrait: widen the vertical fov a little so the tall view is filled, pull camera closer
    cam.fov = aspect < 1 ? 52 : 40
    cam.position.z = aspect < 1 ? 7 : 8
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

/** Pointer + scroll reactive rig. Scroll keeps the scene turning instead of sliding it away. */
function Rig({ children, mobile }: { children: React.ReactNode; mobile: boolean }) {
  const g = useRef<THREE.Group>(null)
  const { viewport } = useThree()
  useFrame((state, dt) => {
    if (!g.current) return
    const scroll = window.scrollY / Math.max(window.innerHeight, 1)
    const hero = Math.min(scroll, 1)
    const k = 1 - Math.pow(0.002, dt)
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, state.pointer.x * 0.35 + scroll * 0.45, k)
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, -state.pointer.y * 0.2 + Math.sin(scroll * 0.6) * 0.3, k)
    g.current.position.y = THREE.MathUtils.lerp(g.current.position.y, Math.sin(scroll * 0.8) * (mobile ? 0.6 : 0.4), k)
    // desktop: sits right of the hero copy, drifts toward centre once you scroll into content
    const x = mobile ? 0 : Math.min(viewport.width * 0.2, 2.6) * (1 - hero * 0.55)
    g.current.position.x = THREE.MathUtils.lerp(g.current.position.x, x, k)
  })
  return <group ref={g}>{children}</group>
}

export default function HeroScene({ theme, mobile, active, picks }: Props) {
  const [dpr, setDpr] = useState(1.5)
  const [degraded, setDegraded] = useState(false)
  const p = PALETTE[theme]
  const s = mobile ? 0.72 : 1
  // portrait: spread the forms vertically so they fill a tall viewport instead of clustering
  const P = (x: number, y: number, z: number): [number, number, number] => (mobile ? [x * 1.0, y * 1.9, z] : [x, y, z])
  return (
    <Canvas
      dpr={[1, dpr]}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: !mobile, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 8], fov: 40 }}
      style={{ position: 'absolute', inset: 0 }}
      eventSource={document.body}
      eventPrefix="client"
      aria-hidden
    >
      <CameraFit />
      <PerformanceMonitor onDecline={() => { setDpr(1); setDegraded(true) }} />
      <Backdrop theme={theme} boost={mobile ? 1.3 : 1} />
      <Constellation count={degraded || mobile ? 280 : 600} color={p.pts} picks={picks} />
      <Rig mobile={mobile}>
        <group position={[0, mobile ? 1.5 : 0, 0]} scale={s}>
          <Glass geometry={<torusKnotGeometry args={[0.8, 0.28, 180, 28]} />} position={P(0.2, 0.3, 0)} scale={1} color={p.glass} speed={1.4} env={p.env} />
          <Glass geometry={<icosahedronGeometry args={[0.75, 0]} />} position={P(-2.0, 1.3, -0.8)} scale={1} color={p.a} speed={1.8} env={p.env} />
          <Glass geometry={<capsuleGeometry args={[0.32, 0.9, 12, 24]} />} position={P(1.9, -1.1, 0.4)} scale={1} color={p.b} speed={2.1} env={p.env} />
          {!degraded && <Glass geometry={<torusGeometry args={[0.55, 0.2, 32, 80]} />} position={P(2.1, 1.5, -1.2)} scale={1} color={p.c} speed={1.6} env={p.env} />}
          {!degraded && <Glass geometry={<octahedronGeometry args={[0.55, 0]} />} position={P(-1.5, -1.4, 0.2)} scale={1} color={p.glass} speed={2.4} env={p.env} />}
        </group>
      </Rig>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} color={p.a} position={[-4, 2, 3]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={2.4} color={p.b} position={[4, -2, 3]} scale={[6, 3, 1]} />
        <Lightformer form="ring" intensity={4} color={p.c} position={[0, 4, -4]} scale={3} />
        <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 0, 6]} scale={[10, 1, 1]} />
      </Environment>
    </Canvas>
  )
}
