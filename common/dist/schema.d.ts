import { z } from "zod";
export declare const sourceRow: z.ZodObject<{
    comment: z.ZodString;
    id: z.ZodString;
    interview: z.ZodOptional<z.ZodString>;
    video: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    comment?: string;
    id?: string;
    interview?: string;
    video?: string;
    timestamp?: string;
}, {
    comment?: string;
    id?: string;
    interview?: string;
    video?: string;
    timestamp?: string;
}>;
export type SourceRow = z.infer<typeof sourceRow>;
export declare const pieChart: z.ZodObject<{
    title: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        label?: string;
        count?: number;
    }, {
        label?: string;
        count?: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    title?: string;
    items?: {
        label?: string;
        count?: number;
    }[];
}, {
    title?: string;
    items?: {
        label?: string;
        count?: number;
    }[];
}>;
export type PieChart = z.infer<typeof pieChart>;
export declare const options: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodString>;
    data: z.ZodArray<z.ZodObject<{
        comment: z.ZodString;
        id: z.ZodString;
        interview: z.ZodOptional<z.ZodString>;
        video: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        comment?: string;
        id?: string;
        interview?: string;
        video?: string;
        timestamp?: string;
    }, {
        comment?: string;
        id?: string;
        interview?: string;
        video?: string;
        timestamp?: string;
    }>, "many">;
    title: z.ZodString;
    question: z.ZodString;
    pieCharts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            label?: string;
            count?: number;
        }, {
            label?: string;
            count?: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title?: string;
        items?: {
            label?: string;
            count?: number;
        }[];
    }, {
        title?: string;
        items?: {
            label?: string;
            count?: number;
        }[];
    }>, "many">>;
    description: z.ZodString;
    systemInstructions: z.ZodOptional<z.ZodString>;
    clusteringInstructions: z.ZodOptional<z.ZodString>;
    extractionInstructions: z.ZodOptional<z.ZodString>;
    dedupInstructions: z.ZodOptional<z.ZodString>;
    batchSize: z.ZodOptional<z.ZodNumber>;
    filename: z.ZodOptional<z.ZodString>;
    googleSheet: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        pieChartColumns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        filterEmails: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        oneSubmissionPerEmail: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        url?: string;
        pieChartColumns?: string[];
        filterEmails?: string[];
        oneSubmissionPerEmail?: boolean;
    }, {
        url?: string;
        pieChartColumns?: string[];
        filterEmails?: string[];
        oneSubmissionPerEmail?: boolean;
    }>>;
}, "strip", z.ZodTypeAny, {
    model?: string;
    apiKey?: string;
    data?: {
        comment?: string;
        id?: string;
        interview?: string;
        video?: string;
        timestamp?: string;
    }[];
    title?: string;
    question?: string;
    pieCharts?: {
        title?: string;
        items?: {
            label?: string;
            count?: number;
        }[];
    }[];
    description?: string;
    systemInstructions?: string;
    clusteringInstructions?: string;
    extractionInstructions?: string;
    dedupInstructions?: string;
    batchSize?: number;
    filename?: string;
    googleSheet?: {
        url?: string;
        pieChartColumns?: string[];
        filterEmails?: string[];
        oneSubmissionPerEmail?: boolean;
    };
}, {
    model?: string;
    apiKey?: string;
    data?: {
        comment?: string;
        id?: string;
        interview?: string;
        video?: string;
        timestamp?: string;
    }[];
    title?: string;
    question?: string;
    pieCharts?: {
        title?: string;
        items?: {
            label?: string;
            count?: number;
        }[];
    }[];
    description?: string;
    systemInstructions?: string;
    clusteringInstructions?: string;
    extractionInstructions?: string;
    dedupInstructions?: string;
    batchSize?: number;
    filename?: string;
    googleSheet?: {
        url?: string;
        pieChartColumns?: string[];
        filterEmails?: string[];
        oneSubmissionPerEmail?: boolean;
    };
}>;
export type Options = z.infer<typeof options>;
export type Claim = {
    claim: string;
    quote: string;
    claimId?: string;
    topicName?: string;
    subtopicName?: string;
    commentId?: string;
    duplicates?: Claim[];
    duplicated?: boolean;
};
export declare const cache: z.ZodObject<{
    get: z.ZodFunction<z.ZodTuple<[z.ZodString], z.ZodUnknown>, z.ZodAny>;
    set: z.ZodFunction<z.ZodTuple<[z.ZodString, z.ZodAny], z.ZodUnknown>, z.ZodVoid>;
}, "strip", z.ZodTypeAny, {
    get?: (args_0: string, ...args_1: unknown[]) => any;
    set?: (args_0: string, args_1: any, ...args_2: unknown[]) => void;
}, {
    get?: (args_0: string, ...args_1: unknown[]) => any;
    set?: (args_0: string, args_1: any, ...args_2: unknown[]) => void;
}>;
export type Cache = z.infer<typeof cache>;
export declare const tracker: z.ZodObject<{
    start: z.ZodNumber;
    costs: z.ZodNumber;
    prompt_tokens: z.ZodNumber;
    completion_tokens: z.ZodNumber;
    unmatchedClaims: z.ZodArray<z.ZodType<Claim, z.ZodTypeDef, Claim>, "many">;
    end: z.ZodOptional<z.ZodNumber>;
    duration: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    start?: number;
    costs?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    unmatchedClaims?: Claim[];
    end?: number;
    duration?: string;
}, {
    start?: number;
    costs?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    unmatchedClaims?: Claim[];
    end?: number;
    duration?: string;
}>;
export type Tracker = z.infer<typeof tracker>;
export declare const subtopic: z.ZodObject<{
    subtopicName: z.ZodString;
    subtopicShortDescription: z.ZodOptional<z.ZodString>;
    subtopicId: z.ZodOptional<z.ZodString>;
    claimsCount: z.ZodOptional<z.ZodNumber>;
    claims: z.ZodOptional<z.ZodArray<z.ZodType<Claim, z.ZodTypeDef, Claim>, "many">>;
}, "strip", z.ZodTypeAny, {
    subtopicName?: string;
    subtopicShortDescription?: string;
    subtopicId?: string;
    claimsCount?: number;
    claims?: Claim[];
}, {
    subtopicName?: string;
    subtopicShortDescription?: string;
    subtopicId?: string;
    claimsCount?: number;
    claims?: Claim[];
}>;
export type Subtopic = z.infer<typeof subtopic>;
export declare const topic: z.ZodObject<{
    topicName: z.ZodString;
    topicShortDescription: z.ZodOptional<z.ZodString>;
    topicId: z.ZodOptional<z.ZodString>;
    claimsCount: z.ZodOptional<z.ZodNumber>;
    subtopics: z.ZodArray<z.ZodObject<{
        subtopicName: z.ZodString;
        subtopicShortDescription: z.ZodOptional<z.ZodString>;
        subtopicId: z.ZodOptional<z.ZodString>;
        claimsCount: z.ZodOptional<z.ZodNumber>;
        claims: z.ZodOptional<z.ZodArray<z.ZodType<Claim, z.ZodTypeDef, Claim>, "many">>;
    }, "strip", z.ZodTypeAny, {
        subtopicName?: string;
        subtopicShortDescription?: string;
        subtopicId?: string;
        claimsCount?: number;
        claims?: Claim[];
    }, {
        subtopicName?: string;
        subtopicShortDescription?: string;
        subtopicId?: string;
        claimsCount?: number;
        claims?: Claim[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    topicName?: string;
    topicShortDescription?: string;
    topicId?: string;
    claimsCount?: number;
    subtopics?: {
        subtopicName?: string;
        subtopicShortDescription?: string;
        subtopicId?: string;
        claimsCount?: number;
        claims?: Claim[];
    }[];
}, {
    topicName?: string;
    topicShortDescription?: string;
    topicId?: string;
    claimsCount?: number;
    subtopics?: {
        subtopicName?: string;
        subtopicShortDescription?: string;
        subtopicId?: string;
        claimsCount?: number;
        claims?: Claim[];
    }[];
}>;
export type Topic = z.infer<typeof topic>;
export declare const taxonomy: z.ZodArray<z.ZodObject<{
    topicName: z.ZodString;
    topicShortDescription: z.ZodOptional<z.ZodString>;
    topicId: z.ZodOptional<z.ZodString>;
    claimsCount: z.ZodOptional<z.ZodNumber>;
    subtopics: z.ZodArray<z.ZodObject<{
        subtopicName: z.ZodString;
        subtopicShortDescription: z.ZodOptional<z.ZodString>;
        subtopicId: z.ZodOptional<z.ZodString>;
        claimsCount: z.ZodOptional<z.ZodNumber>;
        claims: z.ZodOptional<z.ZodArray<z.ZodType<Claim, z.ZodTypeDef, Claim>, "many">>;
    }, "strip", z.ZodTypeAny, {
        subtopicName?: string;
        subtopicShortDescription?: string;
        subtopicId?: string;
        claimsCount?: number;
        claims?: Claim[];
    }, {
        subtopicName?: string;
        subtopicShortDescription?: string;
        subtopicId?: string;
        claimsCount?: number;
        claims?: Claim[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    topicName?: string;
    topicShortDescription?: string;
    topicId?: string;
    claimsCount?: number;
    subtopics?: {
        subtopicName?: string;
        subtopicShortDescription?: string;
        subtopicId?: string;
        claimsCount?: number;
        claims?: Claim[];
    }[];
}, {
    topicName?: string;
    topicShortDescription?: string;
    topicId?: string;
    claimsCount?: number;
    subtopics?: {
        subtopicName?: string;
        subtopicShortDescription?: string;
        subtopicId?: string;
        claimsCount?: number;
        claims?: Claim[];
    }[];
}>, "many">;
export type Taxonomy = z.infer<typeof taxonomy>;
export declare const pipelineOutput: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        comment: z.ZodString;
        id: z.ZodString;
        interview: z.ZodOptional<z.ZodString>;
        video: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        comment?: string;
        id?: string;
        interview?: string;
        video?: string;
        timestamp?: string;
    }, {
        comment?: string;
        id?: string;
        interview?: string;
        video?: string;
        timestamp?: string;
    }>, "many">;
    title: z.ZodString;
    question: z.ZodString;
    pieChart: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            label?: string;
            count?: number;
        }, {
            label?: string;
            count?: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title?: string;
        items?: {
            label?: string;
            count?: number;
        }[];
    }, {
        title?: string;
        items?: {
            label?: string;
            count?: number;
        }[];
    }>, "many">>;
    description: z.ZodString;
    systemInstructions: z.ZodString;
    clusteringInstructions: z.ZodString;
    extractionInstructions: z.ZodString;
    batchSize: z.ZodNumber;
    tree: z.ZodArray<z.ZodObject<{
        topicName: z.ZodString;
        topicShortDescription: z.ZodOptional<z.ZodString>;
        topicId: z.ZodOptional<z.ZodString>;
        claimsCount: z.ZodOptional<z.ZodNumber>;
        subtopics: z.ZodArray<z.ZodObject<{
            subtopicName: z.ZodString;
            subtopicShortDescription: z.ZodOptional<z.ZodString>;
            subtopicId: z.ZodOptional<z.ZodString>;
            claimsCount: z.ZodOptional<z.ZodNumber>;
            claims: z.ZodOptional<z.ZodArray<z.ZodType<Claim, z.ZodTypeDef, Claim>, "many">>;
        }, "strip", z.ZodTypeAny, {
            subtopicName?: string;
            subtopicShortDescription?: string;
            subtopicId?: string;
            claimsCount?: number;
            claims?: Claim[];
        }, {
            subtopicName?: string;
            subtopicShortDescription?: string;
            subtopicId?: string;
            claimsCount?: number;
            claims?: Claim[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        topicName?: string;
        topicShortDescription?: string;
        topicId?: string;
        claimsCount?: number;
        subtopics?: {
            subtopicName?: string;
            subtopicShortDescription?: string;
            subtopicId?: string;
            claimsCount?: number;
            claims?: Claim[];
        }[];
    }, {
        topicName?: string;
        topicShortDescription?: string;
        topicId?: string;
        claimsCount?: number;
        subtopics?: {
            subtopicName?: string;
            subtopicShortDescription?: string;
            subtopicId?: string;
            claimsCount?: number;
            claims?: Claim[];
        }[];
    }>, "many">;
    start: z.ZodNumber;
    costs: z.ZodNumber;
    end: z.ZodOptional<z.ZodNumber>;
    duration: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    data?: {
        comment?: string;
        id?: string;
        interview?: string;
        video?: string;
        timestamp?: string;
    }[];
    title?: string;
    question?: string;
    pieChart?: {
        title?: string;
        items?: {
            label?: string;
            count?: number;
        }[];
    }[];
    description?: string;
    systemInstructions?: string;
    clusteringInstructions?: string;
    extractionInstructions?: string;
    batchSize?: number;
    tree?: {
        topicName?: string;
        topicShortDescription?: string;
        topicId?: string;
        claimsCount?: number;
        subtopics?: {
            subtopicName?: string;
            subtopicShortDescription?: string;
            subtopicId?: string;
            claimsCount?: number;
            claims?: Claim[];
        }[];
    }[];
    start?: number;
    costs?: number;
    end?: number;
    duration?: string;
}, {
    data?: {
        comment?: string;
        id?: string;
        interview?: string;
        video?: string;
        timestamp?: string;
    }[];
    title?: string;
    question?: string;
    pieChart?: {
        title?: string;
        items?: {
            label?: string;
            count?: number;
        }[];
    }[];
    description?: string;
    systemInstructions?: string;
    clusteringInstructions?: string;
    extractionInstructions?: string;
    batchSize?: number;
    tree?: {
        topicName?: string;
        topicShortDescription?: string;
        topicId?: string;
        claimsCount?: number;
        subtopics?: {
            subtopicName?: string;
            subtopicShortDescription?: string;
            subtopicId?: string;
            claimsCount?: number;
            claims?: Claim[];
        }[];
    }[];
    start?: number;
    costs?: number;
    end?: number;
    duration?: string;
}>;
export type PipelineOutput = z.infer<typeof pipelineOutput>;
export declare const sourceMap: z.ZodRecord<z.ZodString, z.ZodObject<{
    comment: z.ZodString;
    id: z.ZodString;
    interview: z.ZodOptional<z.ZodString>;
    video: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    comment?: string;
    id?: string;
    interview?: string;
    video?: string;
    timestamp?: string;
}, {
    comment?: string;
    id?: string;
    interview?: string;
    video?: string;
    timestamp?: string;
}>>;
export type SourceMap = z.infer<typeof sourceMap>;
export declare const thisIsATest: z.ZodBoolean;
