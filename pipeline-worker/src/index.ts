process.loadEnvFile(".env");

import { initServices } from "./services";

async function main() {
  const services = initServices();
}

main().then(console.log);
