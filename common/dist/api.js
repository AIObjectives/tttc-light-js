"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiReponse = void 0;
const zod_1 = require("zod");
/**
 * /GENERATE
 */
// make generateApiRequest if we need to change requst body to include more than options
exports.generateApiReponse = zod_1.z.object({
    message: zod_1.z.string(),
    filename: zod_1.z.string(),
    url: zod_1.z.string(),
});
//# sourceMappingURL=api.js.map