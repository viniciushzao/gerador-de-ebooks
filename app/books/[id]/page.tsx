"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import {
  Play,
  Download,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  BookOpen,
  FileText,
  Layers,
  ChevronRight,
  RefreshCw,
  Eye,
  Check,
  Terminal,
  Search,
  Copy,
  ArrowDown,
  Filter,
  Code2,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Save,
  Tag,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { BookRecord, ChapterRecord, TaskRecord, AuditLogRecord } from "@/lib/db/schema";
import { ALLOWED_CATEGORIES } from "@/lib/constants/categories";
import { calculateCoverDimensions, calculateWraparoundCoverDimensions } from "@/lib/export/page-formats";

// Limites calibrados com a escala 6x do Pipeline Watchdog
const STAGE_LIMITS_SEC: Record<string, { name: string; limit: number }> = {
  ingesting: { name: "Ingestão e Deduplicação CAS", limit: 90 },
  vectorized: { name: "Indexação Vetorial RAG", limit: 540 },
  outlining: { name: "Planejamento CEO & Apresentação", limit: 420 },
  writing: { name: "Redação Concorrente dos Capítulos", limit: 480 },
  formatting: { name: "Diagramação & Revisão Editorial", limit: 480 },
  compiling: { name: "Compilação Física do PDF & EPUB", limit: 330 },
};

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [book, setBook] = useState<BookRecord | null>(null);
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "manuscript" | "chapters" | "publishing">("overview");
  const [selectedChapter, setSelectedChapter] = useState<ChapterRecord | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [stepElapsedSec, setStepElapsedSec] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [streamTrigger, setStreamTrigger] = useState(0);
  const [logFilterRole, setLogFilterRole] = useState<string>("ALL");
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");
  const [autoScrollLogs, setAutoScrollLogs] = useState<boolean>(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const logTerminalRef = useRef<HTMLDivElement | null>(null);
  const miniTerminalRef = useRef<HTMLDivElement | null>(null);

  // Snapshot dos dados da esteira guardados para comparação independente de 10 segundos
  const lastKnownStatusRef = useRef<{
    status: string;
    progress_percent: number;
    current_step: string;
    actual_pages: number | null;
    pdf_path: string | null;
    epub_path: string | null;
    updated_at: string;
    completed_chapters_count: number;
  } | null>(null);

  // Estados dos 4 campos de Divulgação e Publicação
  const [coverPrompt, setCoverPrompt] = useState<string>("");
  const [suggestedCategories, setSuggestedCategories] = useState<string>("");
  const [marketingDescription, setMarketingDescription] = useState<string>("");
  const [seoKeywords, setSeoKeywords] = useState<string>("");
  const [isGeneratingPublishing, setIsGeneratingPublishing] = useState<boolean>(false);
  const [isSavingPublishing, setIsSavingPublishing] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Estados de Capa Oficial KDP (300 DPI) e Prompt Visual Limpo
  const [coverVisualPrompt, setCoverVisualPrompt] = useState<string>("");
  const [coverNegativePrompt, setCoverNegativePrompt] = useState<string>("");
  const [coverFormatTab, setCoverFormatTab] = useState<"visual" | "negative" | "json" | "technical">("visual");
  const [coverStatus, setCoverStatus] = useState<{
    has_cover: boolean;
    png_exists: boolean;
    pdf_exists: boolean;
    cover_image_url: string | null;
    cover_pdf_url: string | null;
    dimensions?: any;
  } | null>(null);
  const [isCompilingCover, setIsCompilingCover] = useState<boolean>(false);
  const [isUploadingCover, setIsUploadingCover] = useState<boolean>(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [coverSuccessMessage, setCoverSuccessMessage] = useState<string | null>(null);
  const [coverVersion, setCoverVersion] = useState<number>(Date.now());
  const [customCoverPages, setCustomCoverPages] = useState<number | "">("");
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Anti-regression & reference-preserving book state updater
  const applyBookUpdate = (newBook: BookRecord) => {
    setBook((prev) => {
      if (!prev) return newBook;

      // Completed status is terminal unless explicitly restarting or stopped
      const isCurrentlyCompleted = prev.status === "completed";
      const status =
        isCurrentlyCompleted && newBook.status !== "pending" && newBook.status !== "ingesting" && newBook.status !== "failed"
          ? "completed"
          : newBook.status;

      // Progress percent is monotonic during active run, but drops to 0 when failed or pending
      let progress_percent = newBook.progress_percent;
      if (status === "completed") {
        progress_percent = 100;
      } else if (status === "failed") {
        progress_percent = newBook.progress_percent ?? 0;
      } else if (newBook.status !== "pending") {
        progress_percent = Math.max(prev.progress_percent || 0, newBook.progress_percent || 0);
      }

      // Check for stale snapshot via updated_at
      const prevTime = prev.updated_at ? new Date(prev.updated_at).getTime() : 0;
      const newTime = newBook.updated_at ? new Date(newBook.updated_at).getTime() : 0;
      const isStale = newTime > 0 && prevTime > 0 && newTime < prevTime;

      const current_step = isStale && prev.status === status ? prev.current_step : newBook.current_step;
      const pdf_path = newBook.pdf_path || prev.pdf_path;
      const epub_path = newBook.epub_path || prev.epub_path;
      const actual_pages = newBook.actual_pages ?? prev.actual_pages ?? null;
      const total_tokens = Math.max(prev.total_tokens || 0, newBook.total_tokens || 0);
      const total_cost_usd = Math.max(prev.total_cost_usd || 0, newBook.total_cost_usd || 0);
      const cover_prompt = newBook.cover_prompt !== undefined ? newBook.cover_prompt : prev.cover_prompt;
      const cover_visual_prompt = newBook.cover_visual_prompt !== undefined ? newBook.cover_visual_prompt : prev.cover_visual_prompt;
      const cover_negative_prompt = newBook.cover_negative_prompt !== undefined ? newBook.cover_negative_prompt : prev.cover_negative_prompt;
      const cover_image_path = newBook.cover_image_path !== undefined ? newBook.cover_image_path : prev.cover_image_path;
      const cover_pdf_path = newBook.cover_pdf_path !== undefined ? newBook.cover_pdf_path : prev.cover_pdf_path;
      const suggested_categories = newBook.suggested_categories !== undefined ? newBook.suggested_categories : prev.suggested_categories;
      const marketing_description = newBook.marketing_description !== undefined ? newBook.marketing_description : prev.marketing_description;
      const seo_keywords = newBook.seo_keywords !== undefined ? newBook.seo_keywords : prev.seo_keywords;

      // Reference preservation: skip re-rendering if all fields are identical
      if (
        prev.status === status &&
        prev.progress_percent === progress_percent &&
        prev.current_step === current_step &&
        prev.pdf_path === pdf_path &&
        prev.epub_path === epub_path &&
        prev.actual_pages === actual_pages &&
        prev.total_tokens === total_tokens &&
        prev.total_cost_usd === total_cost_usd &&
        prev.title === newBook.title &&
        prev.executive_summary === newBook.executive_summary &&
        prev.cover_prompt === cover_prompt &&
        prev.cover_visual_prompt === cover_visual_prompt &&
        prev.cover_negative_prompt === cover_negative_prompt &&
        prev.cover_image_path === cover_image_path &&
        prev.cover_pdf_path === cover_pdf_path &&
        prev.suggested_categories === suggested_categories &&
        prev.marketing_description === marketing_description &&
        prev.seo_keywords === seo_keywords
      ) {
        return prev;
      }

      // Sincroniza a snapshot de referência para o temporizador independente de 10s
      lastKnownStatusRef.current = {
        status,
        progress_percent,
        current_step,
        actual_pages: actual_pages ?? null,
        pdf_path: pdf_path ?? null,
        epub_path: epub_path ?? null,
        updated_at: newBook.updated_at || prev.updated_at || new Date().toISOString(),
        completed_chapters_count: lastKnownStatusRef.current?.completed_chapters_count ?? 0,
      };

      return {
        ...newBook,
        status,
        progress_percent,
        current_step,
        pdf_path,
        epub_path,
        actual_pages,
        total_tokens,
        total_cost_usd,
        cover_prompt,
        cover_visual_prompt,
        cover_negative_prompt,
        cover_image_path,
        cover_pdf_path,
        suggested_categories,
        marketing_description,
        seo_keywords,
      };
    });
  };

  // Anti-regression & reference-preserving chapters updater
  const applyChaptersUpdate = (newChapters: ChapterRecord[]) => {
    setChapters((prev) => {
      if (!newChapters || newChapters.length === 0) return prev;
      if (prev.length === 0) return newChapters;

      let hasDifferences = false;
      const prevMap = new Map(prev.map((c) => [c.id, c]));

      const merged = newChapters.map((nc) => {
        const pc = prevMap.get(nc.id);
        if (!pc) {
          hasDifferences = true;
          return nc;
        }

        // Anti-regression: a chapter once completed never reverts to pending/running
        let status = nc.status;
        let actual_words = nc.actual_words;
        let content_markdown = nc.content_markdown;

        if (pc.status === "completed" && nc.status !== "completed") {
          status = "completed";
          actual_words = Math.max(pc.actual_words || 0, nc.actual_words || 0);
          content_markdown = pc.content_markdown || nc.content_markdown;
        }

        if (
          pc.status === status &&
          pc.actual_words === actual_words &&
          pc.content_markdown === content_markdown &&
          pc.title === nc.title &&
          pc.error_message === nc.error_message
        ) {
          return pc;
        }

        hasDifferences = true;
        return {
          ...nc,
          status,
          actual_words,
          content_markdown,
        };
      });

      if (!hasDifferences && merged.length === prev.length) {
        return prev;
      }
      return merged;
    });
  };

  // Reference-preserving tasks updater
  const applyTasksUpdate = (newTasks: TaskRecord[]) => {
    setTasks((prev) => {
      if (!newTasks || newTasks.length === 0) return prev;
      if (prev.length === 0) return newTasks;

      if (prev.length === newTasks.length) {
        const isIdentical = prev.every((pt, idx) => {
          const nt = newTasks[idx];
          return (
            nt &&
            pt.id === nt.id &&
            pt.status === nt.status &&
            pt.error === nt.error &&
            pt.finished_at === nt.finished_at &&
            pt.tokens_in === nt.tokens_in &&
            pt.tokens_out === nt.tokens_out &&
            pt.cost_usd === nt.cost_usd
          );
        });
        if (isIdentical) return prev;
      }
      return newTasks;
    });
  };

  // Reference-preserving logs updater
  const applyLogsUpdate = (newLogs: AuditLogRecord[]) => {
    setLogs((prev) => {
      if (!newLogs || newLogs.length === 0) return prev;
      if (prev.length === 0) return newLogs;
      if (newLogs.length < prev.length) return prev; // stale snapshot
      if (newLogs.length === prev.length) {
        if (prev[prev.length - 1]?.id === newLogs[newLogs.length - 1]?.id) {
          return prev;
        }
      }
      return newLogs;
    });
  };

  const appendLog = (newLog: AuditLogRecord) => {
    setLogs((prev) => {
      if (prev.some((l) => l.id === newLog.id)) return prev;
      return [...prev, newLog];
    });
  };

  // Setup SSE stream + REST fallback polling (strictly on SSE disconnect/error)
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;
    let pollTimer: NodeJS.Timeout | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const stopAll = () => {
      stopPolling();
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    const startFallbackPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        if (!isMounted) return;
        fetchFreshData();
      }, 4000);
    };

    // 1. REST fetch
    const fetchFreshData = async () => {
      try {
        const res = await fetch(`/api/books/${id}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data && isMounted) {
          applyBookUpdate(json.data.book);
          if (json.data.chapters) applyChaptersUpdate(json.data.chapters);
          if (json.data.tasks) applyTasksUpdate(json.data.tasks);
          if (json.data.auditLogs) applyLogsUpdate(json.data.auditLogs);
          if (json.data.book.status === "completed" || json.data.book.status === "failed") {
            setIsStarting(false);
            stopAll();
          }
        }
      } catch (e) {
        console.warn("Polling REST fallback falhou:", e);
      }
    };

    // 2. Setup SSE Stream
    const connectSSE = () => {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(`/api/books/${id}/stream`);

      eventSource.onopen = () => {
        // SSE is active: disable fallback REST polling immediately
        stopPolling();
      };

      eventSource.onmessage = (event) => {
        try {
          stopPolling();

          const data = JSON.parse(event.data);
          if (data.book && isMounted) {
            applyBookUpdate(data.book);
            if (data.book.status === "completed" || data.book.status === "failed") {
              setIsStarting(false);
              stopAll();
              return;
            }
          }
          if (data.chapters && isMounted) applyChaptersUpdate(data.chapters);
          if (data.tasks && isMounted) applyTasksUpdate(data.tasks);
          if (data.auditLogs && isMounted) {
            applyLogsUpdate(data.auditLogs);
          } else if (data.type === "log" && data.log && isMounted) {
            appendLog(data.log);
          }
        } catch (e) {
          console.error("Erro ao decodificar SSE:", e);
        }
      };

      eventSource.onerror = () => {
        // SSE disconnected or failed: trigger immediate fetch and start fallback polling
        if (isMounted) {
          fetchFreshData();
          startFallbackPolling();
        }
      };
    };

    // Initial fetch then establish SSE if not already completed/failed
    fetchFreshData().then(() => {
      if (!isMounted) return;
      setBook((current) => {
        if (current?.status === "completed" || current?.status === "failed") {
          stopAll();
        } else {
          connectSSE();
        }
        return current;
      });
    });

    return () => {
      isMounted = false;
      stopAll();
    };
  }, [id, streamTrigger]);

  // Temporizador Independente de Monitoramento da Esteira (Watchdog autônomo a cada 10 segundos)
  useEffect(() => {
    let isMounted = true;

    const checkAndSyncStatus = async () => {
      if (!isMounted) return;
      try {
        const res = await fetch(`/api/books/${id}?_poll=${Date.now()}`, {
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!json.success || !json.data || !json.data.book || !isMounted) return;

        const serverBook: BookRecord = json.data.book;
        const serverChapters: ChapterRecord[] = json.data.chapters || [];
        const completedCount = serverChapters.filter((c) => c.status === "completed").length;

        const saved = lastKnownStatusRef.current;
        const isCompletedPendingSync =
          serverBook.status === "completed" && (!book || book.status !== "completed");
        const isDifferent =
          isCompletedPendingSync ||
          !saved ||
          saved.status !== serverBook.status ||
          saved.progress_percent !== serverBook.progress_percent ||
          saved.current_step !== serverBook.current_step ||
          saved.actual_pages !== (serverBook.actual_pages ?? null) ||
          saved.pdf_path !== (serverBook.pdf_path ?? null) ||
          saved.epub_path !== (serverBook.epub_path ?? null) ||
          saved.updated_at !== serverBook.updated_at ||
          saved.completed_chapters_count !== completedCount;

        // Se os dados forem iguais: nada acontece (sem re-renders supérfluos)
        // Se os dados forem diferentes: atualiza a página para o status atual
        if (isDifferent) {
          lastKnownStatusRef.current = {
            status: serverBook.status,
            progress_percent: serverBook.progress_percent,
            current_step: serverBook.current_step,
            actual_pages: serverBook.actual_pages ?? null,
            pdf_path: serverBook.pdf_path ?? null,
            epub_path: serverBook.epub_path ?? null,
            updated_at: serverBook.updated_at || new Date().toISOString(),
            completed_chapters_count: completedCount,
          };

          applyBookUpdate(serverBook);
          if (json.data.chapters) applyChaptersUpdate(json.data.chapters);
          if (json.data.tasks) applyTasksUpdate(json.data.tasks);
          if (json.data.auditLogs) applyLogsUpdate(json.data.auditLogs);

          if (serverBook.status === "completed" || serverBook.status === "failed") {
            setIsStarting(false);
            setIsStopping(false);
          }
        }
      } catch (err) {
        console.warn("[Temporizador Independente 10s] Erro ao sincronizar status:", err);
      }
    };

    // Executa verificação autônoma a cada 10 segundos
    const intervalId = setInterval(checkAndSyncStatus, 10_000);

    // Reativa checagem imediata quando a aba recupera o foco ou visibilidade
    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        checkAndSyncStatus();
      }
    };

    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
    };
  }, [id]);

  const startPipeline = async () => {
    if (isStarting || (book && book.status !== "pending" && book.status !== "failed")) return;
    
    // Reseta snapshot guardada para forçar que o temporizador detecte a esteira reiniciada
    lastKnownStatusRef.current = null;
    setIsStarting(true);
    // Atualização otimista imediata para travar os botões sem delay de rede
    setBook((prev) =>
      prev
        ? {
            ...prev,
            status: "ingesting",
            current_step: "Iniciando esteira autônoma de produção...",
            progress_percent: 5,
          }
        : prev
    );

    try {
      const res = await fetch(`/api/books/${id}/start`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        alert(`Erro ao iniciar: ${json.error}`);
        setBook((prev) => (prev ? { ...prev, status: "pending" } : prev));
      } else {
        setStreamTrigger((v) => v + 1);
      }
    } catch (e: any) {
      alert(`Falha na requisição: ${e.message || e}`);
      setBook((prev) => (prev ? { ...prev, status: "pending" } : prev));
    } finally {
      setIsStarting(false);
    }
  };

  const stopPipeline = async () => {
    if (!confirm("Deseja realmente forçar a parada imediata desta esteira?")) return;
    setIsStopping(true);
    setIsStarting(false);
    // Atualização otimista imediata para parar animações na tela e zerar progresso
    setBook((prev) =>
      prev
        ? {
            ...prev,
            status: "failed",
            current_step: "Esteira cancelada manualmente pelo usuário (Force Stop)",
            progress_percent: 0,
          }
        : prev
    );

    try {
      const res = await fetch(`/api/books/${id}/stop`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        alert(`Erro ao interromper esteira: ${json.error}`);
      }
    } catch (e: any) {
      alert(`Falha na requisição de parada forçada: ${e.message || e}`);
    } finally {
      setIsStopping(false);
      setIsStarting(false);
    }
  };

  // Garante que isStarting nunca fique preso se o livro não estiver pendente
  useEffect(() => {
    if (book && book.status !== "pending") {
      setIsStarting(false);
    }
  }, [book?.status]);

  // Monitor de tempo decorrido no estágio atual (reseta apenas na mudança de status do estágio)
  useEffect(() => {
    setStepElapsedSec(0);
  }, [book?.status]);

  useEffect(() => {
    if (!book) return;
    const running =
      book.status !== "pending" &&
      book.status !== "completed" &&
      book.status !== "failed";

    if (!running) {
      setStepElapsedSec(0);
      return;
    }

    const timer = setInterval(() => {
      setStepElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [book?.status]);

  // Auto-scroll do terminal quando novos logs chegam
  useEffect(() => {
    if (autoScrollLogs) {
      if (logTerminalRef.current) {
        logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
      }
      if (miniTerminalRef.current) {
        miniTerminalRef.current.scrollTop = miniTerminalRef.current.scrollHeight;
      }
    }
  }, [logs, autoScrollLogs]);

  // Sincronização inicial e reativa dos metadados de publicação
  useEffect(() => {
    if (book) {
      if (book.actual_pages && customCoverPages === "") {
        setCustomCoverPages(book.actual_pages);
      }
      if (book.cover_prompt) setCoverPrompt(book.cover_prompt);
      if (book.cover_visual_prompt) setCoverVisualPrompt(book.cover_visual_prompt);
      if (book.cover_negative_prompt) setCoverNegativePrompt(book.cover_negative_prompt);
      if (book.suggested_categories) setSuggestedCategories(book.suggested_categories);
      if (book.marketing_description) setMarketingDescription(book.marketing_description);
      if (book.seo_keywords) setSeoKeywords(book.seo_keywords);
    }
  }, [book?.actual_pages, book?.cover_prompt, book?.cover_visual_prompt, book?.cover_negative_prompt, book?.suggested_categories, book?.marketing_description, book?.seo_keywords]);

  const fetchCoverStatus = async (overridePages?: number) => {
    if (!id) return;
    try {
      const pagesToUse =
        overridePages ??
        (typeof customCoverPages === "number" && customCoverPages > 0
          ? customCoverPages
          : book?.actual_pages || 162);
      const res = await fetch(`/api/books/${id}/cover-compiler?pages=${pagesToUse}`);
      const json = await res.json();
      if (json.success && json.data) {
        setCoverStatus(json.data);
      }
    } catch (e) {
      console.warn("Erro ao buscar status da capa:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "publishing") {
      fetchCoverStatus();
    }
  }, [activeTab, id]);

  const handleGenerateNativeCover = async () => {
    if (!id) return;
    setIsCompilingCover(true);
    setCoverUploadError(null);
    setCoverSuccessMessage(null);
    try {
      const pagesToSend =
        typeof customCoverPages === "number" && customCoverPages > 0
          ? customCoverPages
          : book?.actual_pages || 162;
      const res = await fetch(`/api/books/${id}/cover-compiler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_native", page_count: pagesToSend }),
      });
      const json = await res.json();
      if (json.success) {
        setCoverSuccessMessage("Capa KDP oficial de alta resolução (300 DPI) compilada com sucesso!");
        setCoverVersion(Date.now());
        await fetchCoverStatus(pagesToSend);
      } else {
        setCoverUploadError(json.error || "Falha ao gerar capa.");
      }
    } catch (err: any) {
      setCoverUploadError(err.message || "Erro na geração da capa.");
    } finally {
      setIsCompilingCover(false);
    }
  };

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploadingCover(true);
    setCoverUploadError(null);
    setCoverSuccessMessage(null);

    try {
      const pagesToSend =
        typeof customCoverPages === "number" && customCoverPages > 0
          ? customCoverPages
          : book?.actual_pages || 162;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("page_count", String(pagesToSend));

      const res = await fetch(`/api/books/${id}/cover-compiler`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        setCoverSuccessMessage("Imagem processada! Auto-crop de bordas/sombras realizado, upscaled para 300 DPI e PDF KDP compilado.");
        setCoverVersion(Date.now());
        await fetchCoverStatus(pagesToSend);
      } else {
        setCoverUploadError(json.error || "Falha ao processar arquivo de capa.");
      }
    } catch (err: any) {
      setCoverUploadError(err.message || "Erro ao fazer upload da capa.");
    } finally {
      setIsUploadingCover(false);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = "";
      }
    }
  };

  const loadOrGeneratePublishing = async (forceRegenerate = false) => {
    if (!id) return;
    setIsGeneratingPublishing(true);
    try {
      const res = await fetch(`/api/books/${id}/publishing`, {
        method: forceRegenerate ? "POST" : "GET",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCoverPrompt(json.data.cover_prompt || "");
        setCoverVisualPrompt(json.data.cover_visual_prompt || "");
        setCoverNegativePrompt(json.data.cover_negative_prompt || "");
        setSuggestedCategories(json.data.suggested_categories || "");
        setMarketingDescription(json.data.marketing_description || "");
        setSeoKeywords(json.data.seo_keywords || "");
        setBook((prev) =>
          prev
            ? {
                ...prev,
                cover_prompt: json.data.cover_prompt,
                cover_visual_prompt: json.data.cover_visual_prompt,
                cover_negative_prompt: json.data.cover_negative_prompt,
                cover_image_path: json.data.cover_image_path,
                cover_pdf_path: json.data.cover_pdf_path,
                suggested_categories: json.data.suggested_categories,
                marketing_description: json.data.marketing_description,
                seo_keywords: json.data.seo_keywords,
              }
            : prev
        );
        await fetchCoverStatus();
      }
    } catch (err) {
      console.error("Erro ao carregar ou gerar metadados de publicação:", err);
    } finally {
      setIsGeneratingPublishing(false);
    }
  };

  const handleSavePublishing = async () => {
    if (!id) return;
    setIsSavingPublishing(true);
    try {
      const res = await fetch(`/api/books/${id}/publishing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cover_prompt: coverPrompt,
          cover_visual_prompt: coverVisualPrompt,
          cover_negative_prompt: coverNegativePrompt,
          suggested_categories: suggestedCategories,
          marketing_description: marketingDescription,
          seo_keywords: seoKeywords,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setBook((prev) =>
          prev
            ? {
                ...prev,
                cover_prompt: coverPrompt,
                cover_visual_prompt: coverVisualPrompt,
                cover_negative_prompt: coverNegativePrompt,
                suggested_categories: suggestedCategories,
                marketing_description: marketingDescription,
                seo_keywords: seoKeywords,
              }
            : prev
        );
      } else {
        alert(`Erro ao salvar: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Falha ao salvar: ${err.message || err}`);
    } finally {
      setIsSavingPublishing(false);
    }
  };

  const handleCopyText = (fieldId: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const toggleCategory = (cat: string) => {
    const current = suggestedCategories
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);
    let updated: string[];
    if (current.some((c) => c.toLowerCase() === cat.toLowerCase())) {
      updated = current.filter((c) => c.toLowerCase() !== cat.toLowerCase());
    } else {
      updated = [...current, cat];
    }
    setSuggestedCategories(updated.join("; "));
  };

  const totalTokens = logs.reduce((acc, l) => acc + (l.tokens || 0), 0);
  const totalCost = logs.reduce((acc, l) => acc + (l.cost_usd || 0), 0);
  const totalLatency = logs.reduce((acc, l) => acc + (l.latency_ms || 0), 0);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "CEO":
        return { label: "CEO ORCHESTRATOR", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" };
      case "PRESENTATION_WRITER":
        return { label: "APRESENTAÇÃO", color: "bg-sky-500/20 text-sky-300 border-sky-500/40" };
      case "WRITER":
        return { label: "ESCRITOR", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
      case "DESIGNER":
        return { label: "DESIGNER", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" };
      case "BOOK_REVIEWER":
        return { label: "REVISOR EDITORIAL", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
      case "IMAGE_REVIEWER":
        return { label: "REVISOR VISUAL", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };
      case "RAG_PROCESSOR":
        return { label: "RAG PROCESSOR", color: "bg-teal-500/20 text-teal-300 border-teal-500/40" };
      case "SYSTEM":
      default:
        return { label: "SISTEMA", color: "bg-slate-800 text-slate-300 border-slate-700" };
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return { label: "ERRO", color: "bg-red-500/25 text-red-300 border-red-500/50" };
      case "warning":
        return { label: "AVISO", color: "bg-amber-500/25 text-amber-300 border-amber-500/50" };
      case "skill_call":
        return { label: "SKILL", color: "bg-cyan-500/25 text-cyan-300 border-cyan-500/50" };
      case "info":
      default:
        return { label: "INFO", color: "bg-slate-800/80 text-slate-400 border-slate-750" };
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilterRole === "CEO" && log.agent_role !== "CEO") return false;
    if (logFilterRole === "PRESENTATION" && log.agent_role !== "PRESENTATION_WRITER") return false;
    if (logFilterRole === "WRITER" && log.agent_role !== "WRITER") return false;
    if (
      logFilterRole === "DESIGNER_REVIEWER" &&
      log.agent_role !== "DESIGNER" &&
      log.agent_role !== "BOOK_REVIEWER" &&
      log.agent_role !== "IMAGE_REVIEWER"
    )
      return false;
    if (logFilterRole === "ERRORS" && log.level !== "error" && log.level !== "warning") return false;
    if (logFilterRole === "SKILLS" && !log.skill_badge) return false;

    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchRole = log.agent_role.toLowerCase().includes(q);
      const matchSkill = log.skill_badge ? log.skill_badge.toLowerCase().includes(q) : false;
      const matchMeta = log.metadata ? log.metadata.toLowerCase().includes(q) : false;
      return matchMsg || matchRole || matchSkill || matchMeta;
    }
    return true;
  });

  const copyLogsToClipboard = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.agent_role}] [${l.level.toUpperCase()}] ${
            l.skill_badge ? `[${l.skill_badge}] ` : ""
          }${l.message}${l.tokens > 0 ? ` (Tokens: ${l.tokens})` : ""}${
            l.cost_usd > 0 ? ` ($${l.cost_usd.toFixed(4)})` : ""
          }${l.latency_ms > 0 ? ` (${l.latency_ms}ms)` : ""}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  if (!book) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-emerald-400" />
        Carregando dados do livro...
      </div>
    );
  }

  const isRunning =
    book.status !== "completed" &&
    book.status !== "failed" &&
    (isStarting || book.status !== "pending");

  const totalWords = chapters.reduce((acc, c) => acc + (c.actual_words || 0), 0);
  const estimatedPages = Math.ceil(totalWords / 250);
  const currentStageInfo = book ? STAGE_LIMITS_SEC[book.status] : null;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Link href="/" className="hover:text-slate-200">
            Livros
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-200 font-semibold">{book.title}</span>
        </div>

        <Link
          href={`/books/${id}/audit`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition font-medium"
        >
          <Activity className="w-3.5 h-3.5" />
          Ver Trilha de Auditoria (Grafo DAG)
        </Link>
      </div>

      {/* Main Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                ID: {book.id}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Formato: {book.page_size || "A5"}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Tipografia: {book.typography} ({book.spacing}x)
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center gap-1" title="Temporizador autônomo monitorando a esteira a cada 10s">
                <Clock className="w-3 h-3 text-teal-400" />
                Monitor 10s Ativo
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 font-cinzel">
              {book.title}
            </h1>
            <p className="text-xs text-slate-400">
              Autor: <strong className="text-slate-200">{book.author_name}</strong> · Tom:{" "}
              <span className="text-emerald-400">{book.tone_of_voice}</span>
            </p>
          </div>

          {/* Action Buttons with Strict Running Lock */}
          <div className="flex items-center gap-3">
            {book.status === "pending" && !isRunning && (
              <button
                onClick={startPipeline}
                disabled={isStarting || isRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/40 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-white" />
                {isStarting ? "Iniciando esteira..." : "Iniciar Esteira Autônoma"}
              </button>
            )}

            {isRunning && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold shadow-inner select-none animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Em execução... ({stepElapsedSec}s)</span>
                </div>
                <button
                  onClick={stopPipeline}
                  disabled={isStopping}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-xs shadow-lg shadow-red-950/40 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Forçar parada imediata da esteira (Force Stop)"
                >
                  <AlertCircle className="w-4 h-4" />
                  {isStopping ? "Parando..." : "Forçar Parada"}
                </button>
              </div>
            )}

            {book.status === "completed" && !isRunning && (
              <div className="flex items-center gap-2">
                <a
                  href={`/api/books/${id}/download?format=pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/40 transition"
                  title="Download do livro em formato PDF editorial com paginação e design fixo"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
                <a
                  href={`/api/books/${id}/download?format=epub`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-950/40 transition"
                  title="Download do livro em formato EPUB 3 reflowable para Kindle, Kobo, Apple Books e leitores digitais"
                >
                  <BookOpen className="w-4 h-4" />
                  Download EPUB
                </a>
              </div>
            )}

            {book.status === "failed" && !isRunning && (
              <button
                onClick={startPipeline}
                disabled={isStarting || isRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-lg transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
            )}
          </div>
        </div>

        {/* Banner de Parada / Falha Confirmada */}
        {book.status === "failed" && (
          <div className="p-4 rounded-xl bg-red-950/40 border-2 border-red-500/50 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-200">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-500/20 border border-red-500/40 shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-red-200 uppercase tracking-wide">
                    Esteira Interrompida
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/25 border border-red-500/50 text-[10px] font-bold text-red-300">
                    PARADA CONFIRMADA
                  </span>
                </div>
                <p className="text-xs text-red-300/90 mt-1 font-mono">
                  {book.current_step || "Operação interrompida pelo usuário via Force Stop."}
                </p>
              </div>
            </div>
            <button
              onClick={startPipeline}
              disabled={isStarting || isRunning}
              className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-xs shadow-lg shadow-red-950/50 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Timeout Warning Alert Banner if step exceeds 2x limit */}
        {isRunning && currentStageInfo && stepElapsedSec >= currentStageInfo.limit && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-300 text-xs animate-pulse">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <span className="font-semibold text-red-200">
                  Alerta de Tempo Limite ({currentStageInfo.name}):
                </span>
                <span className="ml-1 text-red-300/90">
                  A etapa atual atingiu {stepElapsedSec}s (limite de segurança: {currentStageInfo.limit}s — dobro da média histórica). Se o processo estiver travado, use o botão de parada forçada.
                </span>
              </div>
            </div>
            <button
              onClick={stopPipeline}
              disabled={isStopping}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition self-end sm:self-auto cursor-pointer"
            >
              {isStopping ? "Parando..." : "Forçar Parada"}
            </button>
          </div>
        )}

        {/* Live Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-2">
              {isRunning ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              ) : book.status === "failed" ? (
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
              ) : book.status === "completed" ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              )}
              <span className={book.status === "failed" ? "text-red-300 font-medium" : ""}>
                {book.current_step}
              </span>
            </span>
            <span
              className={`font-mono font-bold ${
                book.status === "failed" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {book.progress_percent}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                book.status === "failed"
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-emerald-500 to-teal-400"
              }`}
              style={{ width: `${book.progress_percent}%` }}
            ></div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-center text-xs border-t border-slate-800/80">
          <div className="p-2.5 rounded-lg bg-slate-800/40">
            <span className="text-[10px] text-slate-500 uppercase block">Status</span>
            <span
              className={`font-semibold uppercase font-mono text-[11px] ${
                book.status === "failed" ? "text-red-400 font-bold" : "text-slate-200"
              }`}
            >
              {book.status}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/40">
            <span className="text-[10px] text-slate-500 uppercase block">Capítulos</span>
            <span className="font-semibold text-slate-200 font-mono">
              {chapters.filter((c) => c.status === "completed").length} / {chapters.length}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/40">
            <span className="text-[10px] text-slate-500 uppercase block">
              {book.actual_pages ? "Páginas Reais" : "Páginas Estimadas"}
            </span>
            <span className="font-semibold text-indigo-400 font-mono">
              {book.actual_pages
                ? `${book.actual_pages} páginas (${totalWords.toLocaleString()} palavras)`
                : `~${estimatedPages} páginas (${totalWords.toLocaleString()} palavras)`}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/40">
            <span className="text-[10px] text-slate-500 uppercase block">Tokens Gastos</span>
            <span className="font-semibold text-slate-200 font-mono">
              {Math.max(book.total_tokens || 0, totalTokens).toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/40">
            <span className="text-[10px] text-slate-500 uppercase block">Custo Estimado</span>
            <span className="font-semibold text-emerald-400 font-mono">
              ${Math.max(book.total_cost_usd || 0, totalCost).toFixed(4)} USD
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "overview"
              ? "border-b-2 border-emerald-400 text-emerald-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" /> Visão Geral & Capítulos
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
            activeTab === "logs"
              ? "border-b-2 border-indigo-400 text-indigo-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Terminal de Logs ao Vivo</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              isRunning
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {logs.length}
          </span>
          {isRunning && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("manuscript")}
          className={`pb-3 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "manuscript"
              ? "border-b-2 border-emerald-400 text-emerald-400 font-semibold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Leitor do Manuscrito
        </button>

        <button
          onClick={() => {
            setActiveTab("publishing");
            if (!coverPrompt && !isGeneratingPublishing) {
              loadOrGeneratePublishing(false);
            }
          }}
          className={`pb-3 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "publishing"
              ? "border-b-2 border-indigo-400 text-indigo-400 font-semibold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" /> Divulgação & Capa
        </button>
      </div>

      {/* Tab 1: Overview & Chapters */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Live Mini-Terminal when running or when failed with logs */}
          {(isRunning || (book.status === "failed" && logs.length > 0)) && (
            <div
              className={`p-4 rounded-xl shadow-2xl space-y-3 font-mono ${
                book.status === "failed"
                  ? "bg-red-950/20 border border-red-500/30"
                  : "bg-slate-950/90 border border-indigo-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Terminal
                    className={`w-4 h-4 ${
                      book.status === "failed" ? "text-red-400" : "text-emerald-400 animate-pulse"
                    }`}
                  />
                  <span className="font-bold text-slate-200 uppercase tracking-wider">
                    {book.status === "failed"
                      ? "Console de Execução (Interrompido)"
                      : "Console de Execução em Tempo Real"}
                  </span>
                  {book.status === "failed" ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold border border-red-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      PARADO / CANCELADO ({logs.length} eventos)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      AO VIVO ({logs.length} eventos)
                    </span>
                  )}
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 text-[10px] font-semibold border border-teal-500/20" title="Watchdog independente sincronizando a cada 10s">
                    <Clock className="w-3 h-3 text-teal-400" />
                    WATCHDOG 10S
                  </span>
                </div>

                <button
                  onClick={() => setActiveTab("logs")}
                  className="text-[11px] font-sans font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
                >
                  Expandir Terminal Completo <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                ref={miniTerminalRef}
                className="max-h-52 overflow-y-auto space-y-1.5 p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] leading-relaxed select-text"
              >
                {logs.length === 0 ? (
                  <div className="text-slate-500 italic">Iniciando agentes e aguardando primeiros eventos...</div>
                ) : (
                  logs.slice(-10).map((log) => {
                    const roleInfo = getRoleBadge(log.agent_role);
                    return (
                      <div key={log.id} className="flex items-start gap-2">
                        <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold shrink-0 uppercase ${roleInfo.color}`}
                        >
                          {roleInfo.label}
                        </span>
                        {log.skill_badge && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 shrink-0">
                            [{log.skill_badge}]
                          </span>
                        )}
                        <span
                          className={`break-words ${
                            log.level === "error"
                              ? "text-red-400 font-semibold"
                              : log.level === "warning"
                              ? "text-amber-300"
                              : "text-slate-300"
                          }`}
                        >
                          {log.message}
                        </span>
                      </div>
                    );
                  })
                )}
                {book.status === "failed" ? (
                  <div className="flex items-center gap-2 text-red-400/90 text-[10px] pt-1">
                    <span className="inline-block w-1.5 h-3 bg-red-500"></span>
                    <span>Execução interrompida via Force Stop ou Erro. Nenhuma tarefa em andamento.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-400/80 text-[10px] pt-1">
                    <span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse"></span>
                    <span>Acompanhando execução em tempo real...</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Ingested Sources (Multi-File RAG Corpus) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Fontes & Arquivos Ingeridos (RAG Corpus)
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                {book.source_documents?.length || 1} fonte(s) vinculada(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {book.source_documents && book.source_documents.length > 0 ? (
                book.source_documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-800/40 border border-slate-750 flex flex-col justify-between space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-semibold text-slate-200 text-xs truncate" title={doc.filename}>
                        {doc.filename}
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 flex-shrink-0">
                        {doc.file_type || "pdf"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{(doc.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                      {doc.deduplicated ? (
                        <span className="text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded text-[9px] border border-teal-500/20">
                          Cache CAS (0ms)
                        </span>
                      ) : (
                        <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px]">
                          SQLite WAL
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-750 flex items-center justify-between col-span-full">
                  <span className="text-xs text-slate-300 truncate">{book.original_filename}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">PDF Único</span>
                </div>
              )}
            </div>
          </div>

          {book.executive_summary && (
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Resumo Executivo do Livro (Definido pelo CEO)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {book.executive_summary}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Capítulos em Produção ({chapters.length})
            </h3>

            {chapters.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                Os capítulos serão criados pelo Agente CEO assim que a esteira for iniciada.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-semibold text-emerald-400">
                          CAPÍTULO {ch.chapter_number}
                        </span>
                        <h4 className="text-xs font-bold text-slate-200 mt-0.5">
                          {ch.title}
                        </h4>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          ch.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : ch.status === "running"
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {ch.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {ch.synopsis}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60 font-mono">
                      <span>{ch.actual_words || 0} / ~{ch.target_words} palavras</span>
                      <span>${ch.cost_usd.toFixed(4)} USD</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Real-Time Live Logs Terminal */}
      {activeTab === "logs" && (
        <div className="space-y-4 font-mono">
          {/* Terminal Control Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Terminal de Criação Autônoma
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 ${
                        isRunning
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : book.status === "failed"
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          TRANSMISSÃO AO VIVO
                        </>
                      ) : book.status === "failed" ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          ESTEIRA PARADA / CANCELADA
                        </>
                      ) : (
                        <>HISTÓRICO COMPLETO</>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Transmissão literal em tempo real de cada subagente: CEO, Apresentação, Capítulos, Designer e Revisor
                  </p>
                </div>
              </div>

              {/* Quick Telemetry & Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setAutoScrollLogs(!autoScrollLogs)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    autoScrollLogs
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                      : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                  title="Rolar automaticamente para novos logs que chegarem"
                >
                  <ArrowDown className={`w-3.5 h-3.5 ${autoScrollLogs ? "animate-bounce" : ""}`} />
                  Auto-scroll: {autoScrollLogs ? "Ligado" : "Pausado"}
                </button>

                <button
                  onClick={copyLogsToClipboard}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-sans font-medium flex items-center gap-1.5 transition cursor-pointer"
                  title="Copiar todos os logs em formato texto"
                >
                  {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLogs ? "Copiado!" : "Copiar Logs"}
                </button>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                {[
                  { id: "ALL", label: `Todos (${logs.length})` },
                  { id: "CEO", label: `CEO (${logs.filter((l) => l.agent_role === "CEO").length})` },
                  { id: "PRESENTATION", label: `Apresentação (${logs.filter((l) => l.agent_role === "PRESENTATION_WRITER").length})` },
                  { id: "WRITER", label: `Capítulos (${logs.filter((l) => l.agent_role === "WRITER").length})` },
                  { id: "DESIGNER_REVIEWER", label: "Designer/Revisor" },
                  { id: "ERRORS", label: `Erros & Avisos (${logs.filter((l) => l.level === "error" || l.level === "warning").length})` },
                  { id: "SKILLS", label: `Skills (${logs.filter((l) => !!l.skill_badge).length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setLogFilterRole(f.id)}
                    className={`px-2.5 py-1 rounded-lg transition font-sans cursor-pointer ${
                      logFilterRole === f.id
                        ? "bg-indigo-600 text-white font-semibold shadow"
                        : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-750"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative shrink-0 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Buscar nos logs..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Terminal Output Window */}
          <div className="rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            {/* Terminal Window Titlebar */}
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                </div>
                <span className="ml-2 font-mono text-slate-400 font-medium text-[11px]">
                  live-pipeline-logs://{book.id}
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] font-mono">
                <span>{filteredLogs.length} eventos exibidos</span>
                {totalTokens > 0 && <span className="text-slate-400">{totalTokens.toLocaleString()} tokens</span>}
                {totalCost > 0 && <span className="text-emerald-400 font-semibold">${totalCost.toFixed(5)} USD</span>}
              </div>
            </div>

            {/* Terminal Body */}
            <div
              ref={logTerminalRef}
              className="p-4 max-h-[600px] min-h-[350px] overflow-y-auto space-y-2.5 text-xs select-text"
            >
              {filteredLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  {logSearchQuery ? "Nenhum log encontrado para a busca informada." : "Aguardando primeiros logs da esteira..."}
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const roleInfo = getRoleBadge(log.agent_role);
                  const levelInfo = getLevelBadge(log.level);
                  const isExpanded = expandedLogId === log.id;
                  const hasMeta = log.metadata && log.metadata !== "{}" && log.metadata !== "";

                  return (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition space-y-1.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-500 text-[10px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>

                          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold uppercase ${roleInfo.color}`}>
                            {roleInfo.label}
                          </span>

                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase ${levelInfo.color}`}>
                            {levelInfo.label}
                          </span>

                          {log.skill_badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1 font-semibold">
                              <Sparkles className="w-2.5 h-2.5" /> [{log.skill_badge}]
                            </span>
                          )}

                          <span className="text-[9px] text-slate-600">
                            {log.trace_id.substring(0, 16)}...
                          </span>
                        </div>

                        {/* Telemetry metrics */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                          {log.tokens > 0 && <span>{log.tokens.toLocaleString()} tokens</span>}
                          {log.cost_usd > 0 && (
                            <span className="text-emerald-400 font-semibold">
                              ${log.cost_usd.toFixed(4)}
                            </span>
                          )}
                          {log.latency_ms > 0 && <span>{log.latency_ms}ms</span>}

                          {hasMeta && (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 underline cursor-pointer"
                            >
                              {isExpanded ? (
                                <>Ocultar <ChevronUp className="w-3 h-3" /></>
                              ) : (
                                <>Metadados <ChevronDown className="w-3 h-3" /></>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Log Message */}
                      <p
                        className={`text-xs leading-relaxed ${
                          log.level === "error"
                            ? "text-red-400 font-semibold"
                            : log.level === "warning"
                            ? "text-amber-300 font-medium"
                            : log.level === "skill_call"
                            ? "text-cyan-300"
                            : "text-slate-200"
                        }`}
                      >
                        {log.message}
                      </p>

                      {/* Expandable Metadata Inspector */}
                      {isExpanded && hasMeta && (
                        <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 overflow-x-auto">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                            Metadados do Evento:
                          </span>
                          <pre className="text-slate-400 whitespace-pre-wrap break-all font-mono">
                            {(() => {
                              try {
                                return JSON.stringify(JSON.parse(log.metadata), null, 2);
                              } catch {
                                return log.metadata;
                              }
                            })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Running blinking prompt at bottom */}
              {isRunning && (
                <div className="flex items-center gap-2 text-emerald-400 text-xs py-2 px-1">
                  <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse"></span>
                  <span className="italic">Esteira em execução ativa... aguardando próximo evento dos subagentes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Manuscript Reader */}
      {activeTab === "manuscript" && (
        <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl manuscript-preview font-serif max-w-4xl mx-auto space-y-8">
          <div className="text-center border-b border-slate-800 pb-8 space-y-2">
            <h1 className="text-3xl font-bold text-slate-100">{book.title}</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-sans">
              Por {book.author_name}
            </p>
          </div>

          {book.executive_summary && (
            <div className="space-y-3">
              <h2>Introdução e Síntese Executiva</h2>
              <p>{book.executive_summary}</p>
            </div>
          )}

          {chapters.map((ch) => (
            <div key={ch.id} className="pt-6 border-t border-slate-800 space-y-4">
              <h2>
                Capítulo {ch.chapter_number}: {ch.title}
              </h2>
              {ch.content_markdown ? (
                <div className="text-slate-300 leading-relaxed whitespace-pre-line text-sm">
                  {ch.content_markdown}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Capítulo ainda em redação pelo subagente...
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Publishing, Cover & Marketing Metadata */}
      {activeTab === "publishing" && (
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* Action Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-100">Central de Publicação, Capa e Divulgação</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ativos estratégicos para catalogação comercial, geração de capa e marketing em livrarias e marketplaces digitais.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => loadOrGeneratePublishing(true)}
                disabled={isGeneratingPublishing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-indigo-950/40"
                title="Regenerar todos os campos com IA utilizando o contexto integral do livro"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPublishing ? "animate-spin" : ""}`} />
                {isGeneratingPublishing ? "Gerando com IA..." : "Regenerar com IA"}
              </button>
              <button
                onClick={handleSavePublishing}
                disabled={isSavingPublishing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-emerald-950/40"
                title="Salvar alterações manuais nos campos"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingPublishing ? "Salvando..." : saveSuccess ? "Salvo com sucesso!" : "Salvar Alterações"}
              </button>
            </div>
          </div>

          {/* Card de Conformidade Amazon KDP e Métricas Técnicas da Folha */}
          {(() => {
            const effectivePages =
              typeof customCoverPages === "number" && customCoverPages > 0
                ? customCoverPages
                : book.actual_pages || 162;
            const wrapDims = calculateWraparoundCoverDimensions(book.page_size, effectivePages);
            return (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/30 border border-indigo-500/20 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-100">Conformidade Amazon KDP (Capa Completa em 1 Imagem Só)</h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> 100% Compatível KDP Print
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Spread panorâmico contínuo (Contracapa + Lombada + Capa da Frente) calibrado com 300 DPI e sangria oficial, eliminando o erro de dimensões do KDP.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-300 text-xs font-mono font-bold border border-indigo-500/20">
                      {wrapDims.formatName} • {wrapDims.pageCount} pgs
                    </span>
                  </div>
                </div>

                {/* Seletor / Ajuste Fino de Páginas para o KDP */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-slate-300">Páginas do Miolo (KDP):</span>
                    <input
                      type="number"
                      min={24}
                      max={1000}
                      value={customCoverPages}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                        setCustomCoverPages(val);
                      }}
                      className="w-24 px-3 py-1.5 text-xs font-mono text-center rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                      placeholder="162"
                    />
                    <span className="text-[11px] text-slate-400">
                      (Ajuste caso o preflight do KDP calcule uma contagem de páginas específica)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomCoverPages(162)}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
                    >
                      Padrão KDP 162 pgs (12.615&quot; × 9.250&quot;)
                    </button>
                    {book.actual_pages && (
                      <button
                        type="button"
                        onClick={() => book.actual_pages && setCustomCoverPages(book.actual_pages)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                      >
                        Páginas Reais ({book.actual_pages} pgs)
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid de 4 Métricas Técnicas do Spread */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tamanho Total KDP</div>
                    <div className="text-sm font-bold text-slate-100 mt-1">{wrapDims.totalWidthInches.toFixed(3)}&quot; × {wrapDims.totalHeightInches.toFixed(3)}&quot;</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{wrapDims.totalWidthMm} × {wrapDims.totalHeightMm} mm</div>
                    <div className="text-[10px] text-indigo-400 mt-0.5 font-mono">Gabarito: {wrapDims.kdpDimensionsString}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lombada Central (Spine)</div>
                    <div className="text-sm font-bold text-slate-100 mt-1">{wrapDims.spineWidthInches}&quot; ({wrapDims.spineWidthMm} mm)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Base: {wrapDims.pageCount} páginas</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5 font-mono">{wrapDims.spineTextAllowed ? "Texto vertical ativo" : "Lombada lisa (<80 pgs)"}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Impressão 300 DPI</div>
                    <div className="text-sm font-bold text-emerald-400 mt-1">{wrapDims.totalWidthPx} × {wrapDims.totalHeightPx} px</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Canvas Total (Com Sangria)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Sangria KDP: 0.125&quot; ({wrapDims.bleedPx} px)</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Spread em 1 Imagem</div>
                    <div className="text-sm font-bold text-indigo-300 mt-1">Traseira + Lombada + Frente</div>
                    <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Barcode Box 2.0&quot;×1.2&quot; OK
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Perfil: sRGB / Fundo Branco</div>
                  </div>
                </div>

                {/* Checklist de Conformidade KDP */}
                <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-y-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Tamanho exigido pelo KDP ({wrapDims.kdpDimensionsString}) atendido com exatidão
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Spread contínuo em 1 imagem só (Contracapa + Lombada + Capa Frente)
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sangria gráfica KDP (0.125&quot; / 3.175 mm) aplicada em todas as bordas
                  </div>
                  <div className="flex items-center gap-1.5 text-indigo-300 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Área de Código de Barras (2.0&quot; × 1.2&quot;) preservada na contracapa
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Central de Compilação & Download da Capa KDP Oficial (300 DPI) */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Central de Compilação & Download da Capa KDP (300 DPI)</h3>
                  <p className="text-[11px] text-slate-400">
                    Gere a capa oficial KDP 100% pronta para impressão gráfica a 300 DPI ou envie a imagem gerada pela sua IA para auto-crop de bordas e upscale.
                  </p>
                </div>
              </div>

              {coverStatus?.has_cover && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Capa Pronta para Amazon KDP
                </span>
              )}
            </div>

            {/* Mensagens de Feedback */}
            {coverSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{coverSuccessMessage}</span>
              </div>
            )}
            {coverUploadError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{coverUploadError}</span>
              </div>
            )}

            {/* Ações de Geração e Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGenerateNativeCover}
                disabled={isCompilingCover || isUploadingCover}
                className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-indigo-950/40 transition cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${isCompilingCover ? "animate-spin" : ""}`} />
                <span>
                  {isCompilingCover ? "Compilando Capa a 300 DPI..." : "Gerar Capa Nativa 1-Click (300 DPI Oficial KDP)"}
                </span>
              </button>

              <div>
                <input
                  type="file"
                  ref={coverFileInputRef}
                  onChange={handleCoverFileUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => coverFileInputRef.current?.click()}
                  disabled={isCompilingCover || isUploadingCover}
                  className="w-full flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs transition cursor-pointer"
                >
                  <Upload className={`w-4 h-4 ${isUploadingCover ? "animate-bounce" : ""}`} />
                  <span>
                    {isUploadingCover ? "Processando Imagem da IA..." : "Upload da Imagem da IA (Auto-Crop + Upscale 300 DPI)"}
                  </span>
                </button>
              </div>
            </div>

            {/* Preview da Capa e Botões de Download */}
            {coverStatus?.png_exists && (
              <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <span>Visualização da Capa Compilada a 300 DPI</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`/api/books/${id}/cover-compiler?format=pdf&download=true&pages=${(typeof customCoverPages === "number" && customCoverPages > 0) ? customCoverPages : (book.actual_pages || 162)}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar PDF KDP ({coverStatus.dimensions?.kdpDimensionsString || "12.615\" × 9.250\""})</span>
                    </a>
                    <a
                      href={`/api/books/${id}/cover-compiler?format=png&download=true&pages=${(typeof customCoverPages === "number" && customCoverPages > 0) ? customCoverPages : (book.actual_pages || 162)}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar PNG 300 DPI ({coverStatus.dimensions?.totalWidthPx || 3785} × {coverStatus.dimensions?.totalHeightPx || 2775} px)</span>
                    </a>
                  </div>
                </div>

                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/books/${id}/cover-compiler?format=png&v=${coverVersion}`}
                    alt="Capa KDP Completa 300 DPI"
                    className="max-h-80 w-auto object-contain rounded shadow-lg border border-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Campo 1: Prompts para Geração de Capas com Abas */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">1. Prompts para Geração de Capa (Sem Números & Sem Bordas)</h3>
                  <p className="text-[11px] text-slate-400">
                    Gere no Midjourney, Nano Banana 2, DALL-E ou Imagen 3 usando o prompt em linguagem natural limpo, sem cotas e com negative prompt estrito.
                  </p>
                </div>
              </div>

              {/* Botão de cópia dinâmico para a aba ativa */}
              <button
                onClick={() => {
                  const textToCopy =
                    coverFormatTab === "visual"
                      ? coverVisualPrompt
                      : coverFormatTab === "negative"
                      ? coverNegativePrompt
                      : coverPrompt;
                  handleCopyText("cover_prompt", textToCopy);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700"
              >
                {copiedField === "cover_prompt" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>
                      {coverFormatTab === "visual"
                        ? "Copiar Prompt Visual"
                        : coverFormatTab === "negative"
                        ? "Copiar Negative Prompt"
                        : "Copiar JSON"}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Seletor de Abas de Formato */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setCoverFormatTab("visual")}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  coverFormatTab === "visual"
                    ? "bg-indigo-600 text-white font-semibold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Prompt Visual Limpo (Recomendado para IAs)</span>
              </button>

              <button
                type="button"
                onClick={() => setCoverFormatTab("negative")}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  coverFormatTab === "negative"
                    ? "bg-indigo-600 text-white font-semibold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Negative Prompt Estrito</span>
              </button>

              <button
                type="button"
                onClick={() => setCoverFormatTab("json")}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  coverFormatTab === "json"
                    ? "bg-indigo-600 text-white font-semibold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>JSON Estruturado Nano Banana</span>
              </button>

              <button
                type="button"
                onClick={() => setCoverFormatTab("technical")}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  coverFormatTab === "technical"
                    ? "bg-indigo-600 text-white font-semibold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Gabarito Técnico KDP</span>
              </button>
            </div>

            {/* Conteúdo de acordo com a aba ativa */}
            {coverFormatTab === "visual" && (
              <div className="space-y-2">
                <p className="text-[11px] text-indigo-300/90 bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-500/20">
                  💡 <strong>Instrução:</strong> Copie e cole este prompt na IA de imagem (Nano Banana 2, Midjourney, DALL-E 3, Imagen 3, Recraft). Ele foi purgado de todas as medidas numéricas e réguas, garantindo uma arte plana de ponta a ponta sem bordas cinzas e sem cotas indesejadas.
                </p>
                <textarea
                  rows={8}
                  value={coverVisualPrompt}
                  onChange={(e) => setCoverVisualPrompt(e.target.value)}
                  placeholder="Prompt visual limpo em linguagem natural..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-sans text-xs focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-y"
                />
              </div>
            )}

            {coverFormatTab === "negative" && (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/20">
                  🛡️ <strong>Negative Prompt:</strong> Cole este texto no campo &quot;Negative Prompt&quot; da sua IA para bloquear expressamente mockups 3D sobre mesas, sombras projetadas, molduras cinzas, números e réguas de cota.
                </p>
                <textarea
                  rows={4}
                  value={coverNegativePrompt}
                  onChange={(e) => setCoverNegativePrompt(e.target.value)}
                  placeholder="Negative prompt estrito..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-y"
                />
              </div>
            )}

            {coverFormatTab === "json" && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400">
                  Estrutura JSON Nano Banana 2 completa com diretrizes 2D flat, zona da contracapa, lombada e capa frontal.
                </p>
                <textarea
                  rows={10}
                  value={coverPrompt}
                  onChange={(e) => setCoverPrompt(e.target.value)}
                  placeholder="JSON Nano Banana 2..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-y"
                />
              </div>
            )}

            {coverFormatTab === "technical" && (() => {
              const wrapDims = calculateWraparoundCoverDimensions(book.page_size, book.actual_pages);
              return (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
                    ⚠️ <strong>Atenção:</strong> Estes dados técnicos são apenas informativos para conferência do pré-voo gráfico. <strong>NÃO cole estes números na IA de imagem</strong>, caso contrário a IA tentará desenhar réguas e cotas na arte!
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div><strong>Formato Selecionado:</strong> {wrapDims.formatName}</div>
                    <div><strong>Páginas Físicas Reais:</strong> {wrapDims.pageCount}</div>
                    <div><strong>Largura da Lombada:</strong> {wrapDims.spineWidthInches}&quot; ({wrapDims.spineWidthMm} mm)</div>
                    <div><strong>Sangria Gráfica:</strong> 0.125&quot; (3.175 mm)</div>
                    <div><strong>Dimensões KDP:</strong> {wrapDims.kdpDimensionsString}</div>
                    <div><strong>Resolução 300 DPI:</strong> {wrapDims.totalWidthPx} × {wrapDims.totalHeightPx} px</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Campo 2: Sugestão de Categorias */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">2. Sugestão de Categorias</h3>
                  <p className="text-[11px] text-slate-400">
                    Categorias sugeridas extraídas estritamente da tabela oficial de catalogação editorial (32 categorias permitidas).
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleCopyText("categories", suggestedCategories)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700"
              >
                {copiedField === "categories" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Categorias</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={2}
              value={suggestedCategories}
              onChange={(e) => setSuggestedCategories(e.target.value)}
              placeholder={isGeneratingPublishing ? "Identificando categorias compatíveis..." : "Ex: Administração, Negócios e Economia; Computação, Informática e Mídias Digitais"}
              className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-medium text-xs focus:outline-none focus:border-indigo-500 transition resize-none"
            />

            <div className="pt-2">
              <p className="text-[11px] text-slate-400 font-medium mb-2">
                Tabela Oficial de Categorias (clique em uma categoria para adicionar ou remover):
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {ALLOWED_CATEGORIES.map((cat) => {
                  const isSelected = suggestedCategories
                    .split(";")
                    .map((c) => c.trim().toLowerCase())
                    .includes(cat.toLowerCase());
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer border ${
                        isSelected
                          ? "bg-indigo-600 text-white font-semibold border-indigo-400 shadow-sm shadow-indigo-900/40"
                          : "bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Campo 3: Descrição (Resumo Comercial do Livro) */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">3. Descrição (Resumo Comercial do Livro)</h3>
                  <p className="text-[11px] text-slate-400">
                    Texto simples sem markdown, elaborado para apresentação, marketplace e captação de palavras-chave.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
                    marketingDescription.length <= 4000
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                  }`}
                >
                  {marketingDescription.length.toLocaleString("pt-BR")} / 4.000 caracteres
                </span>

                <button
                  onClick={() => handleCopyText("description", marketingDescription)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700"
                >
                  {copiedField === "description" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Resumo</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              rows={12}
              value={marketingDescription}
              onChange={(e) => setMarketingDescription(e.target.value)}
              placeholder={isGeneratingPublishing ? "Elaborando descrição comercial em texto simples..." : "Descrição comercial e resumo em formato texto simples (sem caracteres especiais ou formatação markdown)..."}
              className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-y font-sans"
            />

            {marketingDescription.length > 4000 && (
              <p className="text-xs text-rose-400 font-semibold">
                Atenção: A descrição ultrapassou o limite de 4.000 caracteres ({marketingDescription.length} caracteres). Reduza o texto para conformidade com marketplaces.
              </p>
            )}
          </div>

          {/* Campo 4: Gerador de Palavras-Chave Estratégicas (SEO & Amazon KDP) por Tópicos */}
          {(() => {
            let parsedKeywords: any = null;
            if (seoKeywords) {
              try {
                parsedKeywords = JSON.parse(seoKeywords);
              } catch {
                parsedKeywords = null;
              }
            }

            const clusters = parsedKeywords?.clusters || [];
            const kdpTop7: string[] = parsedKeywords?.kdp_top_7 || [];
            const plainTextList: string = parsedKeywords?.plain_text_list || seoKeywords;

            const handleCopyAllKeywords = () => {
              const allKwText = clusters.length > 0
                ? clusters.flatMap((c: any) => c.keywords.map((k: any) => k.keyword)).join("\n")
                : seoKeywords;
              handleCopyText("all_keywords", allKwText);
            };

            const handleCopyKdpTop7 = () => {
              const kdpText = kdpTop7.length > 0
                ? kdpTop7.join("\n")
                : "";
              handleCopyText("kdp_top_7", kdpText);
            };

            return (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-200">4. Palavras-Chave Estratégicas (SEO & Amazon KDP)</h3>
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono font-semibold">
                          10 Palavras • 4 Tópicos
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Expressões de busca de alta intenção agrupadas por tópicos semânticos para máxima descoberta no Google, Amazon KDP e IAs (Perplexity, ChatGPT, Gemini).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyKdpTop7}
                      disabled={!kdpTop7 || kdpTop7.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition cursor-pointer border border-amber-500/30 disabled:opacity-50"
                      title="Copiar as 7 melhores palavras-chave formatadas para os 7 slots da Amazon KDP"
                    >
                      {copiedField === "kdp_top_7" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-amber-400" />
                          <span>Copiado Top 7!</span>
                        </>
                      ) : (
                        <>
                          <Tag className="w-3.5 h-3.5" />
                          <span>Copiar 7 Slots KDP</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleCopyAllKeywords}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700"
                      title="Copiar todas as 10 palavras-chave organizadas por tópicos"
                    >
                      {copiedField === "all_keywords" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copiadas 10!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Todas (10)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Exibição dos 4 Tópicos Semânticos com Chips Interativos */}
                {clusters && clusters.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clusters.map((cluster: any, cIdx: number) => {
                      const topicColors = [
                        { border: "border-indigo-500/30", bg: "bg-indigo-500/5", badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" },
                        { border: "border-emerald-500/30", bg: "bg-emerald-500/5", badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
                        { border: "border-amber-500/30", bg: "bg-amber-500/5", badge: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
                        { border: "border-purple-500/30", bg: "bg-purple-500/5", badge: "bg-purple-500/10 text-purple-300 border-purple-500/20" },
                      ];
                      const color = topicColors[cIdx % topicColors.length];

                      return (
                        <div
                          key={cluster.topic_id || cIdx}
                          className={`p-4 rounded-xl border ${color.border} ${color.bg} space-y-3`}
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                            <div>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider border ${color.badge}`}>
                                Tópico {cIdx + 1}
                              </span>
                              <h4 className="text-xs font-bold text-slate-200 mt-1">{cluster.topic_name}</h4>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {cluster.keywords?.length || 0} palavras
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 italic">
                            {cluster.description}
                          </p>

                          <div className="space-y-2">
                            {cluster.keywords?.map((kw: any) => {
                              const isCopied = copiedField === `kw_${kw.keyword}`;
                              return (
                                <div
                                  key={kw.id || kw.keyword}
                                  onClick={() => handleCopyText(`kw_${kw.keyword}`, kw.keyword)}
                                  className="group flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-950 transition cursor-pointer"
                                  title="Clique para copiar esta palavra-chave"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-indigo-400 transition" />
                                    <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                                      {kw.keyword}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {kw.character_count || kw.keyword.length}c
                                    </span>
                                    {isCopied ? (
                                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                                        <Check className="w-3 h-3" /> Copiado
                                      </span>
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Editor / Visualizador em Texto Puro */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Visualização em Texto Estruturado & Edição Manual:
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Edições manuais podem ser salvas com o botão &quot;Salvar Alterações&quot; no topo
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={plainTextList}
                    onChange={(e) => setSeoKeywords(e.target.value)}
                    placeholder={isGeneratingPublishing ? "Gerando palavras-chave com IA e SEO editorial..." : "As 10 palavras-chave organizadas por tópicos serão exibidas aqui..."}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500 transition leading-relaxed resize-y"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
