/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.0.22', 'spboxwin.iptime.org'],
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
