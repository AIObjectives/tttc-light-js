/**
 * Feature flags for Next.js
 *
 * This module provides the correct feature flag implementation based on the environment:
 * - Client-side (browser): Uses posthog-js for browser-safe PostHog integration
 * - Server-side (SSR/API): Uses posthog-node via @common for full Node.js support
 *
 * Usage:
 *
 * Client Components:
 * ```tsx
 * "use client";
 * import { useFeatureFlag } from "@/hooks/useFeatureFlag";
 * import { initializeFeatureFlags } from "@/lib/feature-flags/featureFlags";
 *
 * // Initialize once in a top-level client component or layout
 * initializeFeatureFlags();
 *
 * function MyComponent() {
 *   const { enabled, loading } = useFeatureFlag("my-feature");
 *   if (loading) return <div>Loading...</div>;
 *   return enabled ? <NewFeature /> : <OldFeature />;
 * }
 * ```
 *
 * Server Components:
 * ```tsx
 * import { isFeatureEnabled } from "@/lib/feature-flags/featureFlags.server";
 *
 * async function MyServerComponent() {
 *   const enabled = await isFeatureEnabled("my-feature", { userId: "123" });
 *   return enabled ? <NewFeature /> : <OldFeature />;
 * }
 * ```
 *
 * API Routes:
 * ```ts
 * import { initializeFeatureFlags, isFeatureEnabled } from "@/lib/feature-flags/featureFlags.server";
 *
 * export async function GET() {
 *   initializeFeatureFlags();
 *   const enabled = await isFeatureEnabled("my-feature");
 *   return Response.json({ enabled });
 * }
 * ```
 */

// This file intentionally left empty - import from specific files:
// - featureFlags.ts for client-side
// - featureFlags.server.ts for server-side

export {};
