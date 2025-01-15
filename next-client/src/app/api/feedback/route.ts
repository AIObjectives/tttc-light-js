import { addFeedback } from "@src/lib/firebase/firestore";
import { getUnauthenticatedApp } from "@src/lib/firebase/serverApp";
import { feedbackRequest } from "@src/lib/types/clientRoutes";
import { getFirestore } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
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
    const { firebaseServerApp } = await getUnauthenticatedApp();
    console.log(4);
    const firestore = getFirestore(firebaseServerApp);
    console.log(5);
    const res = await addFeedback(firestore, parsed.data);
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
          response: ["error", { message: "An error occured" }],
        }),
      );
    }
  }
}
