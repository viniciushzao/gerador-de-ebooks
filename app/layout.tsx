import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Antigravity RAG - Sistema Autônomo de Coautoria de Livros",
  description: "Plataforma de coautoria autônoma com RAG, orquestração multi-agente e diagramação de livros em PDF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="flex h-screen overflow-hidden bg-[#090d16] text-slate-100 antialiased">
        <Sidebar />
        <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-gradient-to-b from-[#0c121e] to-[#090d16]">
          {children}
        </main>
      </body>
    </html>
  );
}
