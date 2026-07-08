import { NextResponse } from "next/server";
import { login } from "@/lib/db";
import { demoLogin, isDemoMode } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (isDemoMode()) {
      const user = await demoLogin(String(body.email || ""), String(body.password || ""));
      if (!user) return NextResponse.json({ ok: false, error: "Usuario ou senha invalidos." }, { status: 401 });
      return NextResponse.json({ ok: true, user, demo: true });
    }
    const user = await login(String(body.email || ""), String(body.password || ""));
    if (!user) return NextResponse.json({ ok: false, error: "Usuario ou senha invalidos." }, { status: 401 });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro no login." }, { status: 500 });
  }
}
