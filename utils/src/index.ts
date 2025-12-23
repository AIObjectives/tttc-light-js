import { turboToSchemaScript } from "./scripts/turboToSchemaScript";
import { select } from "./tools/terminal";

(async () => {
  const options = ["Translate: Turbo => t3c-light schema", "Exit"] as const;
  console.log("T3C Code Utilities");
  const result = await select("What would you like to run?", options);

  switch (result) {
    case "Translate: Turbo => t3c-light schema": {
      try {
        await turboToSchemaScript();
        process.exit(0);
      } catch (e) {
        if (e instanceof Error) {
          console.error(`${e.message}: \n Stack: \n ${e.stack}`);
          process.exit(1);
        }
      }
      break;
    }
    case "Exit": {
      console.log("Exiting...");
      process.exit(0);
      break;
    }
    default: {
      console.error(
        "Error occurred: index script received unrecognized options",
      );
    }
  }
})();
