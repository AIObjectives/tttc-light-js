type Success<T> = {
  tag: "success";
  value: T;
};

type Failure<T> = {
  tag: "failure";
  error: T;
};

export type Result<S, F> = Success<S> | Failure<F>;

export function pipe<T, F, T2, F2>(
  result: Result<T, F>,
  cb: (arg: T) => Result<T2, F2>,
): Result<T2, F | F2> {
  if (result.tag === "failure") return result;
  else {
    return cb(result.value);
  }
}
