import { NextRequest, NextResponse } from "next/server";
import { replayChapterTask } from "@/lib/queue/task-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const chapterId = body.chapterId;

    if (!chapterId) {
      return NextResponse.json(
        { success: false, error: "chapterId é obrigatório para Replay." },
        { status: 400 }
      );
    }

    // Launch replay task in background
    replayChapterTask(id, chapterId).catch((err) => {
      console.error(`Erro ao reexecutar capítulo ${chapterId}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: `Replay iniciado para o capítulo ${chapterId}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao processar Replay." },
      { status: 500 }
    );
  }
}
