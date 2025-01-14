"use client";
// ! TEMP PAGE FOR TESTING
import { useUser } from "@src/lib/hooks/getUser";
import { getUsersReports } from "../../lib/firebase/firestore";
import { db } from "@src/lib/firebase/clientApp";
import { useAsyncState } from "@src/lib/hooks/useAsyncState";
import { useEffect, useState } from "react";
import YourReports from "@src/components/yourReports/YourReports";
import { Spinner } from "@src/components/elements";

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
  if (userId === undefined) return <></>;
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
  console.log(result[1]);
  if (result[0] === "error")
    return (
      <Center>
        <p>There was an issue loading your reports</p>
      </Center>
    );
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
