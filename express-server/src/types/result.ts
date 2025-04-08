/**
 * Represents a successful result
 */
type Success<T> = {
  tag: "success";
  value: T;
};

/**
 * Represents some expected failure so we can explicitly handle them.
 */
type Failure<T> = {
  tag: "failure";
  error: T;
};

/**
 * Represents some computation that could either fail or succeed.
 *
 * For example:
 *
 * const safeDivide = (n, divisor) => divisor === 0 ? Failure(DivideByZeroError) : Success(n/divisor)
 */
export type Result<S, F> = Success<S> | Failure<F>;

export const success = <T>(value: T): Success<T> => ({ tag: "success", value });

export const failure = <F>(error: F): Failure<F> => ({ tag: "failure", error });

/**
 * Takes a Result.
 *
 * If Result is a Failure, then pass the Failure through
 *
 * Otherwise, apply some function on the Success value and return a new success.
 *
 * NOTE: The transform function should be one that can't fail.
 *
 * Example:
 *
 * mapResult(Success(42), (n) => n + 1) -> Success(43)
 *
 * mapResult(Failure(GoofedError), ...) -> Failure(GoofedError)
 */
export function mapResult<T, T2, F>(
  result: Result<T, F>,
  transform: (arg: T) => T2,
): Result<T2, F> {
  if (result.tag === "failure") return result;
  const newValue = transform(result.value);
  return {
    tag: "success",
    value: newValue,
  };
}

/**
 * Extracts the union of all error types from an array of Result types
 */
type ErrorUnion<R extends readonly Result<any, any>[]> =
  R[number] extends Result<any, infer E> ? E : never;

/**
 * This takes a list of results and either:
 *
 * If any one of them is a failure, pass the failure through
 *
 * Otherwise, Concat them into a new success with an array of the input values
 *
 * For the possible Error values, it will return a union of the possible errors from each result.
 *
 * sequenceResult -> Result<T,F>[] -> Result<T[], F>
 *
 * Example:
 *
 * sequenceResult([Success(1), Success(2), Success(3)]) -> Success([1,2,3])
 *
 * sequenceResult([Success(1), Failure(GoofedError), Success(3)]) -> Failure(GoofedError)
 *
 * Devnote: The type stuff here is pretty gnarly. I had Claude generate it because I couldn't figure it out. After a few tries I got this, and it works.
 * If possible, we should simplify it.
 */
export function sequenceResult<R extends readonly Result<any, any>[]>(
  results: R,
): Result<
  { -readonly [P in keyof R]: R[P] extends Result<infer S, any> ? S : never },
  ErrorUnion<R>
> {
  type SuccessTuple = {
    -readonly [P in keyof R]: R[P] extends Result<infer S, any> ? S : never;
  };

  const initialState: Result<any[], ErrorUnion<R>> = success([]);

  const finalResult = results.reduce<Result<any[], ErrorUnion<R>>>(
    (acc, result) => {
      if (acc.tag === "failure") return acc;
      if (result.tag === "failure")
        return failure(result.error as ErrorUnion<R>);
      return success([...acc.value, result.value]);
    },
    initialState,
  );

  return finalResult as Result<SuccessTuple, ErrorUnion<R>>;
}

/**
 * Takes a Result
 *
 * If the Result is a Failure, pass the failure through
 *
 * Otherwise, apply some function to the Success value that returns a new Result
 *
 * This will sum Failure types from both the input result and the transform function
 *
 * Example:
 *
 * flatMapResult(Success(42), stringifyIfMeaningOfLife) -> Success('42')
 *
 * flatMapResult(Success(1337), stringifyIfMeaningOfLife) -> Failure(NotMeaningOfLife)
 *
 * flatMapResult(Failure(GoofedError), ...) -> Failure(GoofedError)
 */
export function flatMapResult<T, F, T2, F2>(
  result: Result<T, F>,
  transform: (arg: T) => Result<T2, F2>,
): Result<T2, F | F2> {
  if (result.tag === "failure") return result;
  else {
    return transform(result.value);
  }
}

/**
 * Async variant of flatMapResult.
 *
 * Takes a transform function that returns a Result wrapped in a Promise
 */
export async function flatMapResultAsync<T, F, T2, F2>(
  result: Result<T, F>,
  transform: (arg: T) => Promise<Result<T2, F2>>,
): Promise<Result<T2, F | F2>> {
  if (result.tag === "failure") return result;
  else return await transform(result.value);
}
