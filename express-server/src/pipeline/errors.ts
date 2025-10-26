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

export class PyserverOOMError extends CustomError<"PyserverOOMError"> {
  constructor(err?: unknown) {
    super("PyserverOOMError", err);
  }
}

export class PyserverUnresponsiveError extends CustomError<"PyserverUnresponsiveError"> {
  constructor(err?: unknown) {
    super("PyserverUnresponsiveError", err);
  }
}

export class PyserverHungError extends CustomError<"PyserverHungError"> {
  constructor(err?: unknown) {
    super("PyserverHungError", err);
  }
}
