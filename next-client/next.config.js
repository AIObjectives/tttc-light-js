// @ts-check
const path = require("node:path");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: "standalone",
  // Set to monorepo root for pnpm workspace support
  outputFileTracingRoot: path.join(__dirname, ".."),

  // Transpile local workspace packages (required for Turbopack and pnpm workspaces)
  transpilePackages: ["tttc-common"],

  // Turbopack configuration for pnpm workspaces
  // Note: In Next.js 16, experimental.turbo becomes just "turbopack"
  turbopack: {
    root: path.join(__dirname, ".."), // Monorepo root for module resolution
  },
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
    // Tree-shake Radix UI and other large packages to only include used exports
    optimizePackageImports: [
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-progress",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "lucide-react",
      "date-fns",
    ],
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

module.exports = withBundleAnalyzer(nextConfig);
