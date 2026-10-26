"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  PlusCircle,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  FileText,
  RefreshCw,
} from "lucide-react";
import { BookRecord } from "@/lib/db/schema";
import NewBookModal from "./NewBookModal";

export default function Sidebar() {
  const pathname = usePathname();
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchBooks = async () => {
    try {
      const res = await fetch("/api/books");
      const json = await res.json();
      if (json.success) {
        setBooks(json.data);
      }
    } catch (e) {
      console.error("Erro ao carregar livros:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    const interval = setInterval(fetchBooks, 4000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: BookRecord["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
            <AlertCircle className="w-3 h-3" /> Erro
          </span>
        );
      case "pending":
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 font-medium">
            <Clock className="w-3 h-3" /> Pendente
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Em esteira
          </span>
        );
    }
  };

  return (
    <>
      <aside className="w-72 bg-[#0c121e] border-r border-slate-800/80 flex flex-col h-screen select-none">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-900/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-cinzel text-sm font-bold tracking-wider text-slate-100 uppercase">
                Antigravity RAG
              </h1>
              <p className="text-[10px] text-emerald-400/80 font-medium tracking-wide">
                Coautoria Autônoma
              </p>
            </div>
          </Link>
        </div>

        {/* New Book Action Button */}
        <div className="p-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Livro / Ingestão PDF
          </button>
        </div>

        {/* Workspaces / Books Section */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            <span>Projetos & Livros ({books.length})</span>
          </div>

          {loading ? (
            <div className="p-4 text-center text-xs text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-slate-400" />
              Carregando projetos...
            </div>
          ) : books.length === 0 ? (
            <div className="p-4 text-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 text-slate-500 text-xs">
              <BookOpen className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              Nenhum livro cadastrado. Clique no botão acima para adicionar um PDF.
            </div>
          ) : (
            books.map((book) => {
              const isActive = pathname.startsWith(`/books/${book.id}`);
              return (
                <div
                  key={book.id}
                  className={`group rounded-lg p-2.5 transition-all border ${
                    isActive
                      ? "bg-slate-800/80 border-emerald-500/40 shadow-sm"
                      : "bg-slate-900/40 border-transparent hover:bg-slate-800/50 hover:border-slate-750"
                  }`}
                >
                  <Link href={`/books/${book.id}`} className="block">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h3
                        className={`text-xs font-semibold line-clamp-1 ${
                          isActive ? "text-emerald-400" : "text-slate-200 group-hover:text-white"
                        }`}
                      >
                        {book.title}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {getStatusBadge(book.status)}
                      <span className="text-[10px] text-slate-500">
                        {book.progress_percent}%
                      </span>
                    </div>
                  </Link>

                  {/* Submenu for active book */}
                  {isActive && (
                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center gap-1">
                      <Link
                        href={`/books/${book.id}`}
                        className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[10px] font-medium transition-colors ${
                          pathname === `/books/${book.id}`
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        }`}
                      >
                        <Layers className="w-3 h-3" /> Painel
                      </Link>
                      <Link
                        href={`/books/${book.id}/audit`}
                        className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[10px] font-medium transition-colors ${
                          pathname.includes("/audit")
                            ? "bg-indigo-500/20 text-indigo-300"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        }`}
                      >
                        <Activity className="w-3 h-3" /> Auditoria
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0a0f19] text-[11px] text-slate-400 space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span>Modelo Cognitivo:</span>
            <span className="text-emerald-400 font-mono font-semibold">Gemini 3.7 Flash</span>
          </div>
          <div className="flex justify-between items-center text-slate-500">
            <span>Plugin RAG:</span>
            <span className="text-indigo-400 font-mono font-semibold">ai-rag local</span>
          </div>
        </div>
      </aside>

      {/* Modal to Upload PDF */}
      <NewBookModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(newBook) => {
          fetchBooks();
          window.location.href = `/books/${newBook.id}`;
        }}
      />
    </>
  );
}
