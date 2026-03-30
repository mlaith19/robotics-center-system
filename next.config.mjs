/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Allow larger file uploads for import (Excel/CSV)
  serverActions: {
    bodySizeLimit: "20mb",
  },
  // Required for Docker standalone deployment
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
}

export default nextConfig
