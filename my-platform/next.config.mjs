/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.0.22', 'spboxwin.iptime.org'],
  async redirects() {
    return [
      { source: '/preview/:code', destination: '/s/:code', permanent: false },
      { source: '/preview/:code/:path*', destination: '/s/:code/:path*', permanent: false },
      { source: '/my/:code', destination: '/s/:code/admin', permanent: false },
      { source: '/editor/:code', destination: '/s/:code/admin/editor', permanent: false },
    ]
  },
};

export default nextConfig;
