import assert from "assert";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../index";

const firebaseCredentials = Buffer.from(
  JSON.stringify("super secret do not steal"),
  "utf-8",
).toString("base64");

describe("parseConfig", () => {
  const getMissingNodeEnv = () =>
    parseConfig({
      whichService: "firebase",
      node_env: undefined,
    });

  const getMalformedNodeEnv = () =>
    parseConfig({
      whichService: "firebase",
      node_env: "defect",
    });

  const getFirebaseConfig = () =>
    parseConfig({
      whichService: "firebase",
      firebaseCredentials,
      node_env: "test",
    });

  const getPostgresConfig = () =>
    parseConfig({
      whichService: "postgres",
      postgresConnectionString: "blah",
      node_env: "test",
    });

  const getMissingWhich = () =>
    parseConfig({
      whichService: undefined,
      node_env: "test",
    });

  const getMalformedWhich = () =>
    parseConfig({
      whichService: "",
      node_env: "test",
    });

  const getMissingFirebase = () =>
    parseConfig({
      whichService: "firebase",
      node_env: "test",
    });

  const getMissingPostgres = () =>
    parseConfig({
      whichService: "postgres",
      node_env: "test",
    });

  describe("Invalid node env fails", () => {
    it("Missing node env causes failure", () => {
      expect(() => getMissingNodeEnv()).toThrow();
    });

    it("Malformed node env causes failure", () => {
      expect(() => getMalformedNodeEnv()).toThrow();
    });
  });

  describe("Invalid WHICH_SERVICE fails", () => {
    it("Missing WHICH causes failure", () => {
      expect(() => getMissingWhich()).toThrow();
    });

    it("Malformed WHICH causes failure", () => {
      expect(() => getMalformedWhich()).toThrow();
    });
  });

  describe("Firebase", () => {
    it("Valid firebase config succeeds", () => {
      const firebaseConfig = getFirebaseConfig();
      expect(firebaseConfig.type === "firebase").toBe(true);
      assert(firebaseConfig.type === "firebase");
      expect(firebaseConfig.credentials.length).greaterThan(0);
    });

    it("Invalid firebase credentials fails", () => {
      expect(() => getMissingFirebase()).toThrow();
    });
  });

  describe("Postgres", () => {
    it("Valid postgres config succeeds", () => {
      const postgresConfig = getPostgresConfig();
      expect(postgresConfig.type === "postgres").toBe(true);
      assert(postgresConfig.type === "postgres");
      expect(postgresConfig.connectionString.length).greaterThan(0);
    });

    it("Invalid postgres credentials fails", () => {
      expect(() => getMissingPostgres()).toThrow();
    });
  });
});
