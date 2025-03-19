import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";
import { Client } from "undici";
import { AbortController } from "abort-controller"; // If needed in your environment

export async function claimsPipelineStep(
  env: Env,
  openaiAPIKey: string,
  input: ClaimsStep["data"],
) {
  try {
    // Validate input
    try {
      apiPyserver.claimsRequest.parse(input);
      //console.log("Input validation passed");
    } catch (validationError) {
      console.error("Input validation failed:", validationError);
      throw validationError;
    }
  
    // Prepare the Python server URL and path
    const baseUrl = env.PYSERVER_URL.replace(/\/$/, ""); // Remove trailing slash if any
    const path = "/claims";
    //console.log("Making request to Python server:", baseUrl + path);
  
    // Create an AbortController for the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000000);

    //console.log("creating client"); // Create the Undici client
    const client = new Client(baseUrl, {
      headersTimeout: 6000000,
      bodyTimeout: 6000000,
      keepAliveTimeout: 1200000,
    });
    //console.log("Undici client created");
    try {
      //console.log("POST call started");

      // TODO: there's probably a more graceful way to do this in TS, right?
      
      // Explicitly set redirect to "follow" in production and staging to ensure any server redirects
      // (including potential HTTP to HTTPS redirects) are properly followed
      if (env.NODE_ENV === "prod" || env.NODE_ENV === "staging") {
        const { statusCode, headers, body } = await client.request({
          path: path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "openai-api-key": openaiAPIKey,
          },
          body: JSON.stringify(input),
          redirect: "follow"
        //signal: controller.signal,
        });
      } else if (env.NODE_ENV == "dev") {
        const { statusCode, headers, body } = await client.request({
          path: path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "openai-api-key": openaiAPIKey,
          },
          body: JSON.stringify(input),
        //signal: controller.signal,
        });

      }
      clearTimeout(timeoutId);

      // Check status code (similar to `response.ok`)
      if (statusCode < 200 || statusCode >= 300) {
        const errorText = await body.json();
        throw new Error(`Server responded with ${statusCode}: ${errorText}`);
      }

      // Read the response body
      const jsonData = await body.json();

      // Validate the response
      const { data, usage, cost } = apiPyserver.claimsReply.parse(jsonData);

      return { claims_tree: data, usage, cost };
    } catch (requestError: any) {
      clearTimeout(timeoutId);
      console.error("Request error:", requestError.message);
      if (requestError.cause) {
        console.error("Cause:", requestError.cause.message);
      }
      throw requestError;
    } finally {
      // Close the client connection
      await client.close();
    }
  } catch (error) {
    console.error("Claims pipeline step failed:", error);

    throw error;
  }
}
