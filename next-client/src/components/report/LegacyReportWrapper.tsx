"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isValidReportUri, FIRESTORE_ID_REGEX } from "tttc-common/utils";
import { Spinner } from "@/components/elements";

interface LegacyReportWrapperProps {
  uri: string;
  children: React.ReactNode;
}

export default function LegacyReportWrapper({
  uri,
  children,
}: LegacyReportWrapperProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkForMigration = async () => {
      // Decode URI for validation (it comes URL-encoded from the route)
      const decodedUri = decodeURIComponent(uri);

      // Skip migration for Firebase document IDs (they're already in the new format)
      if (FIRESTORE_ID_REGEX.test(decodedUri)) {
        setIsChecking(false);
        return;
      }

      // Validate URI before attempting migration
      if (!isValidReportUri(decodedUri)) {
        console.warn("Invalid report URI format:", decodedUri);
        setIsChecking(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/report/${encodeURIComponent(uri)}/migrate`,
        );
        const result = await response.json();

        if (result.success && result.newUrl) {
          // Redirect to new ID-based URL
          router.replace(result.newUrl);
          return;
        }
      } catch (error) {
        console.warn("Migration check failed:", error);
      }

      setIsChecking(false);
    };

    checkForMigration();
  }, [uri, router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="size-8" label="Loading report" />
      </div>
    );
  }

  return <>{children}</>;
}
