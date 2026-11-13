import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Host photos (2 MB at most) travel through a server action, so its default 1 MB body limit is raised.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // Host photos are stored in a public Vercel Blob store.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
