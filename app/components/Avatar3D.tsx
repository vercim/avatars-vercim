'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import * as THREE from 'three';
import { Spinner } from '@/components/ui/spinner';

interface ModelData {
  objUrl: string;
  mtlUrl: string;
  textureCdnHost: string | null;
  aabb: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
}

// Hard ceiling so the loader can never get stuck if a texture stalls forever.
const READY_TIMEOUT_MS = 25000;

// Roblox CDN shard selection — identical algorithm to route.ts getHashUrl.
// Must use the FULL path string (including any 30DAY- prefix) to get the
// correct shard; using just the hash suffix gives a different bucket.
function rbxCdnUrl(path: string): string {
  let st = 31;
  for (let i = 0; i < path.length; i++) st ^= path.charCodeAt(i);
  return `https://t${st % 8}.rbxcdn.com/${path}`;
}

/**
 * Convert a loaded MTL material into a matte PBR material that responds nicely
 * to studio lighting: albedo-only, fully rough, non-metallic — so it catches
 * soft form shading without any glossy "sparkle".
 */
function toStudioMaterial(material: THREE.Material): THREE.MeshStandardMaterial {
  const src = material as THREE.MeshPhongMaterial;
  const map = src.map ?? null;
  if (map) map.colorSpace = THREE.SRGBColorSpace;

  const kd = src.color;
  console.log('[Avatar3D] material:', (material as THREE.Material & {name?: string}).name, {
    hasMap: !!map,
    mapUrl: map ? (map as THREE.Texture & {source?: {data?: {src?: string}}}).source?.data?.src ?? '(loading)' : null,
    kd: kd ? `rgb(${kd.r.toFixed(2)},${kd.g.toFixed(2)},${kd.b.toFixed(2)})` : null,
  });

  const studio = new THREE.MeshStandardMaterial({
    map,
    // When a texture is present, Roblox MTL files often set Kd to black (0,0,0)
    // because the texture is the sole color source. MeshStandardMaterial multiplies
    // map × color, so a black Kd would make any texture render black. Use white
    // when a map is present so the texture shows its true colors.
    color: map ? new THREE.Color(0xffffff) : (kd ? kd.clone() : new THREE.Color(0xffffff)),
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
    // For double-sided geometry, sampling the back face avoids self-shadow acne.
    shadowSide: THREE.BackSide,
  });

  material.dispose();
  return studio;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const material = mesh.material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const mat of materials) {
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      mat.dispose();
    }
  });
}

// --- Camera rig ----------------------------------------------------------
// The model is static; the "spin" is the camera orbiting it. On hover we
// smoothly steer the camera to a fixed dramatic angle and freeze the spin;
// on leave we ease back and resume orbiting.

// Canvas is 160% of the visual frame (inset -30% on each side), so the camera
// must be 1.6× further back to keep the model the same apparent size in the frame.
const CANVAS_SCALE = 1.6;
const NORMAL_RADIUS = 25 * CANVAS_SCALE;          // ≈ 40
// rad/s — matches the old OrbitControls autoRotateSpeed of 1.25 (2π/60 * speed).
const ROTATE_SPEED = ((2 * Math.PI) / 60) * 1.25;
// Bottom-left, pulled in much closer for a strong hero perspective.
// Also scaled by CANVAS_SCALE so the effective zoom ratio in the frame is preserved.
const HOVER_CAMERA_POS = new THREE.Vector3(-5 * CANVAS_SCALE, -4 * CANVAS_SCALE, 10 * CANVAS_SCALE);
const ORBIT_TARGET = new THREE.Vector3(0, 1, 0);
// Exponential-smoothing rate for the hover blend; higher = snappier.
const TRANSITION_SPEED = 1.25;

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

function CameraRig({ hovered }: { hovered: boolean }) {
  const { camera } = useThree();
  const angle = useRef(0);
  const blend = useRef(0);
  const scratch = useRef(new THREE.Vector3()).current;

  useFrame((_, delta) => {
    // Guard against large jumps after a tab switch or stall.
    const dt = Math.min(delta, 0.05);

    const target = hovered ? 1 : 0;
    blend.current += (target - blend.current) * Math.min(1, dt * TRANSITION_SPEED);
    const t = easeInOut(blend.current);

    // Spin eases to a stop as the hover blend approaches 1.
    angle.current += ROTATE_SPEED * dt * (1 - t);

    scratch.set(
      Math.sin(angle.current) * NORMAL_RADIUS,
      0,
      Math.cos(angle.current) * NORMAL_RADIUS,
    );
    scratch.lerp(HOVER_CAMERA_POS, t);
    camera.position.copy(scratch);
    camera.lookAt(ORBIT_TARGET);
  });

  return null;
}

interface Avatar3DProps {
  userId: string;
  thumbnailUrl?: string | null;
}

