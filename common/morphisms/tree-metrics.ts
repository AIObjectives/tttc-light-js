import * as schema from "../schema";
import { z } from "zod";

// ! these functions haven't been tested thoroughly yet
// TODO: Review this file - add comments and make more readble.

const fromSources = (arg: schema.Source[]): string[] =>
  Array.from(
    new Set(arg.map((src, i) => src.interview ?? `${Date.now()} #${i}`)),
  );

const fromReferences = (arg: schema.Referece[]): string[] =>
  Array.from(
    new Set(arg.map((ref, i) => ref.interview ?? `${Date.now()} #${i}`)),
  );

const fromQuotes = (arg: schema.Quote[]): string[] =>
  fromReferences(arg.flatMap((claim) => claim.reference));

const fromClaims = (arg: schema.Claim[]): string[] =>
  fromQuotes(arg.flatMap((claim) => claim.quotes));

const fromSubtopics = (arg: schema.Subtopic[]): string[] =>
  fromClaims(arg.flatMap((topic) => topic.claims));

const fromTopics = (arg: schema.Topic[]): string[] =>
  fromSubtopics(arg.flatMap((theme) => theme.subtopics));

const fromReport = (arg: schema.ReportDataObj): string[] =>
  fromTopics(arg.topics);

const chainMatch =
  <S extends z.Schema, T>(
    zSchema: S,
    func: (some: z.TypeOf<S>) => T,
    passFunc: (unknown: unknown) => T,
  ) =>
  (val: unknown): T => {
    if (zSchema.safeParse(val).success) return func(zSchema.parse(val));
    else return passFunc(val);
  };

const chainSources = chainMatch(schema.source.array(), fromSources, () => {
  throw new Error("Invalid input for chain function. Not matches.");
});

const chainReferences = chainMatch(
  schema.reference.array(),
  fromReferences,
  chainSources,
);

const chainQuotes = chainMatch(
  schema.quote.array(),
  fromQuotes,
  chainReferences,
);

const chainClaims = chainMatch(schema.claim.array(), fromClaims, chainQuotes);

const chainTopics = chainMatch(
  schema.subtopic.array(),
  fromSubtopics,
  chainClaims,
);

const chainTheme = chainMatch(schema.topic.array(), fromTopics, chainTopics);

const chainReport = chainMatch(schema.reportDataObj, fromReport, chainTheme);

export const getNPeople = (
  arg:
    | schema.ReportDataObj
    | schema.Topic[]
    | schema.Subtopic[]
    | schema.Claim[]
    | schema.Quote[]
    | schema.Referece[]
    | schema.Source[],
) => chainReport(arg).length;

export const getNClaims = (arg: schema.Subtopic[]) =>
  arg.flatMap((s) => s.claims).length;

export const getQuotes = (claim: schema.Claim): schema.Quote[] =>
  claim.quotes.concat(claim.similarClaims.flatMap((clm) => clm.quotes));
