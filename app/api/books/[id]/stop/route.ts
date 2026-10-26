import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/db/client";
import { forceStopPipeline } from "@/lib/queue/task-engine";

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

    if (book.status === "completed") {
      return NextResponse.json(
        { success: false, error: "Este livro já está 100% concluído e com PDF gerado. Nenhuma esteira ativa para interromper." },
        { status: 400 }
      );
    }

    await forceStopPipeline(id);

    return NextResponse.json({
      success: true,
      message: "Esteira de produção autônoma interrompida imediatamente via Force Stop.",
      data: { bookId: id, status: "failed" },
    });
  } catch (error: any) {
    console.error("Erro ao forçar parada da esteira:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao forçar parada." },
      { status: 500 }
    );
  }
}
