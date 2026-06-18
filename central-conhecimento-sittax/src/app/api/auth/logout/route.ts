import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

/** POST /api/auth/logout — destrói a sessão; 200 idempotente. */
export async function POST(): Promise<NextResponse> {
  await destroySession();
  return NextResponse.json({ ok: true });
}
