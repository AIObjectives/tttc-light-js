import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { uri: string } }) {
  const encodedUri = await params.uri; // we get an error saying that params needs to be awaited? Add await here until it's clearer as to what's going on.
  const uri = decodeURIComponent(encodedUri);
  const jsonData = await fetch(uri, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then(async (res) => await res.json());

  return NextResponse.json(jsonData);
}
