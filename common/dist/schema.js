"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.sourceRow = void 0;
const zod_1 = require("zod");
exports.sourceRow = zod_1.z.object({
    comment: zod_1.z.string(),
    id: zod_1.z.string(),
    interview: zod_1.z.string().optional(),
    video: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().optional(),
});
exports.options = zod_1.z.object({
    apiKey: zod_1.z.string().optional(),
    data: exports.sourceRow.array(),
    title: zod_1.z.string(),
    question: zod_1.z.string(),
    description: zod_1.z.string(),
    systemInstructions: zod_1.z.string().optional(),
    clusteringInstructions: zod_1.z.string().optional(),
    extractionInstructions: zod_1.z.string().optional(),
    dedupInstructions: zod_1.z.string().optional(),
    batchSize: zod_1.z.number().optional(),
    filename: zod_1.z.string().optional(),
});
//# sourceMappingURL=schema.js.map