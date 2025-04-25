import { describe, test, expect } from "vitest";
import {
  success,
  failure,
  Result,
  mapResult,
  flatMapResult,
  flatMapResultAsync,
  sequenceResult,
} from "../";

const s = success(1) as Result<number, boolean>;
const f = failure(false) as Result<number, boolean>;

describe("Success", () => {
  test("Result success returns a success type", () => {
    const s = success(1);
    expect(s.tag === "success").true;
    expect(s.value).toBe(1);
  });
});

describe("Failure", () => {
  test("Result failure returns a success type", () => {
    const f = failure(false);
    expect(f.tag === "failure").true;
    expect(f.error).false;
  });
});

describe("Map", () => {
  test("Map changes the result value without changing the context", () => {
    const val = mapResult(s, (n) => n + 1);
    expect(val.tag === "success" && val.value === 2).true;
  });

  describe("Map short circuits on failure", () => {
    const val = mapResult(f, (n) => n + 1);
    test("Map does not change the context", () => {
      expect(val.tag === "failure");
    });

    test("Map does not change the value", () => {
      expect(val.tag === "failure" && val.error === false).true;
    });
  });
});

describe("Flatmap", () => {
  describe("Flatmap changes the result value and context", () => {
    test("Flatmap can return a new success", () => {
      const isOdd = flatMapResult(s, (n) =>
        n % 2 !== 0 ? success(true) : failure(false),
      );
      expect(isOdd.tag === "success");
      expect(isOdd.tag === "success" && isOdd.value).true;
    });

    test("Flatmap can return a new failure", () => {
      const isEven = flatMapResult(s, (n) =>
        n % 2 === 0 ? success(true) : failure(false),
      );
      expect(isEven.tag === "failure");
      expect(isEven.tag === "failure" && isEven.error === false);
    });
  });

  describe("Flatmap short circuits on a failure", () => {
    const fail = flatMapResult(f, (n) =>
      n % 2 === 0 ? success(true) : failure(false),
    );
    test("Flatmap does not change the context", () => {
      expect(fail.tag === "failure");
    });

    test("Flatmap does not change the value", () => {
      expect(fail.tag === "failure" && fail.error === false).true;
    });
  });
});

describe("Async Flatmap", () => {
  describe("Async Flatmap changes the result value and context", () => {
    test("Async Flatmap can return a new success", async () => {
      const isOdd = await flatMapResultAsync(s, (n) =>
        Promise.resolve(n % 2 !== 0 ? success(true) : failure(false)),
      );
      expect(isOdd.tag === "success");
      expect(isOdd.tag === "success" && isOdd.value).true;
    });

    test("Async Flatmap can return a new failure", async () => {
      const isEven = await flatMapResultAsync(s, (n) =>
        Promise.resolve(n % 2 === 0 ? success(true) : failure(false)),
      );
      expect(isEven.tag === "failure");
      expect(isEven.tag === "failure" && isEven.error === false);
    });
  });

  describe("Async Flatmap short circuits on a failure", async () => {
    const fail = await flatMapResultAsync(s, (n) =>
      Promise.resolve(n % 2 === 0 ? success(true) : failure(false)),
    );
    test("Async Flatmap does not change the context", () => {
      expect(fail.tag === "failure");
    });

    test("Async Flatmap does not change the value", () => {
      expect(fail.tag === "failure" && fail.error === false).true;
    });
  });
});

describe("Sequence", () => {
  const s1 = success(1);
  const s2 = success(2);
  const s3 = success(3);

  test("If every item in a sequence's input array is a success, return a success with each of the input's values in an array in order", () => {
    const val = sequenceResult([s1, s2, s3]);

    if (val.tag === "success") {
      expect(val.value).toStrictEqual([1, 2, 3]);
    } else {
      expect.fail("Did not get a success back");
    }
  });

  test("If any input is a failure, return a failure", () => {
    const f1 = sequenceResult([f, s1, s2]);
    const f2 = sequenceResult([f, f, s1]);
    const f3 = sequenceResult([f, f, f]);

    expect([f1, f2, f3].every((r) => r.tag === "failure"));
  });

  test("On a failure, the first failure's error is returned", () => {
    const failFirst = failure("first");

    const f1 = sequenceResult([s1, s2, failFirst]);
    const f2 = sequenceResult([failFirst, f]);

    if (f1.tag === "failure" && f2.tag === "failure") {
      expect(f1.error).toBe("first");
      expect(f2.error).toBe("first");
    } else {
      expect.fail("Did not get a failure back");
    }
  });
});
