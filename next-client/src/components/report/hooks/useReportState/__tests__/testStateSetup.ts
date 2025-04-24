import { mapIdsToPath } from "../path";
import { createPathMapReducer } from "../reducer";
import { reportData } from "stories/data/dummyData";
import { stateBuilder } from "../utils";

const state = stateBuilder(reportData.topics);

const reducer = createPathMapReducer(mapIdsToPath(state));

export const setupTestState = () => {
  return { state, reducer };
};
