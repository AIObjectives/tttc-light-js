"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = exports.pieChart = exports.sourceRow = void 0;
const zod_1 = require("zod");
exports.sourceRow = zod_1.z.object({
    comment: zod_1.z.string(),
    id: zod_1.z.string(),
    interview: zod_1.z.string().optional(),
    video: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().optional(),
});
exports.pieChart = zod_1.z.object({
    title: zod_1.z.string(),
    items: zod_1.z.object({ label: zod_1.z.string(), count: zod_1.z.number() }).array(),
});
exports.options = zod_1.z.object({
    model: zod_1.z.string().optional(),
    apiKey: zod_1.z.string().optional(),
    data: exports.sourceRow.array(),
    title: zod_1.z.string(),
    question: zod_1.z.string(),
    pieChart: exports.pieChart.array().optional(),
    description: zod_1.z.string(),
    systemInstructions: zod_1.z.string().optional(),
    clusteringInstructions: zod_1.z.string().optional(),
    extractionInstructions: zod_1.z.string().optional(),
    dedupInstructions: zod_1.z.string().optional(),
    batchSize: zod_1.z.number().optional(),
    filename: zod_1.z.string().optional(),
    googleSheet: zod_1.z
        .object({
        url: zod_1.z.string(),
        pieChartColumns: zod_1.z.string().array().optional(),
        filterEmails: zod_1.z.string().array().optional(),
        oneSubmissionPerEmail: zod_1.z.boolean(),
    })
        .optional(),
});
//# sourceMappingURL=schema.js.map