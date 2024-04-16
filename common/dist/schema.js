"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.thisIsATest = exports.sourceMap = exports.pipelineOutput = exports.taxonomy = exports.topic = exports.subtopic = exports.tracker = exports.cache = exports.options = exports.pieChart = exports.sourceRow = void 0;
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
    pieCharts: exports.pieChart.array().optional(),
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
const claim = zod_1.z.custom();
exports.cache = zod_1.z.object({
    get: zod_1.z.function().args(zod_1.z.string()).returns(zod_1.z.any()),
    set: zod_1.z.function().args(zod_1.z.string(), zod_1.z.any()).returns(zod_1.z.void()),
});
exports.tracker = zod_1.z.object({
    start: zod_1.z.number(),
    costs: zod_1.z.number(),
    prompt_tokens: zod_1.z.number(),
    completion_tokens: zod_1.z.number(),
    unmatchedClaims: zod_1.z.array(claim),
    end: zod_1.z.number().optional(),
    duration: zod_1.z.string().optional(),
});
exports.subtopic = zod_1.z.object({
    subtopicName: zod_1.z.string(),
    subtopicShortDescription: zod_1.z.string().optional(),
    subtopicId: zod_1.z.string().optional(),
    claimsCount: zod_1.z.number().optional(),
    claims: zod_1.z.array(claim).optional(),
});
exports.topic = zod_1.z.object({
    topicName: zod_1.z.string(),
    topicShortDescription: zod_1.z.string().optional(),
    topicId: zod_1.z.string().optional(),
    claimsCount: zod_1.z.number().optional(),
    subtopics: zod_1.z.array(exports.subtopic),
});
exports.taxonomy = zod_1.z.array(exports.topic);
exports.pipelineOutput = zod_1.z.object({
    data: zod_1.z.array(exports.sourceRow),
    title: zod_1.z.string(),
    question: zod_1.z.string(),
    pieChart: zod_1.z.array(exports.pieChart).optional(),
    description: zod_1.z.string(),
    systemInstructions: zod_1.z.string(),
    clusteringInstructions: zod_1.z.string(),
    extractionInstructions: zod_1.z.string(),
    batchSize: zod_1.z.number(),
    tree: exports.taxonomy,
    start: zod_1.z.number(),
    costs: zod_1.z.number(),
    end: zod_1.z.number().optional(),
    duration: zod_1.z.string().optional(),
});
exports.sourceMap = zod_1.z.record(zod_1.z.string(), exports.sourceRow);
exports.thisIsATest = zod_1.z.boolean();
//# sourceMappingURL=schema.js.map