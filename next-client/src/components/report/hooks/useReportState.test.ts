import { expect, test } from "vitest";
import {
  __internals,
  Node,
  NodeTree,
  ReportState,
  HasId,
  TreeParams,
  Unpacked,
  TransformFunction,
  ThemeState,
} from "./useReportState";
import { reportData } from "stories/data/dummyData";
import * as schema from "tttc-common/schema";

const {
  identity,
  replace,
  findAndReplace,
  apply,
  guardNullIsOpen,
  stateBuilder,
  guardDataMutation,
  open,
} = __internals;

const testNode = <T extends HasId>(
  arg: T,
  partial?: Partial<Node<T>>,
): Node<T> => ({
  data: arg,
  isObserved: false,
  isOpen: false,
  ...partial,
});

const id = () => ({
  id: "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16),
  ),
});

// const testNodes:ReportState = stateBuilder(reportData.themes)

test("Identity", () => {
  expect(typeof identity(0)).toBe(typeof 0);
  expect(typeof identity("")).toBe(typeof "");
  expect(identity("test")).toBe("test");
});

test("Replace", () => {
  const input = [1, 2, 3, 4, 5];
  expect(replace(input, 99, 1)).toStrictEqual([1, 99, 3, 4, 5]);
  expect(replace(input, 99, 0)).toStrictEqual([99, 2, 3, 4, 5]);
  expect(replace(input, 99, 4)).toStrictEqual([1, 2, 3, 4, 99]);
  expect(replace(input, 0, 6)).toStrictEqual([1, 2, 3, 4, 5, 0]); // weird edge case? Throw an error instead?
});

test("Prevent isOpen null from changing", () => {
  const nullNode = testNode(id(), { isOpen: null });
  const test = testNode(id(), { isOpen: false });

  const _setOpen: TransformFunction<[any]> = (tree) => ({
    ...tree,
    isOpen: true,
  });

  expect(nullNode.isOpen).null;
  expect(test.isOpen).false;
  expect(_setOpen(test).isOpen).true;

  const guardOpen = guardNullIsOpen(_setOpen);

  expect(guardOpen(nullNode).isOpen).null;
});

test("Apply function", () => {
  const test = testNode(id(), { isOpen: null });
  const _setOpen: TransformFunction<[any]> = (tree) => ({
    ...tree,
    isOpen: true,
  });
  const guarded = apply(_setOpen, [guardNullIsOpen]);
  expect(guarded(test).isOpen).null;
});

test("open", () => {
  const test = testNode(id());
  expect(open<[HasId]>(test).isOpen).true;

  const reportState = stateBuilder(reportData.themes);
  const themeNode = reportState.children[0];
  expect(themeNode.isOpen).false;
  expect(open<[schema.Theme, schema.Topic]>(themeNode).isOpen).true;
});

test("test", () => {
  const test = testNode(id());

  const _setOpen = <K extends TreeParams>(tree: NodeTree<K>): NodeTree<K> =>
    tree;
  const test2 = _setOpen<[HasId]>(test);
});

// test("Prevent data mutation", () => {
//   const test = testNode({ ...id(), val: true });

//   expect(test.data.val).true;
//   const dangerousMutation = <K extends HasId & { val: boolean }>(
//     tree: NodeTree<[K]>,
//   ): NodeTree<[K]> => ({
//     ...tree,
//     data: {
//       ...tree.data,
//       val: false,
//     },
//   });

//   const preventDangerousMutation = apply(dangerousMutation, [
//     guardDataMutation,
//   ]);

//   const res = preventDangerousMutation(test);

//   const _setOpen = <K extends HasId>(tree: NodeTree<[K]>) => ({
//     ...tree,
//     isOpen: true,
//   });

//   const normalFunction = apply(_setOpen, [guardDataMutation]);

//   const normalNodeRes = normalFunction(test);
//   expect(normalNodeRes.isOpen).true;

//   expect(res.data.val).true;
// });
