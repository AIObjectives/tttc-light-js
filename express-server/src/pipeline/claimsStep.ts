import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { Client } from "undici";
import { AbortController } from "abort-controller"; // If needed in your environment
export async function claimsPipelineStep(env: Env, input: ClaimsStep["data"]) {
  try {
    //console.log("Claims pipeline input:", JSON.stringify(input));

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
      //console.log("POST call started"); //Execute the POST request
      const { statusCode, headers, body } = await client.request({
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        //signal: controller.signal,
      });
      //console.log("POST call finished");

      clearTimeout(timeoutId);

      // Check status code (similar to `response.ok`)
      if (statusCode < 200 || statusCode >= 300) {
        const errorText = await body.json();
        throw new Error(`Server responded with ${statusCode}: ${errorText}`);
      }

      // Read the response body
      const jsonData = await body.json();

      // Validate the response
      const { data, usage } = apiPyserver.claimsReply.parse(jsonData);

      return { claims_tree: data, usage };
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
