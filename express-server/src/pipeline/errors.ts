import { CustomError } from "../error";

export class InvalidResponseDataError extends CustomError<"InvalidResponseDataError"> {
  constructor(err?: unknown) {
    super("InvalidResponseDataError", err);
  }
}

export class TimeoutError extends CustomError<"TimeoutError"> {
  constructor(err?: unknown) {
    super("TimeoutError", err);
  }
}

export class FetchError extends CustomError<"FetchError"> {
  constructor(err?: unknown) {
    super("FetchError", err);
  }
}
