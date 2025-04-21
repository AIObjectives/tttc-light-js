/**
 * Abstract Class to customize errors
 *
 * We can use this so that we can more explicitly handle errors using discriminated unions
 *
 * example:
 *
 * class DoneGoofedError extends CustomError<"You done goofed"> {
 *  construct(err?:unknown) {
 *      super("You done goofed", err);
 *  }
 * }
 */
export abstract class CustomError<T extends string> extends Error {
  public readonly tag: T;

  constructor(tag: T, err?: unknown) {
    const message =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : `Error: ${String(err)}`;
    super(message);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, new.target.prototype);

    // Initialize the _tag property
    this.tag = tag;

    // Set name for better stack traces
    this.name = this.constructor.name;
  }
}
