import { z } from "zod";

// export const chainMatch = <S extends z.Schema>(zSchema:S, func:(some:z.TypeOf<S>)=>string[], passFunc:(unknown:unknown)=>string[]) => (val:unknown):string[] => {
//     if (zSchema.safeParse(val).success) return func(zSchema.parse(val))
//     else return passFunc(val)
// }
// TODO: figure this out
// type Case<S extends z.Schema, T> = [S, (params:z.TypeOf<S>)=> T]
// export const chainMatch = <S extends z.Schema, T>(...params:Case<S, T>[]) => (data:unknown) => params.reduce((val, compare) => (val !== undefined && compare[0].safeParse(data).success) ? val = compare[1](compare[0].parse(data)) : val, undefined as unknown)
