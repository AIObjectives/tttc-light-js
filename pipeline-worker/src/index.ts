process.loadEnvFile(".env");

import { initServices } from "./services";

async function main() {
  const _services = initServices();
}

main().then(console.log);
