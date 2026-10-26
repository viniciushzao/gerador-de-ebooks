import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/db/client";
import { runFullPipeline } from "@/lib/queue/task-engine";

export async function POST(
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

    if (
      book.status !== "pending" &&
      book.status !== "failed" &&
      book.status !== "completed"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A esteira autônoma deste livro já está em execução.",
        },
        { status: 400 }
      );
    }

    // Launch pipeline in background without blocking the HTTP request
    runFullPipeline(id).catch((err) => {
      console.error(`Erro assíncrono na esteira do livro ${id}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: "Esteira de produção autônoma iniciada com sucesso.",
      data: { bookId: id, status: "ingesting" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao iniciar esteira." },
      { status: 500 }
    );
  }
}
