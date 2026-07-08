import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { isDemoMode } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST() {
  try {
    if (isDemoMode()) return NextResponse.json({ ok: true, demo: true });
    await ensureSchema();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao preparar banco." }, { status: 500 });
  }
}
