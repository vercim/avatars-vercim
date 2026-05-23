import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tr.rbxcdn.com' },
      { protocol: 'https', hostname: 'thumbnails.roblox.com' },
      { protocol: 'https', hostname: 'www.roblox.com' },
    ],
  },
};

export default nextConfig;
