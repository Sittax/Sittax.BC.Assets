"use client";

import { useState } from "react";
import { criarModulo, renomearModulo, excluirModulo } from "@/lib/actions/modulos";
import { criarTopico, excluirTopico } from "@/lib/actions/topicos";
import type { ModuloComTopicos } from "@/lib/conteudo/consultas";

type FeedbackResult = { ok: boolean; mensagem?: string };

export function GerenciaArvore({
  arvore,
  produtoId,
  onAtualizar,
  onNovoTopico,
}: {
  arvore: ModuloComTopicos[];
  produtoId: string;
  onAtualizar: () => void;
  onNovoTopico?: (slug: string) => void;
}) {
  const [novoModuloNome, setNovoModuloNome] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const feedback = (resultado: FeedbackResult) => {
    if (resultado.ok) {
      setMensagem("Operação realizada.");
      setErro(null);
      onAtualizar();
    } else {
      setErro((resultado as { ok: false; mensagem: string }).mensagem);
      setMensagem(null);
    }
  };

  const handleCriarModulo = async () => {
    if (!novoModuloNome.trim()) return;
    const r = await criarModulo({ produtoId, nome: novoModuloNome.trim() });
    setNovoModuloNome("");
    feedback(r);
  };

  return (
    <div className="gerencia-arvore">
      <p className="gerencia-arvore-titulo">Gerenciar Árvore</p>

      <div className="gerencia-arvore-acoes">
        {/* Criar novo módulo */}
        <div className="form-inline" style={{ marginBottom: 8 }}>
          <input
            value={novoModuloNome}
            onChange={(e) => setNovoModuloNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCriarModulo()}
            placeholder="Nome do módulo"
            className="gerencia-input"
          />
          <button
            className="gerencia-arvore-btn"
            onClick={handleCriarModulo}
            disabled={!novoModuloNome.trim()}
          >
            + Módulo
          </button>
        </div>

        {/* Módulos existentes */}
        {arvore.map((mod) => (
          <ModuloAcoes
            key={mod.id}
            mod={mod}
            feedback={feedback}
            onNovoTopico={onNovoTopico}
          />
        ))}
      </div>

      {mensagem && <p className="form-ok" style={{ marginTop: 8 }}>{mensagem}</p>}
      {erro && <p className="form-erro" style={{ marginTop: 8 }}>{erro}</p>}
    </div>
  );
}

function ModuloAcoes({
  mod,
  feedback,
  onNovoTopico,
}: {
  mod: ModuloComTopicos;
  feedback: (r: FeedbackResult) => void;
  onNovoTopico?: (slug: string) => void;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [novoTopTitulo, setNovoTopTitulo] = useState("");
  const [criando, setCriando] = useState(false);

  const handleCriarTopico = async () => {
    if (!novoTopTitulo.trim()) return;
    setCriando(true);
    const r = await criarTopico({ moduloId: mod.id, titulo: novoTopTitulo.trim() });
    setCriando(false);
    if (r.ok && "slug" in r && typeof r.slug === "string" && onNovoTopico) {
      onNovoTopico(r.slug);
    } else {
      setNovoTopTitulo("");
      feedback(r);
    }
  };

  return (
    <details className="gerencia-modulo-detalhe">
      <summary className="gerencia-modulo-summary">
        <span>{mod.nome}</span>
        <span className="gerencia-modulo-count">{mod.topicos.length} tópico{mod.topicos.length !== 1 ? "s" : ""}</span>
      </summary>

      <div className="gerencia-modulo-corpo">
        {/* Renomear módulo */}
        <div className="form-inline">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && novoNome.trim()) {
                feedback(await renomearModulo({ id: mod.id, nome: novoNome.trim() }));
                setNovoNome("");
              }
            }}
            placeholder="Novo nome"
            className="gerencia-input"
          />
          <button
            className="gerencia-arvore-btn"
            onClick={async () => {
              if (!novoNome.trim()) return;
              feedback(await renomearModulo({ id: mod.id, nome: novoNome.trim() }));
              setNovoNome("");
            }}
          >
            Renomear
          </button>
        </div>

        {/* Criar tópico no módulo */}
        <div className="form-inline">
          <input
            value={novoTopTitulo}
            onChange={(e) => setNovoTopTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCriarTopico()}
            placeholder="Título do tópico"
            className="gerencia-input"
          />
          <button
            className="gerencia-arvore-btn gerencia-btn-criar"
            onClick={handleCriarTopico}
            disabled={!novoTopTitulo.trim() || criando}
          >
            {criando ? "…" : "+ Tópico"}
          </button>
        </div>

        {/* Tópicos existentes */}
        {mod.topicos.length > 0 && (
          <ul className="gerencia-topicos-lista">
            {mod.topicos.map((t) => (
              <li key={t.id} className="gerencia-topico-item">
                <span className="gerencia-topico-titulo">{t.titulo}</span>
                <div className="gerencia-topico-acoes">
                  <a
                    href={`/base/${t.slug}/editar`}
                    className="gerencia-arvore-btn gerencia-btn-edit"
                  >
                    Editar
                  </a>
                  <button
                    className="gerencia-arvore-btn gerencia-btn-excluir"
                    onClick={async () => {
                      if (!confirm(`Excluir "${t.titulo}"? Só é possível se não tiver subtópicos.`)) return;
                      feedback(await excluirTopico({ id: t.id }));
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Excluir módulo */}
        <button
          className="gerencia-arvore-btn gerencia-btn-excluir"
          style={{ marginTop: 4 }}
          onClick={async () => {
            if (!confirm(`Excluir módulo "${mod.nome}"? Só é possível se estiver vazio.`)) return;
            feedback(await excluirModulo({ id: mod.id }));
          }}
        >
          Excluir módulo
        </button>
      </div>
    </details>
  );
}
