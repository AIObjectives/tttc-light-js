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
const expressScript = `cd ${__dirname}/express-server && npm i && npm run dev`;
// const pyservScript = `cd ${__dirname}/pyserver && if [ ! -f "Pipfile" ]; then pipenv install -r requirements.txt; else pipenv install; fi && pipenv shell && fastapi dev main.py`
const pyservScript = `cd ${__dirname}/pyserver && pipenv install -r requirements.txt && pipenv run fastapi dev main.py`;
const runScript = (script) =>
  child_process.exec(
    `osascript -e 'tell application \"Terminal\" to do script \"${script}\"'`,
  );

const commonProcesss = runScript(commonScript);

commonProcesss.on("exit", function () {
  console.log("finished build common folder");
  const nextProcess = runScript(nextScript);
  const expressProcess = runScript(expressScript);
  const pyserveProcess = runScript(pyservScript);
  nextProcess.on("exit", function () {
    console.log("finished setting up next dev");
  });

  expressProcess.on("exit", function () {
    console.log("finished setting up express dev");
  });

  pyserveProcess.on("exit", function () {
    console.log("finished setting up pyserver");
  });
});
