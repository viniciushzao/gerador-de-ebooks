"use client";

import React, { useState } from "react";
import { Upload, X, FileUp, Sparkles, Check, AlertCircle, FileText, Trash2 } from "lucide-react";
import { BookRecord } from "@/lib/db/schema";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (book: BookRecord) => void;
}

export default function NewBookModal({ isOpen, onClose, onCreated }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [typography, setTypography] = useState("Garamond");
  const [pageSize, setPageSize] = useState("A5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setError(null);
    const added = Array.from(newFiles);
    const combined = [...files, ...added];

    if (combined.length > 5) {
      setError("Você pode selecionar no máximo 5 arquivos por livro.");
      setFiles(combined.slice(0, 5));
    } else {
      setFiles(combined);
    }

    if (!title && added.length > 0) {
      const derived = added[0].name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ");
      setTitle(derived);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Por favor, insira o título do livro. O preenchimento do título é obrigatório.");
      return;
    }
    if (files.length === 0) {
      setError("Por favor, selecione pelo menos 1 arquivo (PDF, DOCX, TXT ou MD).");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("title", title.trim());
    formData.append("typography", typography);
    formData.append("pageSize", pageSize);

    try {
      const res = await fetch("/api/books", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Erro ao criar projeto.");
      }
      onCreated(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Falha ao enviar arquivos.");
    } finally {
      setLoading(false);
    }
  };

  const totalSizeMb = (
    files.reduce((acc, f) => acc + f.size, 0) /
    (1024 * 1024)
  ).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f172a] border border-slate-750 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <FileUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Novo Livro & Ingestão Multi-Arquivo
            </h2>
            <p className="text-xs text-slate-400">
              Envie até 5 arquivos (PDF, DOCX, TXT, MD) com deduplicação CAS
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Drag and Drop */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Arquivos de Entrada (1 a 5 fontes)</span>
              <span className="text-emerald-400 font-mono text-[11px]">
                {files.length}/5 selecionados ({totalSizeMb} MB)
              </span>
            </label>

            {files.length < 5 && (
              <div className="relative border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-5 text-center bg-slate-900/50 transition cursor-pointer mb-2">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => handleFileChange(e.target.files)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-7 h-7 mx-auto mb-1.5 text-slate-500" />
                <p className="text-xs text-slate-300 font-medium">
                  Clique ou arraste até 5 arquivos aqui
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Suporta .pdf, .docx, .txt e .md com deduplicação instantânea
                </p>
              </div>
            )}

            {/* Selected Files List */}
            {files.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {files.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        ({(f.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Título do Livro</span>
              <span className="text-emerald-400 font-bold">* Obrigatório</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Princípios de Liderança Estratégica"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Page Size / Book Format Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Formato do Livro (Tamanho da Folha)</span>
              <span className="text-slate-500 font-normal">Padrões Editoriais</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: "A5",
                  title: "A5 (148 × 210 mm)",
                  desc: "Padrão Editorial / Não-Ficção",
                  badge: "Recomendado",
                },
                {
                  id: "TRADE",
                  title: "Trade 6\" × 9\" (152 × 229 mm)",
                  desc: "Padrão Global / Amazon KDP",
                  badge: "Comercial",
                },
                {
                  id: "DIGEST",
                  title: "Digest 5.5\" × 8.5\" (140 × 216 mm)",
                  desc: "Romance & Desenvolvimento",
                  badge: "Compacto",
                },
                {
                  id: "A4",
                  title: "A4 (210 × 297 mm)",
                  desc: "Manual Técnico / Apostila",
                  badge: "Expandido",
                },
              ].map((fmt) => (
                <button
                  type="button"
                  key={fmt.id}
                  onClick={() => setPageSize(fmt.id)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer flex flex-col justify-between ${
                    pageSize === fmt.id
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30"
                      : "bg-slate-900 border-slate-750 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-slate-200 text-[11px]">{fmt.title}</span>
                    {pageSize === fmt.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">
                        {fmt.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 line-clamp-1">{fmt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Typography Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Tipografia de Diagramação
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Garamond", sample: "Garamond (Clássico)" },
                { name: "Baskerville", sample: "Baskerville (Elegante)" },
                { name: "Palatino Linotype", sample: "Palatino (Moderno)" },
                { name: "Georgia", sample: "Georgia (Robusto)" },
              ].map((typo) => (
                <button
                  type="button"
                  key={typo.name}
                  onClick={() => setTypography(typo.name)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer flex items-center justify-between ${
                    typography === typo.name
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                      : "bg-slate-900 border-slate-750 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span className="font-serif">{typo.sample}</span>
                  {typography === typo.name && (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || files.length === 0 || !title.trim()}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 transition flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>Processando...</>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Criar e Iniciar RAG ({files.length} fontes)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
