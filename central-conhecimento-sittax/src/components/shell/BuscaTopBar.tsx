"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Resultado {
  slug: string;
  titulo: string;
  trecho: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function BuscaTopBar() {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 280);

  // Abre o modal
  const abrir = () => {
    setModalAberto(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Fecha o modal e limpa
  const fechar = () => {
    setModalAberto(false);
    setQuery("");
    setResultados([]);
    setSelecionado(0);
  };

  // Esc fecha o modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Busca com debounce
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResultados([]);
      return;
    }
    setCarregando(true);
    fetch(`/api/busca?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => {
        setResultados(data.resultados ?? []);
        setSelecionado(0);
      })
      .catch(() => setResultados([]))
      .finally(() => setCarregando(false));
  }, [debouncedQuery]);

  const irPara = (slug: string) => {
    fechar();
    router.push(`/base/${slug}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (resultados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelecionado((s) => Math.min(s + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelecionado((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && resultados[selecionado]) {
      irPara(resultados[selecionado].slug);
    }
  };

  return (
    <>
      {/* Gatilho na TopBar */}
      <button className="busca-topbar-gatilho" onClick={abrir} aria-label="Abrir busca">
        <Search size={15} aria-hidden />
        <span>Buscar…</span>
      </button>

      {/* Modal */}
      {modalAberto && (
        <div className="busca-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
          <div className="busca-modal" role="dialog" aria-modal="true" aria-label="Busca">
            {/* Campo de busca */}
            <div className="busca-modal-campo">
              <Search size={16} className="busca-modal-icone" aria-hidden />
              <input
                ref={inputRef}
                className="busca-modal-input"
                placeholder="Buscar por título ou seção…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
              <button className="busca-modal-fechar" onClick={fechar} aria-label="Fechar busca">
                <X size={16} />
              </button>
            </div>

            {/* Resultados */}
            <div className="busca-modal-lista" role="listbox">
              {query.length < 2 ? (
                <p className="busca-modal-dica">Digite pelo menos 2 caracteres para pesquisar.</p>
              ) : carregando ? (
                <p className="busca-modal-dica">Buscando…</p>
              ) : resultados.length === 0 ? (
                <p className="busca-modal-dica">Nenhum resultado para "<strong>{query}</strong>".</p>
              ) : (
                resultados.map((r, i) => (
                  <button
                    key={r.slug}
                    className={`busca-modal-item${i === selecionado ? " busca-modal-item-ativo" : ""}`}
                    role="option"
                    aria-selected={i === selecionado}
                    onClick={() => irPara(r.slug)}
                    onMouseEnter={() => setSelecionado(i)}
                  >
                    <span className="busca-modal-titulo">{r.titulo}</span>
                    {r.trecho && r.trecho !== r.titulo && (
                      <span
                        className="busca-modal-trecho"
                        dangerouslySetInnerHTML={{ __html: r.trecho }}
                      />
                    )}
                  </button>
                ))
              )}
            </div>

            {resultados.length > 0 && (
              <div className="busca-modal-rodape">
                <kbd>↑↓</kbd> navegar &nbsp;·&nbsp; <kbd>Enter</kbd> abrir &nbsp;·&nbsp; <kbd>Esc</kbd> fechar
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
