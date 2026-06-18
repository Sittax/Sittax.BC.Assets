"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { selecionarProduto } from "@/lib/actions/produto-selecionado";
import type { ProdutoItem } from "./tipos";

/**
 * Seletor de produto (pill + dropdown, doc layout §3): mostra os 6 produtos
 * na ordem do catálogo, independentemente de contrato. Dentro de
 * /ead-interno fica desabilitado/atenuado com tooltip; ao sair, volta com a
 * seleção anterior (o estado vive no servidor — nada se perde).
 */
export function ProductSelector({
  produtos,
  selecionadoId,
}: {
  produtos: ProdutoItem[];
  selecionadoId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const noEadInterno = pathname.startsWith("/ead-interno");
  const selecionado = produtos.find((p) => p.id === selecionadoId) ?? null;

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  if (noEadInterno) {
    return (
      <div
        className="produto-pill produto-pill-desabilitado"
        title="EAD interno é organizado por temas"
        aria-disabled="true"
      >
        {selecionado?.nome ?? "Produto"}
        <ChevronDown size={14} aria-hidden />
      </div>
    );
  }

  return (
    <div className="produto-seletor" ref={ref}>
      <button
        type="button"
        className="produto-pill"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        disabled={pendente}
        onClick={() => setAberto((v) => !v)}
      >
        {selecionado?.nome ?? "Selecionar produto"}
        <ChevronDown size={14} aria-hidden />
      </button>
      {aberto && (
        <ul className="produto-menu" role="listbox">
          {produtos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={p.id === selecionadoId}
                className={`produto-opcao${p.id === selecionadoId ? " produto-opcao-ativa" : ""}`}
                onClick={() => {
                  setAberto(false);
                  if (p.id === selecionadoId) return;
                  startTransition(async () => {
                    await selecionarProduto(p.id);
                    // Preserva a seção atual ao trocar produto
                    const secao = pathname.startsWith("/cursos") ? "/cursos"
                      : pathname.startsWith("/base") ? "/base"
                      : "/base";
                    router.push(secao);
                  });
                }}
              >
                {p.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
