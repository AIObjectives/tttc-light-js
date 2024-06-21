import * as schema from "../schema";
import { z } from "zod";

// ! these functions haven't been tested thoroughly yet

const fromSources = (arg: schema.Source[]): string[] =>
  Array.from(new Set(arg.map((src) => src.id)));

const fromReferences = (arg: schema.Referece[]): string[] =>
  Array.from(new Set(arg.map((ref) => ref.id)));

const fromQuotes = (arg: schema.Quote[]): string[] =>
  fromReferences(arg.flatMap((claim) => claim.reference));

const fromClaims = (arg: schema.Claim[]): string[] =>
  fromQuotes(arg.flatMap((claim) => claim.quotes));

const fromTopics = (arg: schema.Topic[]): string[] =>
  fromClaims(arg.flatMap((topic) => topic.claims));

const fromTheme = (arg: schema.Theme[]): string[] =>
  fromTopics(arg.flatMap((theme) => theme.topics));

const fromReport = (arg: schema.ReportDataObj): string[] =>
  fromTheme(arg.themes);

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

const chainTopics = chainMatch(schema.topic.array(), fromTopics, chainClaims);

const chainTheme = chainMatch(schema.theme.array(), fromTheme, chainTopics);

const chainReport = chainMatch(schema.reportDataObj, fromReport, chainTheme);

export const getNPeople = (
  arg:
    | schema.ReportDataObj
    | schema.Theme[]
    | schema.Topic[]
    | schema.Claim[]
    | schema.Quote[]
    | schema.Referece[]
    | schema.Source[],
) => chainReport(arg).length;

export const getNClaims = (arg: schema.Topic[]) => fromTopics(arg).length;
