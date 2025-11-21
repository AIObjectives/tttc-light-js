// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: "standalone",
  outputFileTracingRoot: __dirname, // Set to next-client directory to avoid incorrect workspace inference
  typescript: {
    tsconfigPath: "tsconfig.build.json",
  },
  images: {
    // Configure allowed image qualities to avoid Next.js 16 warning
    qualities: [75, 85, 90, 100],
    // Enable modern image formats for better compression
    formats: ["image/webp", "image/avif"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // Increased from default 1MB to support larger CSV uploads
    },
  },
  webpack: (config, { isServer, webpack }) => {
    // Prevent webpack from bundling Node.js-only logger dependencies
    // These are only used in pure Node.js environments (express-server)
    // and should never be included in Next.js bundles
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pino-pretty$/,
        contextRegExp: /./,
      }),
    );

    // Also ignore pino's worker-thread based transports
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pino-abstract-transport$/,
      }),
    );

    return config;
  },
};

module.exports = nextConfig;
