/**
 * User Profile Management Routes
 *
 * Handles progressive profiling for monday.com CRM integration.
 * Users can update their profile information which syncs to monday.com.
 */

import type { Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { logger } from "tttc-common/logger";
import { z } from "zod";
import * as firebase from "../Firebase";
import { createMondayItem } from "../services/monday";
import type { RequestWithLogger } from "../types/request";
import { sendError } from "./sendError";

const profileLogger = logger.child({ module: "profile" });

/**
 * Basic phone number validation regex
 * Allows: digits, spaces, hyphens, parentheses, plus sign
 * Examples: +1 (555) 123-4567, 555-123-4567, +44 20 7946 0958
 */
const phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;

/**
 * Profile update request schema
 * All fields are optional for progressive profiling
 */
const profileUpdateSchema = z.object({
  company: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(100).optional(),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(phoneRegex, "Invalid phone number format")
    .optional(),
  useCase: z.string().trim().min(1).max(500).optional(),
  newsletterOptIn: z.boolean().optional(),
});

/**
 * Verify Firebase authentication token from request headers
 * @returns Decoded token if valid, null otherwise (sends error response)
 */
async function verifyAuthToken(
  req: RequestWithLogger,
  res: Response,
): Promise<DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, 401, "Missing or invalid authorization header", "AuthError");
    return null;
  }

  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await firebase.verifyUser(token);

  if (!decodedToken) {
    sendError(res, 401, "Invalid authentication token", "AuthError");
    return null;
  }

  return decodedToken;
}

/**
 * POST /api/profile/update
 *
 * Update user profile fields and sync to monday.com
 * Requires Firebase authentication token
 *
 * Request body:
 * {
 *   company?: string,
 *   title?: string,
 *   phone?: string,
 *   useCase?: string,
 *   newsletterOptIn?: boolean
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Profile updated successfully"
 * }
 */
export async function updateProfile(req: RequestWithLogger, res: Response) {
  try {
    // Verify Firebase auth token
    const decodedToken = await verifyAuthToken(req, res);
    if (!decodedToken) {
      return; // Response already sent by verifyAuthToken
    }

    // Parse and validate request body
    const profileData = profileUpdateSchema.parse(req.body);

    profileLogger.info(
      {
        uid: decodedToken.uid,
        email: decodedToken.email,
        hasCompany: !!profileData.company,
        hasTitle: !!profileData.title,
        hasPhone: !!profileData.phone,
        hasUseCase: !!profileData.useCase,
        hasNewsletterOptIn: profileData.newsletterOptIn !== undefined,
      },
      "Profile update requested",
    );

    // Update Firebase user document (this will also trigger monday.com sync if needed)
    await firebase.ensureUserDocument(
      decodedToken.uid,
      decodedToken.email || null,
      decodedToken.name || null,
      profileData,
    );

    // For profile updates on existing users, we want to update monday.com
    // Since ensureUserDocument only syncs for NEW users, we need to manually sync here
    if (decodedToken.name && decodedToken.email) {
      // Trigger monday.com sync (async, non-blocking)
      createMondayItem({
        displayName: decodedToken.name,
        email: decodedToken.email,
        company: profileData.company,
        title: profileData.title,
        phone: profileData.phone,
        useCase: profileData.useCase,
        newsletterOptIn: profileData.newsletterOptIn,
      }).catch((error) => {
        // monday.com sync failures are non-critical
        profileLogger.warn(
          { error, uid: decodedToken.uid },
          "monday.com sync failed for profile update (non-blocking)",
        );
      });
    }

    profileLogger.info(
      { uid: decodedToken.uid },
      "Profile updated successfully",
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      profileLogger.warn({ error: error.errors }, "Profile validation failed");
      sendError(
        res,
        400,
        `Invalid profile data: ${error.errors.map((e) => e.message).join(", ")}`,
        "ValidationError",
      );
      return;
    }

    profileLogger.error({ error }, "Profile update failed");
    sendError(
      res,
      500,
      error instanceof Error ? error.message : "Failed to update profile",
      "ProfileUpdateError",
    );
  }
}
