/**
 * This file runs before NextJS and checks for the right env variables.
 */

const { readFileSync } = require("fs");
const dotenv = require("dotenv");
const assert = require("assert");

// get args from cmd line
const args = process.argv.slice(2).reduce((accum, curr) => {
  const term = curr.split("=");
  // let obj = {}
  accum[term[0]] = term[1];
  return accum;
}, {});
assert(Object.keys(args).includes("env"));
assert(Object.keys(args).includes("example"));

// get paths to env and example files
const path = (name) => `${__dirname}/${name}`;
const examplePath = path(args["example"]);
const envPath = path(args["env"]);

const exampleBuf = readFileSync(examplePath);
const dotenvBuf = readFileSync(envPath);

// get keys from files
const setOfKeys = (input) => new Set(Object.keys(dotenv.parse(input)));
const exampleConfigKeys = setOfKeys(exampleBuf);
const envConfigKeys = setOfKeys(dotenvBuf);

// if the env and example files are mismatched, throw an error
function setEquals(set1, set2) {
  return set1.isSubsetOf(set2) && set2.isSubsetOf(set1);
}

function findMissingKeys(set1, set2) {
  return Array(...set1.symmetricDifference(set2).keys());
}

if (!setEquals(envConfigKeys, exampleConfigKeys)) {
  const missingKeys = findMissingKeys(exampleConfigKeys, envConfigKeys);
  throw new Error("Mismatched .env and example env: " + missingKeys);
}
