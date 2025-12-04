import { Response } from "express";
import { RequestWithLogger } from "../types/request";
import * as firebase from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendErrorByCode } from "./sendError";
import { ERROR_CODES } from "tttc-common/errors";

export default async function ensureUser(
  req: RequestWithLogger,
  res: Response,
) {
  req.log.info("Ensure user endpoint called");
  try {
    const { firebaseAuthToken } = req.body;

    if (!firebaseAuthToken) {
      req.log.warn("No firebaseAuthToken provided");
      return sendErrorByCode(res, ERROR_CODES.AUTH_TOKEN_MISSING, req.log);
    }

    let decodedUser: DecodedIdToken;
    try {
      decodedUser = await firebase.verifyUser(firebaseAuthToken);
      req.log.info({ uid: decodedUser.uid }, "Token verified");
    } catch (tokenError) {
      req.log.error({ error: tokenError }, "Token verification failed");
      return sendErrorByCode(res, ERROR_CODES.AUTH_TOKEN_INVALID, req.log);
    }

    const userDocument = await firebase.ensureUserDocument(
      decodedUser.uid,
      decodedUser.email || null,
      decodedUser.name || null,
    );

    req.log.info({ uid: decodedUser.uid }, "User document ensured");
    res.json({
      success: true,
      uid: decodedUser.uid,
      user: userDocument,
      message: "User document ensured successfully",
    });
  } catch (error) {
    req.log.error({ error }, "Error ensuring user");
    sendErrorByCode(res, ERROR_CODES.INTERNAL_ERROR, req.log);
  }
}
