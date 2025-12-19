"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/elements";
import { Center } from "@/components/layout";
import MyReports from "@/components/myReports/MyReports";
import { getFirebaseDb } from "@/lib/firebase/clientApp";
import { getUsersReports } from "@/lib/firebase/firestoreClient";
import { useUser } from "@/lib/hooks/getUser";
import { useAsyncState } from "@/lib/hooks/useAsyncState";

export default function MyReportsPage() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading) {
      if (user) setUserId(user.uid);
      else setUserId(null);
    }
  }, [user, loading]);

  if (loading || userId === undefined)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (userId === null)
    return (
      <Center>
        <p>Please login to see your reports</p>
      </Center>
    );
  return <MyReportsUI userId={userId} />;
}

function MyReportsUI({ userId }: { userId: string }) {
  const { user } = useUser();

  const { isLoading, result } = useAsyncState(async () => {
    const db = getFirebaseDb();
    return await getUsersReports(db, userId);
  }, user);

  if (isLoading || result === undefined)
    return (
      <Center>
        <Spinner />
      </Center>
    );

  if (result.tag === "failure" || user === null)
    return (
      <Center>
        <p>There was an issue loading your reports</p>
      </Center>
    );

  const reports = result.value;

  return (
    <div className="justify-items-center">
      <MyReports reports={reports} />
    </div>
  );
}
