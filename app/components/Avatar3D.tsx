'use client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useState } from 'react';
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

/**
 * Convert a loaded MTL material into a matte PBR material that responds nicely
 * to studio lighting: albedo-only, fully rough, non-metallic — so it catches
 * soft form shading without any glossy "sparkle".
 */
function toStudioMaterial(material: THREE.Material): THREE.MeshStandardMaterial {
  const src = material as THREE.MeshPhongMaterial;
  const map = src.map ?? null;
  if (map) map.colorSpace = THREE.SRGBColorSpace;

  const studio = new THREE.MeshStandardMaterial({
    map,
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
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

interface Avatar3DProps {
  userId: string;
  thumbnailUrl?: string | null;
}

export default function Avatar3D({ userId, thumbnailUrl }: Avatar3DProps) {
  const [data, setData] = useState<ModelData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [failed, setFailed] = useState(false);

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
      } catch {
        // noop — falls back to the thumbnail.
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

    manager.onLoad = () => {
      if (!cancelled && loaded) setObject(loaded);
    };
    manager.onError = () => {
      if (!cancelled) setFailed(true);
    };

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
          () => {
            if (!cancelled) setFailed(true);
          },
        );
      },
      undefined,
      () => {
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
      <div className="w-full aspect-square animate-in fade-in duration-500">
        <Canvas
          shadows="soft"
          camera={{ position: [0, 0, 25], fov: 30 }}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
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
          <OrbitControls
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.08}
            autoRotate
            autoRotateSpeed={1.25}
            enableZoom={false}
            enablePan={false}
            minDistance={25}
            maxDistance={25}
          />
        </Canvas>
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
