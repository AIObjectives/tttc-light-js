import type * as admin from "firebase-admin";
import type { z } from "zod";
import type { RefStore } from ".";

/**
 * Firebase implementation of our refstore
 *
 * Needs a collection name and a zod parser that defines its inputs / outputs
 */
export class FirebaseRefStore<T extends z.ZodTypeAny>
  implements RefStore<z.infer<T>>
{
  private collection: admin.firestore.CollectionReference;
  private schema: T;
  constructor(collection: admin.firestore.CollectionReference, schema: T) {
    this.collection = collection;
    this.schema = schema;
  }

  async get(id: string): Promise<z.infer<T> | null> {
    try {
      /**
       * Get Doc from Firebase
       */
      const doc = await this.collection.doc(id).get();
      const data = doc.data();

      if (!data) {
        return null;
      }

      /**
       * Parse the data
       */
      return this.schema.parse(data);
    } catch (error) {
      throw error;
    }
  }

  async create(data: z.infer<T>): Promise<string> {
    try {
      const docRef = await this.collection.add(data);
      return docRef.id;
    } catch (error) {
      throw error;
    }
  }

  async modify(id: string, data: z.infer<T>): Promise<void> {
    const docRef = this.collection.doc(id);

    try {
      await this.collection.firestore.runTransaction(async (t) => {
        const doc = await t.get(docRef);
        const existingData = doc.data();

        if (!existingData) {
          throw new Error("Document not found");
        }

        t.update(docRef, data as any);
      });
    } catch (error) {
      throw error;
    }
  }
}
