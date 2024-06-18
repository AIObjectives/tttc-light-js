/**
 * Opens three terminals that are used for dev
 */

import child_process from "child_process";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Scripts to run in terminal
const nextScript = `cd ${__dirname}/next-client && npm i && npm run dev`;
const commonScript = `cd ${__dirname}/common && npm i && npm run build && npm run watch`;
const expressScript = `cd ${__dirname}/express-pipeline && npm i && npm run dev`;

const runScript = (script) =>
  child_process.exec(
    `osascript -e 'tell application \"Terminal\" to do script \"${script}\"'`,
  );

const commonProcesss = runScript(commonScript);

commonProcesss.on("exit", function () {
  console.log("finished build common folder");
  const nextProcess = runScript(nextScript);
  const expressProcess = runScript(expressScript);
  nextProcess.on("exit", function () {
    console.log("finished setting up next dev");
  });

  expressProcess.on("exit", function () {
    console.log("finished setting up express dev");
  });
});
