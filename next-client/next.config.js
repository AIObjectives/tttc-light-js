// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: "standalone",
  typescript: {
    tsconfigPath: "tsconfig.build.json",
  },
};

module.exports = nextConfig;
