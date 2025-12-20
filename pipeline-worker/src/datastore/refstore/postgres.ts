import type { z } from "zod";
import type { RefStore } from ".";

export class PostgresRefStore<T extends z.ZodTypeAny>
  implements RefStore<z.infer<T>>
{
  constructor(
    readonly _tableName: string,
    readonly _zodParser: T,
  ) {}

  async get(_id: string): Promise<z.infer<T> | null> {
    throw new Error("Not implemented");
  }

  async create(_data: z.infer<T>): Promise<string> {
    throw new Error("Not implemented");
  }

  async modify(_id: string, _data: z.infer<T>): Promise<void> {
    throw new Error("Not implemented");
  }
}
