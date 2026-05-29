'use client';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';
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

function ObjModel({ data }: { data: ModelData }) {
  const materials = useLoader(MTLLoader, data.mtlUrl, (loader) => {
    if (data.textureCdnHost) loader.setResourcePath(data.textureCdnHost);
  });
  const obj = useLoader(OBJLoader, data.objUrl, (loader) => {
    loader.setMaterials(materials);
  });
  const centerY = (data.aabb.min.y + data.aabb.max.y) / 2;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const applyMaterialFix = (material: THREE.Material) => {
        material.side = THREE.DoubleSide;
        material.depthWrite = true;
        // Force opacity to opaque in case the loaded MTL sets transparency.
        (material as THREE.MeshStandardMaterial).transparent = false;
        (material as THREE.MeshStandardMaterial).opacity = 1;
        (material as THREE.MeshStandardMaterial).alphaTest = 0;
        material.needsUpdate = true;
      };

      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) {
          applyMaterialFix(m);
        }
      } else {
        applyMaterialFix(mesh.material);
      }
    }
  });
  return <primitive object={obj} scale={2} position={[0, -centerY * 2, 0]} rotation={[0, Math.PI, 0]} />;
}

function Loader() {
  return (
    <mesh position={[0, 0, 0]}>
      <icosahedronGeometry args={[0.3, 0]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  );
}

interface Avatar3DProps {
  userId: string;
  thumbnailUrl?: string | null;
}

export default function Avatar3D({ userId, thumbnailUrl }: Avatar3DProps) {
  const [data, setData] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/avatar-3d/${userId}`);
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        if (cancelled) return;
        if (json.available && json.objUrl) {
          setData({ objUrl: json.objUrl, mtlUrl: json.mtlUrl, textureCdnHost: json.textureCdnHost ?? null, aabb: json.aabb });
        }
      } catch {
        // noop
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="w-full aspect-square flex items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (data) {
    return (
      <div className="w-full aspect-square">
        <Canvas camera={{ position: [0, 0, 25], fov: 30 }} gl={{ alpha: true }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={0.5} />
          <Suspense fallback={<Loader />}>
            <ObjModel data={data} />
          </Suspense>
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

  return thumbnailUrl ? (
    <div className="w-full aspect-square relative flex items-center justify-center">
      <img src={thumbnailUrl} alt="Avatar" className="max-w-full max-h-full object-contain" />
    </div>
  ) : null;
}
