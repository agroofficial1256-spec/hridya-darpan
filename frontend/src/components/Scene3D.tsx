import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { VESSEL_TARGETS, riskColor, type VesselTarget } from '../config/vessels'

// Flip this to true (and drop a file at public/models/heart.glb) to swap in
// an authored anatomical mesh - the artery routing/coloring logic below is
// unaffected either way, per the "config-only extension" requirement.
const HAS_CUSTOM_MODEL = false

interface Props {
  probabilities: Record<string, number>
  selected: string | null
  onSelect: (id: string) => void
}

const ARTERY_PATHS: Record<string, [number, number, number][]> = {
  lad: [
    [0, 0.95, 0.78],
    [0.1, 0.4, 0.88],
    [0.15, -0.15, 0.82],
    [0.1, -0.7, 0.58],
    [0, -1.28, 0.08],
  ],
  lcx: [
    [-0.32, 0.82, 0.5],
    [-0.82, 0.38, 0.22],
    [-0.88, -0.2, -0.3],
    [-0.6, -0.8, -0.52],
    [-0.2, -1.18, -0.28],
  ],
  rca: [
    [0.32, 0.82, 0.5],
    [0.82, 0.35, 0.28],
    [0.88, -0.3, -0.02],
    [0.55, -0.92, -0.28],
    [0.1, -1.22, -0.12],
  ],
}

// Revolved profile (radius, height) for the ventricular mass - apex at the
// bottom tapering point, widest around the mid-base, narrowing again near
// the top where the atria sit. Rendered with THREE.LatheGeometry.
const VENTRICLE_PROFILE: [number, number][] = [
  [0.0, -1.3],
  [0.22, -1.12],
  [0.5, -0.78],
  [0.74, -0.4],
  [0.84, 0.0],
  [0.78, 0.4],
  [0.58, 0.72],
  [0.34, 0.92],
  [0.0, 1.0],
]

function HeartBody({ probability }: { probability: number }) {
  const color = riskColor(probability)
  const deepColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#3f0d10'), 0.35).getStyle(), [color])

  const ventricleGeometry = useMemo(
    () => new THREE.LatheGeometry(VENTRICLE_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48),
    [],
  )

  const svcCurve = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.35, 0.95, -0.1),
          new THREE.Vector3(-0.5, 1.15, -0.05),
          new THREE.Vector3(-0.62, 1.4, 0.05),
          new THREE.Vector3(-0.58, 1.68, 0.12),
        ]),
        24,
        0.14,
        16,
        false,
      ),
    [],
  )
  const aortaCurve = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.1, 1.0, -0.05),
          new THREE.Vector3(0.22, 1.3, 0.02),
          new THREE.Vector3(0.3, 1.6, 0.08),
          new THREE.Vector3(0.22, 1.85, 0.1),
        ]),
        24,
        0.16,
        16,
        false,
      ),
    [],
  )
  const pulmonaryCurve = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.32, 0.98, -0.1),
          new THREE.Vector3(0.44, 1.22, -0.08),
          new THREE.Vector3(0.5, 1.5, -0.04),
          new THREE.Vector3(0.46, 1.72, 0.0),
        ]),
        24,
        0.1,
        16,
        false,
      ),
    [],
  )

  return (
    <group rotation={[0.05, 0, 0.12]}>
      {/* Ventricular mass */}
      <mesh geometry={ventricleGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial color={deepColor} roughness={0.38} clearcoat={0.55} clearcoatRoughness={0.25} sheen={0.4} sheenColor={color} />
      </mesh>
      {/* Left/right atria bulges */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.42, 0.92, -0.14]} scale={[0.42, 0.36, 0.38]} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 24]} />
          <meshPhysicalMaterial color={deepColor} roughness={0.4} clearcoat={0.5} clearcoatRoughness={0.3} sheen={0.4} sheenColor={color} />
        </mesh>
      ))}
      {/* Great vessels: SVC (blue), ascending aorta + pulmonary trunk (red) */}
      <mesh geometry={svcCurve} castShadow>
        <meshPhysicalMaterial color="#5b7fb5" roughness={0.3} clearcoat={0.7} clearcoatRoughness={0.15} />
      </mesh>
      <mesh geometry={aortaCurve} castShadow>
        <meshPhysicalMaterial color="#c81e2c" roughness={0.3} clearcoat={0.7} clearcoatRoughness={0.15} />
      </mesh>
      <mesh geometry={pulmonaryCurve} castShadow>
        <meshPhysicalMaterial color="#9c1620" roughness={0.3} clearcoat={0.7} clearcoatRoughness={0.15} />
      </mesh>
    </group>
  )
}

function ArteryTube({
  target,
  probability,
  isSelected,
  isHovered,
  onHoverChange,
  onSelect,
}: {
  target: VesselTarget
  probability: number
  isSelected: boolean
  isHovered: boolean
  onHoverChange: (hovering: boolean) => void
  onSelect: () => void
}) {
  const geometry = useMemo(() => {
    const points = ARTERY_PATHS[target.id].map((p) => new THREE.Vector3(...p))
    const curve = new THREE.CatmullRomCurve3(points)
    const radius = isSelected || isHovered ? 0.075 : 0.05
    return new THREE.TubeGeometry(curve, 64, radius, 16, false)
  }, [target.id, isSelected, isHovered])

  const color = riskColor(probability)
  const emissiveIntensity = isSelected ? 0.9 : isHovered ? 0.55 : 0.25

  return (
    <mesh
      geometry={geometry}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHoverChange(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onHoverChange(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.25}
        clearcoat={0.8}
        clearcoatRoughness={0.15}
      />
      {(isSelected || isHovered) && (
        <Html position={ARTERY_PATHS[target.id][1]} distanceFactor={6} occlude={false}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded bg-ink-900/90 px-2 py-1 text-[11px] font-medium text-slate-100 shadow-lg ring-1 ring-white/10">
            {target.label} — {(probability * 100).toFixed(0)}%
          </div>
        </Html>
      )}
    </mesh>
  )
}

function SlowSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.05
  })
  return <group ref={ref}>{children}</group>
}

export default function Scene3D({ probabilities, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 0.3, 4.2], fov: 45 }} dpr={[1, 1.5]} shadows={false}>
        <color attach="background" args={['#0b0d14']} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 4, 5]} intensity={1.3} color="#fff4e8" />
        <directionalLight position={[-4, 1, 2]} intensity={0.5} color="#9fb6ff" />
        <directionalLight position={[0, -2, -4]} intensity={0.4} color="#ff8a65" />
        <pointLight position={[0, 0.5, 3]} intensity={0.3} />
        <SlowSpin>
          <HeartBody probability={probabilities.cad ?? 0} />
          {VESSEL_TARGETS.map((t) => (
            <ArteryTube
              key={t.id}
              target={t}
              probability={probabilities[t.id] ?? 0}
              isSelected={selected === t.id}
              isHovered={hovered === t.id}
              onHoverChange={(h) => setHovered(h ? t.id : null)}
              onSelect={() => onSelect(t.id)}
            />
          ))}
        </SlowSpin>
        <OrbitControls enablePan={false} minDistance={2.2} maxDistance={7} />
      </Canvas>
      {!HAS_CUSTOM_MODEL && (
        <p className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-slate-500">
          Procedural low-poly heart · drag to rotate · scroll to zoom · click a vessel
        </p>
      )}
    </div>
  )
}
