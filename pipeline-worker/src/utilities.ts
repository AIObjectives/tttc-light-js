import { Effect, Match, Data, pipe } from "effect";
import { z } from "zod";

export class ZodParseError extends Data.TaggedError("ZodParseError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Converts a zod parser to return an Effect using safeParse
 */
export const zodSafeParseEffect =
  <T extends z.ZodTypeAny>(parser: T) =>
  (data: unknown) =>
    pipe(data, parser.safeParse, (result) =>
      Match.value(result).pipe(
        Match.when({ success: true }, (r) =>
          Effect.succeed(r.data as z.infer<T>),
        ),
        Match.when({ success: false }, (r) =>
          Effect.fail(
            new ZodParseError({
              message: r.error.message,
              cause: r.error.issues,
            }),
          ),
        ),
        Match.exhaustive,
      ),
    );
