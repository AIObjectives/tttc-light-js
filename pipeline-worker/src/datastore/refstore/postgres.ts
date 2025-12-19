import type { z } from "zod";
import type { RefStore } from ".";

export class PostgresRefStore<T extends z.ZodTypeAny>
  implements RefStore<z.infer<T>>
{
  constructor(
    private readonly tableName: string,
    private readonly zodParser: T,
  ) {}

  async get(id: string): Promise<z.infer<T> | null> {
    throw new Error("Not implemented");
  }

  async create(data: z.infer<T>): Promise<string> {
    throw new Error("Not implemented");
  }

  async modify(id: string, data: z.infer<T>): Promise<void> {
    throw new Error("Not implemented");
  }
}
