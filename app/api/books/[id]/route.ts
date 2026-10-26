import { NextRequest, NextResponse } from "next/server";
import { getBook, getChapters, getTasks, getAuditLogs } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = getBook(id);
    if (!book) {
      return NextResponse.json(
        { success: false, error: "Livro não encontrado." },
        { status: 404 }
      );
    }

    const chapters = getChapters(id).map((ch) => {
      // Omite content_markdown completo da rota de polling/status para evitar transferir centenas de KB de SVG/text a cada requisição
      const { content_markdown, ...rest } = ch;
      return rest;
    });
    const tasks = getTasks(id);
    // Limita os logs retornados para os mais recentes (máximo 150) para prevenir inchaço
    const allLogs = getAuditLogs(id);
    const auditLogs = allLogs.length > 150 ? allLogs.slice(-150) : allLogs;

    return NextResponse.json(
      {
        success: true,
        data: {
          book,
          chapters,
          tasks,
          auditLogs,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar dados do livro." },
      { status: 500 }
    );
  }
}
