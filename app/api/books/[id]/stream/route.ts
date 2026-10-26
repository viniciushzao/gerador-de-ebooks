import { NextRequest } from "next/server";
import { pipelineEmitter } from "@/lib/queue/task-engine";
import { getBook, getChapters, getTasks, getAuditLogs, onAuditLog } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;
  let progressListener: ((data: any) => void) | null = null;
  let unsubscribeAuditLog: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initialBook = getBook(id);
      const initialChapters = getChapters(id);
      const initialTasks = getTasks(id);
      const initialLogs = getAuditLogs(id);

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "init",
            book: initialBook,
            chapters: initialChapters,
            tasks: initialTasks,
            auditLogs: initialLogs,
          })}\n\n`
        )
      );

      // If already finished at connection time, do not start heartbeat or listeners
      if (initialBook?.status === "completed" || initialBook?.status === "failed") {
        return;
      }

      // Listen for pipeline progress events
      progressListener = (data: any) => {
        try {
          const currentBook = getBook(id);
          const currentChapters = getChapters(id);
          const currentTasks = getTasks(id);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "update",
                event: data,
                book: currentBook,
                chapters: currentChapters,
                tasks: currentTasks,
              })}\n\n`
            )
          );

          if (currentBook?.status === "completed" || currentBook?.status === "failed") {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            try {
              controller.close();
            } catch {}
          }
        } catch (e) {
          // Stream might be closed
        }
      };

      pipelineEmitter.on(`progress:${id}`, progressListener);

      // Instant log emission: whenever ANY agent logs anything, stream ONLY the incremental log
      unsubscribeAuditLog = onAuditLog((newLog) => {
        if (newLog.book_id !== id) return;
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "log",
                log: newLog,
              })}\n\n`
            )
          );
        } catch {
          // Stream might be closed
        }
      });

      // Periodic heartbeat/poll every 2 seconds to ensure fresh state
      intervalId = setInterval(() => {
        try {
          const currentBook = getBook(id);
          const currentChapters = getChapters(id);
          const currentTasks = getTasks(id);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "heartbeat",
                book: currentBook,
                chapters: currentChapters,
                tasks: currentTasks,
              })}\n\n`
            )
          );

          if (currentBook?.status === "completed" || currentBook?.status === "failed") {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            try {
              controller.close();
            } catch {}
          }
        } catch {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      }, 2000);
    },
    cancel() {
      if (progressListener) {
        pipelineEmitter.off(`progress:${id}`, progressListener);
      }
      if (unsubscribeAuditLog) {
        unsubscribeAuditLog();
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
