import type { Config } from "jest";

const config: Config = {
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};

export default config;
