"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Plus, X } from "lucide-react";
import { criarModuloEad } from "@/lib/actions/ead-gestao";

type Props = { produtoId: string };

export function CriarEadBtn({ produtoId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function handleCriar() {
    if (!nome.trim()) return;
    startTransition(async () => {
      const res = await criarModuloEad({ produtoId, nome: nome.trim() });
      if (!res.ok) {
        setErro(res.mensagem);
        return;
      }
      router.push(`/cursos/${res.data!.id}/editar`);
    });
  }

  if (!aberto) {
    return (
      <button className="curso-btn-novo" onClick={() => setAberto(true)}>
        <Plus size={14} />
        Novo EAD
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        autoFocus
        className="curso-editor-input"
        style={{ width: 220 }}
        placeholder="Nome do Curso"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleCriar(); if (e.key === "Escape") setAberto(false); }}
      />
      <button className="curso-editor-btn-salvar" onClick={handleCriar} disabled={pending || !nome.trim()}>
        {pending ? "Criando…" : "Criar"}
      </button>
      <button className="curso-editor-btn-cancelar" onClick={() => setAberto(false)}>
        <X size={13} />
      </button>
      {erro && <span style={{ fontSize: 12, color: "var(--danger)" }}>{erro}</span>}
    </div>
  );
}
