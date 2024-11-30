import { Request, Response, NextFunction } from "express";
import { Env } from "types/context";

export const contextMiddleware = (validatedEnv: Env) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.context = { env: validatedEnv };
    next();
  };
};