export default function Avatar3D({ userId, thumbnailUrl }: Avatar3DProps) {
  const [data, setData] = useState<ModelData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);

  // 1) Fetch the model metadata (URLs + bounds).
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setObject(null);
    setFailed(false);
    setFetching(true);

    async function load() {
      try {
        const res = await fetch(`/api/avatar-3d/${userId}`);
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        if (cancelled) return;
        if (json.available && json.objUrl) {
          setData({
            objUrl: json.objUrl,
            mtlUrl: json.mtlUrl,
            textureCdnHost: json.textureCdnHost ?? null,
            aabb: json.aabb,
          });
        }
      } catch (err) {
        console.warn('[Avatar3D] Failed to fetch 3D model metadata', { userId }, err);
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 2) Imperatively load geometry + materials + textures through a shared
  //    LoadingManager; only reveal once everything (textures included) is done.
  useEffect(() => {
    if (!data) return;

    let cancelled = false;
    let loaded: THREE.Object3D | null = null;
    const manager = new THREE.LoadingManager();
    let hasError = false;

    manager.onLoad = () => {
      if (!cancelled && loaded && !hasError) setObject(loaded);
    };
    manager.onError = (url) => {
      console.warn('[Avatar3D] Failed to load 3D asset:', url);
      hasError = true;
      if (!cancelled) setFailed(true);
    };

    // Roblox CDN texture paths use 30DAY-{hash} format in the MTL file, but
    // setResourcePath computes the shard from the bare hash (without the prefix).
    // XOR("30DAY-abc…") ≠ XOR("abc…"), so the shard can be wrong → 404.
    // URLModifier intercepts every resolved URL and recomputes the correct shard
    // from the actual full path string.
    manager.setURLModifier((url) => {
      const match = url.match(/^https?:\/\/t\d\.rbxcdn\.com\/(.+)$/);
      if (match) {
        const corrected = rbxCdnUrl(match[1]);
        if (corrected !== url) console.log('[Avatar3D] Shard corrected:', url, '->', corrected);
        return corrected;
      }
      console.log('[Avatar3D] Loading URL:', url);
      return url;
    });

    const mtlLoader = new MTLLoader(manager);
    if (data.textureCdnHost) mtlLoader.setResourcePath(data.textureCdnHost);

    mtlLoader.load(
      data.mtlUrl,
      (materials) => {
        if (cancelled) return;
        materials.preload();

        const objLoader = new OBJLoader(manager);
        objLoader.setMaterials(materials);
        objLoader.load(
          data.objUrl,
          (obj) => {
            if (cancelled) return;
            obj.traverse((child) => {
              const mesh = child as THREE.Mesh;
              if (!mesh.isMesh) return;

              // Roblox's OBJ export includes a flat ground/watermark plane.
              // Hide any mesh that is nearly 2-D: Y extent < 1% of XZ extent.
              mesh.geometry.computeBoundingBox();
              const bb = mesh.geometry.boundingBox!;
              const sizeY = bb.max.y - bb.min.y;
              const sizeXZ = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
              if (sizeXZ > 0 && sizeY / sizeXZ < 0.01) {
                mesh.visible = false;
                return;
              }

              // Self-shadowing only — there is no ground plane to receive onto.
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map(toStudioMaterial);
              } else if (mesh.material) {
                mesh.material = toStudioMaterial(mesh.material);
              }
            });

            const centerY = (data.aabb.min.y + data.aabb.max.y) / 2;
            obj.scale.setScalar(2);
            obj.position.y = -centerY * 2;
            obj.rotation.y = Math.PI;
            // Stored; manager.onLoad fires once textures finish too.
            loaded = obj;
          },
          undefined,
          (err) => {
            console.warn('[Avatar3D] Failed to load OBJ:', data.objUrl, err);
            if (!cancelled) setFailed(true);
          },
        );
      },
      undefined,
      (err) => {
        console.warn('[Avatar3D] Failed to load MTL:', data.mtlUrl, err);
        if (!cancelled) setFailed(true);
      },
    );

    // Safety net: reveal even if the manager never settles.
    const timer = window.setTimeout(() => {
      if (!cancelled && loaded) setObject(loaded);
    }, READY_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data]);

  // Free GPU memory when the model is replaced or the component unmounts.
  useEffect(() => {
    if (!object) return;
    return () => disposeObject(object);
  }, [object]);

  if (object) {
    return (
      <div className="w-full aspect-square animate-in fade-in duration-500 relative">
        {/* Transparent hover-capture layer — sits above the z-index stack so
            pointer events reach it even though the canvas is behind UI. */}
        <div
          className="absolute inset-0 z-10"
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        />
        {/* Canvas is 160% of the visual frame so the model can bleed outside the
            frame boundary on hover. -z-10 keeps it behind UI elements. */}
        <div className="absolute inset-[-30%] pointer-events-none -z-10">
        <Canvas
          shadows="soft"
          camera={{ position: [0, 0, 40], fov: 30 }}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <CameraRig hovered={hovered} />
          {/* Studio three-point rig — soft, render-like form shading with
              self-shadows, no glare. No ground plane = no floor shadow. */}
          <hemisphereLight args={['#ffffff', '#9a9a9a', 0.55]} />
          <ambientLight intensity={0.12} />
          {/* Key light — the only shadow caster. */}
          <directionalLight
            castShadow
            position={[5, 9, 7]}
            intensity={1.7}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.5}
            shadow-camera-far={60}
            shadow-camera-left={-7}
            shadow-camera-right={7}
            shadow-camera-top={7}
            shadow-camera-bottom={-7}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-radius={5}
          />
          {/* Fill — softens the shadow side without flattening. */}
          <directionalLight position={[-6, 3, 5]} intensity={0.5} />
          {/* Rim / back light — separates the silhouette. */}
          <directionalLight position={[-3, 6, -7]} intensity={0.9} />
          <primitive object={object} />
        </Canvas>
        </div>
      </div>
    );
  }

  // Still fetching, or model assets are not fully loaded yet.
  if (fetching || (data !== null && !failed)) {
    return (
      <div className="w-full aspect-square flex items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  return thumbnailUrl ? (
    <div className="w-full aspect-square relative flex items-center justify-center">
      <img src={thumbnailUrl} alt="Avatar" className="max-w-full max-h-full object-contain" />
    </div>
  ) : null;
}
