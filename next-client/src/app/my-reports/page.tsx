"use client";
import { useUser } from "@/lib/hooks/getUser";
import { getUsersReports } from "../../lib/firebase/firestoreClient";
import { getFirebaseDb } from "@/lib/firebase/clientApp";
import { useAsyncState } from "@/lib/hooks/useAsyncState";
import { useEffect, useState } from "react";
import MyReports from "@/components/myReports/MyReports";
import { Spinner } from "@/components/elements";

const db = getFirebaseDb();

function Center({ children }: React.PropsWithChildren) {
  return (
    <div className="w-full h-full content-center justify-items-center">
      {children}
    </div>
  );
}

export default function MyReportsPage() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const user = useUser();
  useEffect(() => {
    if (user) setUserId(user.uid);
    else setUserId(null);
  }, [user]);
  if (userId === undefined)
    return (
      <Center>
        <p>Please login to see your reports</p>
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
  const user = useUser();
  const { isLoading, result } = useAsyncState(
    async () => await getUsersReports(db, userId),
    user,
  );

  if (isLoading || result === undefined)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (result[0] === "error" || user === null)
    return (
      <Center>
        <p>There was an issue loading your reports</p>
      </Center>
    );
  const reports = result[1];

  return (
    <div className="justify-items-center">
      <MyReports reports={reports} />
    </div>
  );
}
