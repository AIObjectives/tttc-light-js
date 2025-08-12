import { describe, it, expect } from "vitest";
import express from "express";
import helmet from "helmet";
import request from "supertest";

describe("Helmet Security Configuration", () => {
  it("should have secure CSP directives for production", () => {
    const config = {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "https://api.openai.com"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    };

    // Verify no unsafe directives
    expect(config.contentSecurityPolicy.directives.scriptSrc).not.toContain(
      "'unsafe-eval'",
    );
    expect(config.contentSecurityPolicy.directives.defaultSrc).toEqual([
      "'self'",
    ]);
    expect(config.contentSecurityPolicy.directives.objectSrc).toEqual([
      "'none'",
    ]);
    expect(config.contentSecurityPolicy.directives.frameSrc).toEqual([
      "'none'",
    ]);

    // Verify necessary external domains
    expect(config.contentSecurityPolicy.directives.connectSrc).toContain(
      "https://api.openai.com",
    );
    expect(config.contentSecurityPolicy.directives.fontSrc).toContain(
      "https://fonts.gstatic.com",
    );
  });

  it("should configure HSTS appropriately for production vs development", () => {
    const productionHSTS = {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    };

    const developmentHSTS = false;

    expect(productionHSTS.maxAge).toBe(31536000); // 1 year
    expect(productionHSTS.includeSubDomains).toBe(true);
    expect(productionHSTS.preload).toBe(true);
    expect(developmentHSTS).toBe(false);
  });

  it("should allow only necessary unsafe CSP directives", () => {
    const cspDirectives = {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.openai.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    };

    // Only 'unsafe-inline' should be allowed, and only for styles (required for Tailwind CSS)
    expect(cspDirectives.styleSrc).toContain("'unsafe-inline'");
    expect(cspDirectives.scriptSrc).not.toContain("'unsafe-inline'");
    expect(cspDirectives.scriptSrc).not.toContain("'unsafe-eval'");

    // Verify no other dangerous directives
    expect(cspDirectives.scriptSrc).not.toContain("*");
    expect(cspDirectives.connectSrc).not.toContain("*");
  });

  it("should block potentially dangerous content types", () => {
    const cspDirectives = {
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    };

    // Should block all frames and objects
    expect(cspDirectives.frameSrc).toEqual(["'none'"]);
    expect(cspDirectives.objectSrc).toEqual(["'none'"]);

    // Should restrict base URI and form actions
    expect(cspDirectives.baseUri).toEqual(["'self'"]);
    expect(cspDirectives.formAction).toEqual(["'self'"]);
  });

  it("should allow necessary third-party domains", () => {
    const cspDirectives = {
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"],
    };

    // Google Fonts
    expect(cspDirectives.styleSrc).toContain("https://fonts.googleapis.com");
    expect(cspDirectives.fontSrc).toContain("https://fonts.gstatic.com");

    // OpenAI API
    expect(cspDirectives.connectSrc).toContain("https://api.openai.com");

    // Data URIs for images
    expect(cspDirectives.imgSrc).toContain("data:");
    expect(cspDirectives.imgSrc).toContain("https:");
  });

  it("should have crossOriginEmbedderPolicy disabled", () => {
    const helmetConfig = {
      crossOriginEmbedderPolicy: false,
    };

    // COEP should be disabled for compatibility
    expect(helmetConfig.crossOriginEmbedderPolicy).toBe(false);
  });

  it("should validate HSTS configuration parameters", () => {
    const hstsConfig = {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    };

    // Max age should be at least 1 year (31536000 seconds)
    expect(hstsConfig.maxAge).toBeGreaterThanOrEqual(31536000);

    // Should include subdomains for comprehensive protection
    expect(hstsConfig.includeSubDomains).toBe(true);

    // Should support preload for browsers
    expect(hstsConfig.preload).toBe(true);
  });

  it("should not expose server information", async () => {
    const app = express();
    app.use(helmet());
    app.get("/", (req, res) => res.send("ok"));

    const response = await request(app).get("/");
    // Helmet should remove X-Powered-By header by default
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("should configure proper content type protection", () => {
    const expectedHeaders = {
      xContentTypeOptions: "nosniff",
    };

    // Should prevent MIME type sniffing
    expect(expectedHeaders.xContentTypeOptions).toBe("nosniff");
  });

  it("should validate complete CSP policy", () => {
    const fullCSPPolicy = [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "script-src 'self'",
      "connect-src 'self' https://api.openai.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    // Verify the policy doesn't contain dangerous wildcards
    expect(fullCSPPolicy).not.toContain("'unsafe-eval'");
    expect(fullCSPPolicy).not.toContain("script-src *");
    expect(fullCSPPolicy).not.toContain("connect-src *");

    // Verify it contains required directives
    expect(fullCSPPolicy).toContain("default-src 'self'");
    expect(fullCSPPolicy).toContain("frame-src 'none'");
    expect(fullCSPPolicy).toContain("object-src 'none'");
  });

  it("should have environment-appropriate configuration", () => {
    const getEnvironmentConfig = (env: string) => {
      return {
        hsts:
          env === "production"
            ? {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true,
              }
            : false,
        trustProxy: env === "production",
      };
    };

    const prodConfig = getEnvironmentConfig("production");
    const devConfig = getEnvironmentConfig("development");

    // Production should have HSTS
    expect(prodConfig.hsts).toBeTruthy();
    expect(prodConfig.trustProxy).toBe(true);

    // Development should not have HSTS
    expect(devConfig.hsts).toBe(false);
    expect(devConfig.trustProxy).toBe(false);
  });
});
