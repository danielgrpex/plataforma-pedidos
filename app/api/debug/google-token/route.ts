import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.googleAccessToken as string | undefined;

  if (!token) {
    return NextResponse.json({ ok: false, message: "No token in session" }, { status: 401 });
  }

  const url =
    "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" +
    encodeURIComponent(token);

  const res = await fetch(url, { cache: "no-store" });
  const info = await res.json();

  return NextResponse.json({
    ok: true,
    tokenLength: token.length,
    tokenPreview: token.slice(0, 15) + "...",
    info,
  });
}
