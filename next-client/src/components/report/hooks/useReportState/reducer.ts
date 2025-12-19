import {
  Array,
  Boolean,
  Either,
  flow,
  Match,
  Option,
  pipe,
  Record,
} from "effect";
import { ActionStream } from "./actionStream";
import { actionStreamReducer } from "./actionStreamReducer";
import {
  ClaimPath,
  SubtopicPath,
  type TaggedClaimPath,
  type TaggedSubtopicPath,
  type TaggedTopicPath,
  TopicPath,
} from "./path";
import type { ReportState } from "./types";

//  ********************************
//  * REPORT STATE REDUCER *
//  ********************************/

type ReportStateActionTypesWithIdPayloads =
  | "open"
  | "close"
  | "toggleTopic"
  | "expandTopic"
  | "expandSubtopic"
  | "focus";

type ReportStateActionTypesWithoutPayloads =
  | "openAll"
  | "closeAll"
  | "clearError";

type ReportStateActionTypesWithMessages = "error";

type ReportStateActionsWithIdPayloads = {
  type: ReportStateActionTypesWithIdPayloads;
  payload: { id: string };
};

type ReportStateActionsWithoutPayloads = {
  type: ReportStateActionTypesWithoutPayloads;
};

type ReportStateActionsWithMessagePayloads = {
  type: ReportStateActionTypesWithMessages;
  payload: { message: string };
};

export type ReportStateAction =
  | ReportStateActionsWithIdPayloads
  | ReportStateActionsWithoutPayloads
  | ReportStateActionsWithMessagePayloads;

export function createPathMapReducer(
  idMap: Record<string, TaggedTopicPath | TaggedSubtopicPath | TaggedClaimPath>,
) {
  return (state: ReportState, action: ReportStateAction): ReportState => {
    switch (action.type) {
      // For open, we want the same function to work for topics or subtopics.
      // If subtopic, should open parent and set pagination to the correct value
      case "open": {
        const { id } = action.payload;
        return pipe(
          // string: Path
          idMap,
          // Some Path
          Record.get(id),
          Option.map(
            // Path
            flow(
              // Break down the action into a bunch of subactions
              // Path -> ActionStream
              ActionStream.open,
              // and reduce over the state
              // ActionStream -> ReportState
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          // If idxMap for some reason couldn't find the Path, return the state with error set
          // TODO: Include more comprehensive error handling.
          Option.getOrElse(() => {
            return {
              ...state,
              error: "Could not find path to topic or subtopic",
            };
          }),
        );
      }
      case "close": {
        const { id } = action.payload;
        return pipe(
          // string: Path
          idMap,
          // Option Path
          Record.get(id),
          Option.flatMap((val) =>
            val.type === "topic" ? Option.some(val) : Option.none(),
          ),
          // Either Path
          Either.fromOption(() => "Could not find path"),
          Either.map(
            // Path
            flow(
              // Path -> ActionStream
              ActionStream.close,
              // ActionStream -> ReportState
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          // TODO: include more comprehensive error handling
          Either.getOrElse((e) => {
            return {
              ...state,
              error: e,
            };
          }),
        );
      }
      /**
       * For toggling the topic, this one functions a little differently because we have to create
       * an action stream based on the node's state, rather than its path. We could use the special map
       * type, but that seems to be overkill for a fairly simple action.
       */
      case "toggleTopic": {
        const { id } = action.payload;
        return pipe(
          // get the topic's path
          idMap,
          Record.get(id),
          Either.fromOption(() => "Could not find path"),
          // If for some reason its not a topic path, error out
          Either.flatMap(
            Match.type<
              TaggedTopicPath | TaggedSubtopicPath | TaggedClaimPath
            >().pipe(
              Match.when({ type: "topic" }, (path) => Either.right(path)),
              Match.orElse(() =>
                Either.left("Toggle Topic should only apply to topic nodes"),
              ),
            ),
          ),
          // Get the node directly, determine which action stream to use, and then reduce over state.
          Either.map((path) =>
            pipe(
              // We can use unsafeGet. Should never fail unless something with horrifically wrong.
              Array.unsafeGet(state.children, path.topicIdx),
              (topic) => topic.isOpen,
              Boolean.match({
                onTrue: () => ActionStream.close(path),
                onFalse: () => ActionStream.open(path),
              }),
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          Either.getOrElse((e) => {
            return {
              ...state,
              error: e,
            };
          }),
        );
      }
      /**
       *
       */
      case "openAll": {
        return pipe(
          ActionStream.openAll,
          Array.reduce(state, actionStreamReducer),
        );
      }
      case "closeAll": {
        return pipe(
          ActionStream.closeAll,
          Array.reduce(state, actionStreamReducer),
        );
      }
      case "expandTopic":
      case "expandSubtopic": {
        const { id } = action.payload;
        return pipe(
          idMap,
          Record.get(id),
          Option.flatMap((val) =>
            val.type === "topic" || val.type === "subtopic"
              ? Option.some(val)
              : Option.none(),
          ),
          Either.fromOption(
            () => "There was an error in finding the topic/subtopic to expand.",
          ),
          Either.map(
            flow(
              ActionStream.incrementPagination,
              Array.reduce(state, actionStreamReducer),
            ),
          ),
          Either.getOrElse((e) => {
            return {
              ...state,
              error: e,
            };
          }),
        );
      }
      case "focus": {
        const { id } = action.payload;
        return {
          ...state,
          focusedId: id,
        };
      }
      case "error": {
        const { message } = action.payload;
        return {
          ...state,
          error: message,
        };
      }
      case "clearError": {
        return {
          ...state,
          error: null,
        };
      }
      default: {
        return state;
      }
    }
  };
}
