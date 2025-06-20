import process from "node:process";

const makeBaseUrl = () => {
  if (process.env.CI === "true") {
    // return "https://t3c-next-client-staging-384505539696.us-central1.run.app";
    return "http://localhost:3000";
  } else {
    return "http://localhost:3000";
    // return "http://talktothe.city"
  }
};

const reportBaseUrl = new URL("/report/", makeBaseUrl());

export const testUrl = new URL(
  "https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2Ftest%2520longer%2520report-1740686953925.json",
  reportBaseUrl,
);
