import { describe, it, expect } from "vitest";
import { Option, Effect, Layer } from "effect";
import { FireStore, RefStoreService, CollectionName } from "..";

// Fake Firestore 1: In-memory implementation
const InMemoryFireStore = Layer.succeed(FireStore, {
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: () =>
        Promise.resolve({
          data: () => ({ id, name: "test-doc", value: 123 }),
        }),
    }),
    add: (data: any) => Promise.resolve({ id: "new-id-123" }),
  }),
  runTransaction: (fn: any) =>
    fn({
      get: (ref: any) =>
        Promise.resolve({
          data: () => ({ existing: true }),
        }),
      update: (ref: any, data: any) => {},
    }),
} as any);

// Fake Firestore 2: Empty store (returns undefined)
const EmptyFireStore = Layer.succeed(FireStore, {
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: () =>
        Promise.resolve({
          data: () => undefined,
        }),
    }),
    add: (data: any) => Promise.resolve({ id: "new-id" }),
  }),
  runTransaction: (fn: any) =>
    fn({
      get: (ref: any) =>
        Promise.resolve({
          data: () => undefined,
        }),
      update: (ref: any, data: any) => {},
    }),
} as any);

// Fake Firestore 3: Specific test data
const TestDataFireStore = Layer.succeed(FireStore, {
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: () =>
        Promise.resolve({
          data: () =>
            id === "user-1" ? { name: "Alice", age: 30 } : undefined,
        }),
    }),
    add: (data: any) => Promise.resolve({ id: "created-doc-id" }),
  }),
  runTransaction: (fn: any) =>
    fn({
      get: (ref: any) =>
        Promise.resolve({
          data: () => ({ canModify: true }),
        }),
      update: (ref: any, data: any) => {},
    }),
} as any);

const TestCollectionName = Layer.succeed(
  CollectionName,
  Effect.succeed("test-collection"),
);

describe("RefStoreService with fake Firestore", () => {
  it("should get document from in-memory store", async () => {
    const program = Effect.gen(function* () {
      const refStore = yield* RefStoreService;
      return yield* refStore.get("doc-1");
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(RefStoreService.Default),
        Effect.provide(InMemoryFireStore),
        Effect.provide(TestCollectionName),
      ),
    );

    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrNull(result)).toEqual({
      id: "doc-1",
      name: "test-doc",
      value: 123,
    });
  });

  it("should return None from empty store", async () => {
    const program = Effect.gen(function* () {
      const refStore = yield* RefStoreService;
      return yield* refStore.get("any-id");
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(RefStoreService.Default),
        Effect.provide(EmptyFireStore),
        Effect.provide(TestCollectionName),
      ),
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("should create document", async () => {
    const program = Effect.gen(function* () {
      const refStore = yield* RefStoreService;
      return yield* refStore.create({ name: "New Doc" });
    });

    const docId = await Effect.runPromise(
      program.pipe(
        Effect.provide(RefStoreService.Default),
        Effect.provide(InMemoryFireStore),
        Effect.provide(TestCollectionName),
      ),
    );

    expect(docId).toBe("new-id-123");
  });

  it("should get specific test data", async () => {
    const program = Effect.gen(function* () {
      const refStore = yield* RefStoreService;
      return yield* refStore.get("user-1");
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(RefStoreService.Default),
        Effect.provide(TestDataFireStore),
        Effect.provide(TestCollectionName),
      ),
    );

    expect(Option.getOrNull(result)).toEqual({ name: "Alice", age: 30 });
  });

  it("should modify document", async () => {
    const program = Effect.gen(function* () {
      const refStore = yield* RefStoreService;
      return yield* refStore.modify("doc-1", { updated: true });
    });

    await Effect.runPromise(
      program.pipe(
        Effect.provide(RefStoreService.Default),
        Effect.provide(InMemoryFireStore),
        Effect.provide(TestCollectionName),
      ),
    );

    // Test passes if no error thrown
    expect(true).toBe(true);
  });

  it("should fail to modify non-existent document", async () => {
    const program = Effect.gen(function* () {
      const refStore = yield* RefStoreService;
      return yield* refStore.modify("nonexistent-id", { updated: true });
    });

    await expect(
      Effect.runPromise(
        program.pipe(
          Effect.provide(RefStoreService.Default),
          Effect.provide(EmptyFireStore),
          Effect.provide(TestCollectionName),
        ),
      ),
    ).rejects.toThrow();
  });
});
