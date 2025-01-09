"use client";
// ! TEMP PAGE FOR TESTING
import { useUser } from "@src/lib/hooks/getUser";
import { getUsersReports } from "../../lib/firebase/firestore";
import { db } from "@src/lib/firebase/clientApp";
import { useAsyncState } from "@src/lib/hooks/useAsyncState";
import { useEffect, useState } from "react";
import YourReports from "@src/components/yourReports/YourReports";

export default function MyReportsPage() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const user = useUser();
  useEffect(() => {
    if (user) setUserId(user.uid);
    else setUserId(null);
  }, [user]);
  if (userId === undefined) return <></>;
  if (userId === null) return <p>Unauthorized can't find user</p>;
  return <MyReportsUI userId={userId} />;
}

function MyReportsUI({ userId }: { userId: string }) {
  const user = useUser();
  const { isLoading, result } = useAsyncState(
    async () => await getUsersReports(db, userId),
    user,
  );

  if (isLoading || result === undefined) return <p>Loading...</p>;
  console.log(result[1]);
  if (result[0] === "error") return <p>Unauthorized</p>;
  const reports = result[1];

  return (
    <div className="justify-items-center">
      <YourReports
        userName={user!.displayName!}
        reports={reports}
        pictureUri={user?.photoURL || undefined}
      />
    </div>
  );
}
