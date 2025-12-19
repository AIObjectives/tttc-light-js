import { reportData } from "__tests__/data/testData";
import { mapIdsToPath } from "../path";
import { createPathMapReducer } from "../reducer";
import { stateBuilder } from "../utils";

const state = stateBuilder(reportData.topics);

const reducer = createPathMapReducer(mapIdsToPath(state));

export const setupTestState = () => {
  return { state, reducer };
};
