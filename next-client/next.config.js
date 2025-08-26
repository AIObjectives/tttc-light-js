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
  webpack: (config, { isServer }) => {
    // Handle both server and client builds to avoid Node.js modules in browser
    if (!isServer) {
      // Client-side: exclude Node.js modules that cause issues in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        worker_threads: false,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        os: false,
        "pino-pretty": false,
        "thread-stream": false,
      };

      // Alias problematic modules to prevent bundling
      config.resolve.alias = {
        ...config.resolve.alias,
        worker_threads: false,
        "pino-pretty": false,
        "thread-stream": false,
        "pino-worker": false,
      };
    } else {
      // Server-side: Fix for pino/thread-stream worker.js path resolution in server bundles
      config.resolve.alias = {
        ...config.resolve.alias,
        "pino-worker": false,
      };

      // Only externalize specific pino modules that cause worker issues
      // Be more careful with externals to avoid affecting other modules
      const originalExternals = config.externals || [];
      config.externals = [
        ...originalExternals,
        // Only externalize the specific modules causing worker issues
        ({ context, request }, callback) => {
          if (request === "pino-pretty" || request === "thread-stream") {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
