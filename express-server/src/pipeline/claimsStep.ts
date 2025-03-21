import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";
import { Client } from "undici";
import { AbortController } from "abort-controller"; // If needed in your environment
import { Environment, requiresHttps } from "tttc-common/environmentValidation";

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

      // Create request options
      const requestOptions = {
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "openai-api-key": openaiAPIKey,
        },
        body: JSON.stringify(input),
      };
      
      // Add redirect option for staging and production environments
      if (requiresHttps(env.NODE_ENV as Environment)) {
        // In undici, followRedirect is the equivalent of fetch's redirect: "follow"
        requestOptions.followRedirect = true;
      }
      
      const { statusCode, headers, body } = await client.request(requestOptions);

      clearTimeout(timeoutId);

      // Check status code (similar to `response.ok`)
      if (statusCode < 200 || statusCode >= 300) {
        const errorText = await body.json();
        throw new Error(`Server responded with ${statusCode}: ${errorText}`);
      }

      // Read the response body
      const jsonData = await body.json();

      // Validate the response
      const { data, usage, cost } = apiPyserver.claimsResponse.parse(jsonData);

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
