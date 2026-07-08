import { NextResponse } from "next/server";
import { login } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await login(String(body.email || ""), String(body.password || ""));
    if (!user) return NextResponse.json({ ok: false, error: "Usuario ou senha invalidos." }, { status: 401 });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro no login." }, { status: 500 });
  }
}
