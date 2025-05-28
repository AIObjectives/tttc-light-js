import { addFeedback } from "@/lib/firebase/firestoreServer";
import { getAuthenticatedAppForUser } from "@/lib/firebase/serverApp";
import { feedbackRequest } from "@/lib/types/clientRoutes";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = feedbackRequest.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { response: ["error", { message: "Invalid request format" }] },
        { status: 400 },
      );
    }

    const { firebaseServerApp, currentUser } =
      await getAuthenticatedAppForUser();

    if (!currentUser) {
      return NextResponse.json(
        { response: ["error", { message: "Unauthorized" }] },
        { status: 401 },
      );
    }

    const firestore = getFirestore(firebaseServerApp);
    await addFeedback(firestore, {
      ...parsed.data,
      userId: currentUser.uid,
    });

    return NextResponse.json({
      response: ["data", "success"],
    });
  } catch (error) {
    console.error("Feedback submission failed:", error);
    return NextResponse.json(
      { response: ["error", { message: "An error occurred" }] },
      { status: 500 },
    );
  }
}
