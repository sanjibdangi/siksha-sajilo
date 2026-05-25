/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Keep large Node.js SDKs out of the Webpack bundle — loaded from node_modules
    // at runtime instead, which reduces cold start time on Vercel Functions.
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
    // Tree-shake these packages at build time so only imported symbols are bundled,
    // reducing the client JS payload and cold-start parse time.
    optimizePackageImports: ['react-markdown', 'remark-gfm'],
  },
}

export default nextConfig
