"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Layers,
  Activity,
  Cpu,
  Database,
  Feather,
  ArrowRight,
  PlusCircle,
  FileCheck,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { BookRecord } from "@/lib/db/schema";
import { SystemConfig } from "@/lib/config";
import NewBookModal from "@/components/NewBookModal";

export default function HomePage() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((d) => d.success && setConfig(d.data));

    fetch("/api/books")
      .then((res) => res.json())
      .then((d) => d.success && setBooks(d.data));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/60 p-8 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Ecossistema Google Antigravity
          </div>

          <h1 className="text-3xl font-bold text-slate-100 font-cinzel">
            Sistema Autônomo de RAG & Coautoria de Livros
          </h1>

          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Esteira autônoma de produção editorial com ingestão de PDF, fatiamento semântico regido pelo plugin local <code className="text-emerald-400 font-mono">ai-rag</code>, orquestração descentralizada de subagentes em Grafo DAG e compilação de PDFs editoriais de 90 a 200 páginas.
          </p>

          <div className="pt-2 flex items-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar Novo Livro (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Business Configuration Parameters (Strict single source of truth) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Parâmetros Estritos de Negócio (`config/system.json`)
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">
            Fonte Única de Verdade
          </span>
        </div>

        {config && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Autor Principal
              </span>
              <p className="text-xs font-bold text-slate-200 line-clamp-1">
                {config.AUTHOR_NAME}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Público-Alvo
              </span>
              <p className="text-xs font-semibold text-slate-300 line-clamp-1">
                {config.TARGET_AUDIENCE}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Tom de Voz
              </span>
              <p className="text-xs font-semibold text-emerald-400 line-clamp-1">
                {config.TONE_OF_VOICE}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Meta de Páginas & Formato
              </span>
              <p className="text-xs font-bold text-indigo-400">
                {config.MIN_PAGES} a {config.MAX_PAGES} pgs · {config.DEFAULT_PAGE_SIZE || "A5"} · {config.DESIGN_TYPOGRAPHY}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Production Pipeline Flow */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Esteira de Produção Autônoma (Sem intervenção manual)
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
          {[
            { step: "1", title: "Ingestão PDF", sub: "Extração limpa" },
            { step: "2", title: "Chunking", sub: "ai-rag plugin" },
            { step: "3", title: "Vetorização", sub: "ChromaDB" },
            { step: "4", title: "CEO Orchestrator", sub: "Plano DAG" },
            { step: "5", title: "Subagentes", sub: "Capítulos paralelos" },
            { step: "6", title: "Designer", sub: "Tipografia & Layout" },
            { step: "7", title: "Compilador PDF & EPUB", sub: "Download dual final" },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col justify-center items-center relative group hover:border-emerald-500/40 transition"
            >
              <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold text-[10px] flex items-center justify-center mb-1">
                {item.step}
              </span>
              <span className="font-semibold text-slate-200 text-[11px]">
                {item.title}
              </span>
              <span className="text-[10px] text-slate-500">{item.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Books List Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Livros e Projetos Ativos ({books.length})
          </h2>
        </div>

        {books.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
            <BookOpen className="w-12 h-12 mx-auto text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-300">
              Nenhum livro em processamento
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Clique no botão abaixo para anexar seu primeiro PDF e iniciar a esteira autônoma de coautoria.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Iniciar Primeiro Livro
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {book.status}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 font-mono">
                      {book.progress_percent}%
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 line-clamp-2">
                    {book.title}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                    {book.current_step}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-slate-500 font-mono">
                    ${book.total_cost_usd.toFixed(4)} USD
                  </div>

                  <Link
                    href={`/books/${book.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    Ver Projeto <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewBookModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(b) => (window.location.href = `/books/${b.id}`)}
      />
    </div>
  );
}
