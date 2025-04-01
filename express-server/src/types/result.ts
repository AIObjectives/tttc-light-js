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
