"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Activity,
  GitBranch,
  RotateCcw,
  Sparkles,
  Zap,
  Clock,
  Coins,
  ChevronRight,
  Shield,
  Layers,
  Terminal,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
} from "lucide-react";
import { BookRecord, ChapterRecord, TaskRecord, AuditLogRecord } from "@/lib/db/schema";

export default function AuditTrailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [book, setBook] = useState<BookRecord | null>(null);
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("ALL");

  useEffect(() => {
    const eventSource = new EventSource(`/api/books/${id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.book) setBook(data.book);
        if (data.chapters) setChapters(data.chapters);
        if (data.tasks) setTasks(data.tasks);
        if (data.auditLogs) setLogs(data.auditLogs);
      } catch (e) {
        console.error("Erro ao ler stream de auditoria:", e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [id]);

  const handleReplay = async (chapterId: string) => {
    if (!confirm("Deseja reexecutar apenas este capítulo em isolamento?")) return;

    setReplayingId(chapterId);
    try {
      const res = await fetch(`/api/books/${id}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Erro no replay: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Falha ao disparar replay: ${e.message || e}`);
    } finally {
      setReplayingId(null);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (filterRole === "ALL") return true;
    if (filterRole === "SKILLS") return !!l.skill_badge;
    return l.agent_role.includes(filterRole);
  });

  const totalTokens = logs.reduce((acc, l) => acc + (l.tokens || 0), 0);
  const totalCost = logs.reduce((acc, l) => acc + (l.cost_usd || 0), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Link href="/" className="hover:text-slate-200">
            Livros
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href={`/books/${id}`} className="hover:text-slate-200">
            {book?.title || "Livro"}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-200 font-semibold">Trilha de Auditoria (DAG)</span>
        </div>

        <Link
          href={`/books/${id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 transition text-xs font-medium"
        >
          <Layers className="w-3.5 h-3.5" /> Voltar ao Painel
        </Link>
      </div>

      {/* Audit Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">
                Trilha de Auditoria & Observabilidade DAG
              </h1>
              <p className="text-xs text-slate-400">
                Árvore de chamadas, telemetria de tokens, custos Gemini 3.7 Flash e Modo Replay
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-750 text-xs">
              <span className="text-[10px] text-slate-400 uppercase block">Custo Total Acumulado</span>
              <span className="font-mono font-bold text-emerald-400">
                ${totalCost.toFixed(5)} USD
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual DAG Hierarchy Tree */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-emerald-400" />
          Topologia da Hierarquia de Agentes (Grafo DAG)
        </h2>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
          {/* Root Level: System & ai-rag */}
          <div className="flex items-center justify-center">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-emerald-500/40 text-center shadow-lg w-72">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide block">
                Plugin Local
              </span>
              <h4 className="text-xs font-bold text-slate-100">[ai-rag] Ingestão Semântica</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Chunking & Vetorização ChromaDB</p>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-700 mx-auto"></div>

          {/* Level 1: CEO Orchestrator */}
          <div className="flex items-center justify-center">
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-indigo-500/50 text-center shadow-xl w-80">
              <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide block">
                Nó Raiz do DAG (Parent Task = NULL)
              </span>
              <h4 className="text-xs font-bold text-slate-100">CEO Agente Orquestrador</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Plano de Capítulos & Distribuição Paralela
              </p>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-700 mx-auto"></div>

          {/* Level 2: Parallel Chapter Writers with Replay */}
          <div>
            <div className="text-center mb-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Subagentes Escritores Descentralizados (Execução Paralela)
              </span>
            </div>

            {chapters.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                Aguardando o CEO disparar a criação dos nós dos capítulos...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-3 rounded-xl bg-slate-850 border border-slate-750 hover:border-emerald-500/40 transition space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        Cap. {ch.chapter_number}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          ch.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : ch.status === "running"
                            ? "bg-indigo-500/10 text-indigo-400 animate-pulse"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {ch.status}
                      </span>
                    </div>

                    <h5 className="text-xs font-semibold text-slate-200 line-clamp-1">
                      {ch.title}
                    </h5>

                    <div className="text-[10px] text-slate-400 space-y-0.5 font-mono">
                      <div>Tokens: {ch.tokens_used.toLocaleString()}</div>
                      <div>Custo: ${ch.cost_usd.toFixed(4)}</div>
                      <div>Latência: {ch.latency_ms}ms</div>
                    </div>

                    {/* Replay Button */}
                    <button
                      onClick={() => handleReplay(ch.id)}
                      disabled={
                        replayingId !== null ||
                        (book?.status !== "completed" &&
                          book?.status !== "pending" &&
                          book?.status !== "failed")
                      }
                      className="w-full mt-2 py-1 px-2 rounded bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-[10px] font-medium transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className={`w-3 h-3 ${replayingId === ch.id ? "animate-spin" : ""}`} />
                      {replayingId === ch.id ? "Reexecutando..." : "Reexecutar Nó (Replay)"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-slate-700 mx-auto"></div>

          {/* Level 3: Designer & PDF Compiler */}
          <div className="flex items-center justify-center">
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-teal-500/40 text-center shadow-lg w-80">
              <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wide block">
                Subagente Designer & Compilador PDF
              </span>
              <h4 className="text-xs font-bold text-slate-100">Diagramação & Exportação</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Tipografia {book?.typography || "Garamond"} · Paged Media PDF
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Event Log Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            Registro de Auditoria em Tempo Real ({filteredLogs.length} eventos)
          </h2>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
            {["ALL", "CEO", "PRESENTATION", "WRITER", "DESIGNER", "SKILLS"].map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  filterRole === role
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
            Nenhum evento registrado no momento.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-750 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                      {log.agent_role}
                    </span>

                    {log.skill_badge && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 font-semibold ${
                          log.skill_badge === "snow-d3"
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/40 shadow-sm"
                            : log.skill_badge === "opendata-openchart"
                            ? "bg-teal-500/10 text-teal-400 border-teal-500/40"
                            : log.skill_badge === "useful-ai-prompts"
                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/40"
                            : log.skill_badge === "image-reviewer"
                            ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/40 shadow-sm"
                            : log.skill_badge === "elon-musk"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-sm"
                            : log.skill_badge === "book-designer"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/40"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        <Sparkles className="w-2.5 h-2.5" /> [{log.skill_badge}]
                      </span>
                    )}

                    <span className="text-[9px] font-mono text-slate-600">
                      Trace: {log.trace_id.substring(0, 16)}...
                    </span>
                  </div>

                  <p className="text-slate-200 font-medium">{log.message}</p>
                </div>

                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 shrink-0">
                  {log.tokens > 0 && <span>{log.tokens.toLocaleString()} tokens</span>}
                  {log.cost_usd > 0 && (
                    <span className="text-emerald-400 font-semibold">
                      ${log.cost_usd.toFixed(5)}
                    </span>
                  )}
                  {log.latency_ms > 0 && <span>{log.latency_ms}ms</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
