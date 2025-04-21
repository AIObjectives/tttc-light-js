type Success<T> = {
  tag: "success";
  value: T;
};

type Failure<T> = {
  tag: "failure";
  error: T;
};

export type Result<S, F> = Success<S> | Failure<F>;
