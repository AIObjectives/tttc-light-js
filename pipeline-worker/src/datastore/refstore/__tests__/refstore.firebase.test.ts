import { describe, expect, it, vi, beforeEach } from "vitest";
import { FirebaseRefStore } from "../firebase";
import { z } from "zod";
import { CollectionReference, DocumentData } from "firebase-admin/firestore";
import assert from "assert";

// Mock DocumentReference
export const createMockDocumentReference = (id: string, data: any = null) => ({
  id,
  path: `collection/${id}`,
  parent: null,
  get: vi.fn().mockResolvedValue({
    exists: data !== null,
    id,
    data: vi.fn().mockReturnValue(data),
    ref: null,
  }),
  set: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({}),
  create: vi.fn().mockResolvedValue({}),
  onSnapshot: vi.fn(),
  collection: vi.fn(),
  listCollections: vi.fn().mockResolvedValue([]),
});

// Mock QuerySnapshot
const createMockQuerySnapshot = (docs: any[] = []) => ({
  docs: docs.map((data, index) => ({
    id: data.id || `doc${index}`,
    exists: true,
    data: vi.fn().mockReturnValue(data),
    ref: createMockDocumentReference(data.id || `doc${index}`, data),
  })),
  empty: docs.length === 0,
  size: docs.length,
  forEach: vi.fn((callback) => {
    docs.forEach((data, index) => {
      callback({
        id: data.id || `doc${index}`,
        exists: true,
        data: vi.fn().mockReturnValue(data),
        ref: createMockDocumentReference(data.id || `doc${index}`, data),
      });
    });
  }),
});

// Mock Transaction
export const createMockTransaction = (
  mockData: Map<string, any> = new Map(),
) => ({
  get: vi.fn((docRef: any) => {
    const data = mockData.get(docRef.id);
    return Promise.resolve({
      exists: data !== undefined,
      id: docRef.id,
      data: vi.fn().mockReturnValue(data),
      ref: docRef,
    });
  }),

  update: vi.fn((docRef: any, data: any) => {
    const existing = mockData.get(docRef.id) || {};
    mockData.set(docRef.id, { ...existing, ...data });
    return Promise.resolve();
  }),
});

// Mock Firestore instance
export const createMockFirestore = (transactionData?: Map<string, any>) => {
  const mockTransaction = createMockTransaction(transactionData);

  return {
    runTransaction: vi.fn((updateFunction: any) => {
      return Promise.resolve(updateFunction(mockTransaction));
    }),
    _getMockTransaction: () => mockTransaction, // Helper to access in tests
  };
};

// Mock CollectionReference with firestore property
export const createMockCollectionReference = (
  mockData: any[] = [],
  transactionData?: Map<string, any>,
) => {
  const mockFirestore = createMockFirestore(transactionData);

  const collectionRef = {
    id: "mockCollection",
    path: "mockCollection",
    parent: null,
    firestore: mockFirestore,

    // Query methods
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    limitToLast: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    startAt: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    endAt: vi.fn().mockReturnThis(),
    endBefore: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(createMockQuerySnapshot(mockData)),
    onSnapshot: vi.fn(),
    stream: vi.fn(),

    // Collection-specific methods
    doc: vi.fn((id?: string) => {
      const docId = id || `generated-id-${Date.now()}`;
      const docData = mockData.find((d) => d.id === docId);
      return createMockDocumentReference(docId, docData);
    }),

    add: vi.fn((data) => {
      const id = `generated-id-${Date.now()}`;
      return Promise.resolve(createMockDocumentReference(id, data));
    }),

    listDocuments: vi.fn().mockResolvedValue([]),
    isEqual: vi.fn().mockReturnValue(false),
    withConverter: vi.fn().mockReturnThis(),
    count: vi.fn(),
  };

  return collectionRef;
};

const doc = z.object({
  id: z.string(),
  name: z.string(),
});

const user1 = { id: "user1", name: "Joe" };
const user2 = { id: "user2", name: "Bob" };
const malformed = { id: "malformed", failure: "done goofed" };

const mockUsers = [user1, user2, malformed];

let mockCollection: ReturnType<typeof createMockCollectionReference>;
let store: FirebaseRefStore<typeof doc>;

beforeEach(() => {
  mockCollection = createMockCollectionReference(
    mockUsers,
    new Map([["user1", user1]]),
  );
  store = new FirebaseRefStore(
    mockCollection as unknown as CollectionReference<DocumentData>,
    doc,
  );
});
describe("FirebaseRefStore > GET", () => {
  it("Should get a document by id", async () => {
    const result = await store.get("user1");
    const result2 = await store.get("user2");

    expect(mockCollection.doc).toHaveBeenCalledWith("user1");
    expect(mockCollection.doc).toHaveBeenCalledWith("user2");

    expect(result).toBeDefined();
    expect(result2).toBeDefined();

    expect(result).not.toBe(null);
    expect(result2).not.toBe(null);

    assert(result !== null && result2 !== null);

    expect(result.name).toBe("Joe");
    expect(result2.name).toBe("Bob");
  });

  it("Should return null when there is no doc with that id", async () => {
    const result = await store.get("user3");

    expect(mockCollection.doc).toHaveBeenCalledWith("user3");

    expect(result).toBe(null);
  });

  it("Should throw an error if the data is malformed", async () => {
    await expect(store.get("malformed")).rejects.toThrow();

    expect(mockCollection.doc).toHaveBeenLastCalledWith("malformed");
  });
});

describe("FirebaseRefStore > CREATE", () => {
  it("Should create a new user with firestore and return the id", async () => {
    const newDoc = { id: "new", name: "BillyBob" };
    const result = await store.create(newDoc);

    expect(mockCollection.add).toHaveBeenCalledWith(newDoc);

    expect(result).toBeTypeOf("string");
    expect(result.includes("generated-id")).toBe(true);
  });
});

describe("FirebaseRefStore > MODIFY", () => {
  it("Should modify an existing document", async () => {
    const updatedDoc = { id: "user1", name: "Some witty username" };
    await store.modify("user1", updatedDoc);

    const transacton = mockCollection.firestore._getMockTransaction();
    expect(mockCollection.firestore.runTransaction).toHaveBeenCalled();
    expect(transacton.get).toHaveBeenCalled();
    expect(transacton.update).toHaveBeenCalled();
  });

  it("Should throw an error if no doc exists already", async () => {
    const updatedDoc = { id: "doesnt exist", name: "Some witty username" };
    await expect(store.modify("doesnt exist", updatedDoc)).rejects.toThrow();

    const transacton = mockCollection.firestore._getMockTransaction();
    expect(mockCollection.firestore.runTransaction).toHaveBeenCalled();
    expect(transacton.get).toHaveBeenCalled();
    expect(transacton.update).not.toHaveBeenCalled();
  });
});
