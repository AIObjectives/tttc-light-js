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
export type Cache = {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
};
export type Tracker = {
    start: number;
    costs: number;
    prompt_tokens: number;
    completion_tokens: number;
    unmatchedClaims: Claim[];
    end?: number;
    duration?: string;
};
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
export type Subtopic = {
    subtopicName: string;
    subtopicShortDescription?: string;
    subtopicId?: string;
    claimsCount?: number;
    claims?: Claim[];
};
export type Topic = {
    topicName: string;
    topicShortDescription?: string;
    topicId?: string;
    claimsCount?: number;
    subtopics: Subtopic[];
};
export type Taxonomy = Topic[];
export type PipelineOutput = {
    data: SourceRow[];
    title: string;
    question: string;
    pieCharts?: PieChart[];
    description: string;
    systemInstructions: string;
    clusteringInstructions: string;
    extractionInstructions: string;
    batchSize: number;
    tree: Taxonomy;
    start: number;
    costs: number;
    end?: number;
    duration?: string;
};
export type SourceMap = {
    [key: string]: SourceRow;
};
