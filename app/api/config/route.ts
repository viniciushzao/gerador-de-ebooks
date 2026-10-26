import { NextResponse } from "next/server";
import { getSystemConfig } from "@/lib/config";

export async function GET() {
  try {
    const config = getSystemConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Erro ao carregar configurações." },
      { status: 500 }
    );
  }
}
