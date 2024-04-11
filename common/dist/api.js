"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiReponse = void 0;
const zod_1 = require("zod");
exports.generateApiReponse = zod_1.z.object({
    message: zod_1.z.string(),
    filename: zod_1.z.string().min(1),
    jsonUrl: zod_1.z.string().url(),
    reportUrl: zod_1.z.string().url(),
});
//# sourceMappingURL=api.js.map