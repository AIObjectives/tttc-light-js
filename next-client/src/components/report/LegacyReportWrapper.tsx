"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isValidReportUri } from "tttc-common/utils";

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
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Checking report availability...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
