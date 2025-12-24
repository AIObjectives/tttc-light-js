/**
 * Middleware configuration for Zustand stores.
 *
 * We use devtools + immer as the standard middleware stack.
 * The devtools middleware provides Redux DevTools integration for debugging.
 * The immer middleware enables mutable syntax for immutable updates.
 *
 * Usage pattern in store files:
 *
 * ```ts
 * import { create } from "zustand";
 * import { devtools } from "zustand/middleware";
 * import { immer } from "zustand/middleware/immer";
 *
 * export const useMyStore = create<MyStore>()(
 *   devtools(
 *     immer((set, get) => ({
 *       // state and actions
 *     })),
 *     { name: "myStore", enabled: process.env.NODE_ENV === "development" }
 *   )
 * );
 * ```
 *
 * Note: We use the middleware directly in each store rather than a generic
 * wrapper because TypeScript's inference works better with concrete types.
 */

export const DEVTOOLS_ENABLED = process.env.NODE_ENV === "development";
