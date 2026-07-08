import { NextResponse } from "next/server";
import { getState } from "@/lib/db";
import { demoState, isDemoMode } from "@/lib/demo";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || undefined;
    const role = (url.searchParams.get("role") || undefined) as Role | undefined;
    if (isDemoMode()) {
      const state = await demoState(userId, role);
      return NextResponse.json({ ok: true, state, demo: true });
    }
    const state = await getState(userId, role);
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao carregar dados." }, { status: 500 });
  }
}
