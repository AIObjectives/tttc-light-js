export async function POST(request: Request) {
  // Import Firebase-related code only when this function runs and not during the build
  const { addFeedback } = await import("@/lib/firebase/firestoreServer");
  const { getAuthenticatedAppForUser } = await import(
    "@/lib/firebase/serverApp"
  );
  const { feedbackRequest } = await import("@/lib/types/clientRoutes");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { NextResponse } = await import("next/server");

  console.log(1);
  const js = await request.json();
  const parsed = feedbackRequest.safeParse(js);
  console.log("test", js);
  console.log(2);
  if (!parsed.success)
    return new NextResponse(
      JSON.stringify({
        response: ["error", { message: parsed.error.issues.join("\n") }],
      }),
    );
  console.log(3);
  try {
    const { firebaseServerApp, currentUser } =
      await getAuthenticatedAppForUser();
    if (!currentUser) {
      return new NextResponse(
        JSON.stringify({ response: ["error", { message: "Unauthorized" }] }),
        { status: 401 },
      );
    }
    console.log(4);
    const firestore = getFirestore(firebaseServerApp);
    console.log(5);
    const res = await addFeedback(firestore, {
      ...parsed.data,
      userId: currentUser.uid,
    });
    console.log(6);
    console.log("firebase response", res);
    if (res === "success")
      return new NextResponse(
        JSON.stringify({ response: ["data", "success"] }),
      );
    else
      throw new Error(
        "Received different value from add feedback - shouldn't happen",
      );
  } catch (e) {
    if (e instanceof Error) {
      return new NextResponse(
        JSON.stringify({ response: ["error", { message: e.message }] }),
      );
    } else {
      return new NextResponse(
        JSON.stringify({
          response: ["error", { message: "An error occurred" }],
        }),
      );
    }
  }
}
