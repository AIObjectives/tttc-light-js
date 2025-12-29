/**
 * API client for fetching user capabilities and limits
 */

import {
  type UserCapabilitiesResponse,
  userCapabilitiesResponse,
} from "tttc-common/api";
import { getFirebaseAuth } from "@/lib/firebase/clientApp";
import { fetchWithRequestId } from "./fetchWithRequestId";

export type UserCapabilities = UserCapabilitiesResponse;

/**
 * Fetch the current user's capabilities and limits from the server
 * @returns The user's capabilities or null if not authenticated
 */
export async function getUserCapabilities(): Promise<UserCapabilities | null> {
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    const token = await user.getIdToken();
    const response = await fetchWithRequestId("/api/user/limits", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Failed to read error response");
      console.error("Failed to fetch user limits:", response.status, errorText);
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    // Validate response schema for type safety
    const capabilities = userCapabilitiesResponse.parse(responseData);
    return capabilities;
  } catch (error) {
    console.error("Error fetching user capabilities:", error);
    return null;
  }
}

/**
 * Format bytes to a human-readable string
 * @param bytes Number of bytes
 * @returns Formatted string (e.g., "150KB", "2MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}
