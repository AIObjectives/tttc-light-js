import { Request, Response } from "express";
import * as firebase from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendError } from "./sendError";

export default async function ensureUser(req: Request, res: Response) {
  console.log("[UserAccount] EXPRESS ENSURE USER: Ensure user endpoint called");
  try {
    const { firebaseAuthToken } = req.body;

    if (!firebaseAuthToken) {
      console.log(
        "[UserAccount] EXPRESS ENSURE USER: No firebaseAuthToken provided",
      );
      return sendError(res, 400, "Missing firebaseAuthToken", "AuthError");
    }

    const decodedUser: DecodedIdToken =
      await firebase.verifyUser(firebaseAuthToken);
    console.log(
      `[UserAccount] EXPRESS ENSURE USER: Token verified for UID: ${decodedUser.uid}`,
    );

    await firebase.ensureUserDocument(
      decodedUser.uid,
      decodedUser.email || null,
      decodedUser.name || null,
    );

    console.log(
      `[UserAccount] EXPRESS ENSURE USER: User document ensured for UID: ${decodedUser.uid}`,
    );
    res.json({
      success: true,
      uid: decodedUser.uid,
      message: "User document ensured successfully",
    });
  } catch (error) {
    console.error(
      "[UserAccount] EXPRESS ENSURE USER: Error ensuring user:",
      error,
    );
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    sendError(res, 500, message, "EnsureUserError");
  }
}
