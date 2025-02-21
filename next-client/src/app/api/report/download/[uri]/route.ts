import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { uri: string } }) {
  const encodedUri = params.uri;
  const uri = decodeURIComponent(encodedUri);
  const jsonData = await fetch(uri, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then(async (res) => await res.json());

  return NextResponse.json(jsonData);
}
