"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import {
  atualizarModuloEad,
  criarAula,
  editarAula,
  excluirAula,
  excluirModuloEad,
} from "@/lib/actions/ead-gestao";

type AulaItem = {
  id: string;
  titulo: string;
  youtubeId: string;
  descricaoMd: string;
  ordem: number;
};

type ProdutoOpcao = { id: string; nome: string };

type Props = {
  moduloId: string;
  nomeInicial: string;
  capaUrlInicial: string | null;
  descricaoMdInicial: string;
  produtos: ProdutoOpcao[];
  produtoPrincipalId: string | null;
  produtosVinculadosIniciais: string[];
  aulasIniciais: AulaItem[];
};

export function EditorEadModulo({
  moduloId,
  nomeInicial,
  capaUrlInicial,
  descricaoMdInicial,
  produtos,
  produtoPrincipalId,
  produtosVinculadosIniciais,
  aulasIniciais,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [infoSalvo, setInfoSalvo] = useState(false);
  const [uploadando, setUploadando] = useState(false);

  // Campos de info
  const [nome, setNome] = useState(nomeInicial);
  const [capaUrl, setCapaUrl] = useState(capaUrlInicial ?? "");
  // reseta o erro de preview quando a URL muda
  function setCapaUrlComReset(url: string) { setCapaUrl(url); setCapaPreviewErro(false); }
  const [descricaoMd, setDescricaoMd] = useState(descricaoMdInicial);
  const [vinculados, setVinculados] = useState<string[]>(produtosVinculadosIniciais);
  const [principalId, setPrincipalId] = useState<string | null>(produtoPrincipalId);

  const [capaPreviewErro, setCapaPreviewErro] = useState(false);

  const isPrincipal = (id: string) => id === principalId;

  function toggleVinculado(id: string) {
    setVinculados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function trocarPrincipal(novoId: string) {
    setPrincipalId(novoId);
    // remove o novo principal dos extras (não faz sentido estar nos dois)
    setVinculados((prev) => prev.filter((x) => x !== novoId));
  }

  // Aulas
  const [aulas, setAulas] = useState<AulaItem[]>(aulasIniciais);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  // Estado do form de edição de aula
  const [editTitulo, setEditTitulo] = useState("");
  const [editYoutube, setEditYoutube] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  // Estado do form de nova aula
  const [novaTitulo, setNovaTitulo] = useState("");
  const [novaYoutube, setNovaYoutube] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  // ── Upload de capa ──────────────────────────────────────────────────────────

  async function handleUploadCapa(file: File) {
    setUploadando(true);
    setErro(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/arquivos?crop=capa", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setCapaUrl(data.url as string);
      } else {
        const body = await res.json().catch(() => ({}));
        setErro((body as { mensagem?: string }).mensagem ?? "Erro ao enviar imagem.");
      }
    } catch {
      setErro("Erro de rede ao enviar imagem.");
    } finally {
      setUploadando(false);
    }
  }

  // ── Info ────────────────────────────────────────────────────────────────────

  function handleSalvarInfo() {
    startTransition(async () => {
      const res = await atualizarModuloEad({
        id: moduloId,
        nome: nome.trim() || undefined,
        capaUrl: capaUrl.trim() || null,
        descricaoMd,
        produtosVinculados: vinculados,
        produtoPrincipalNovo: principalId ?? undefined,
      });
      if (!res.ok) {
        setErro(res.mensagem);
      } else {
        setErro(null);
        setInfoSalvo(true);
        setTimeout(() => setInfoSalvo(false), 2500);
      }
    });
  }

  // ── Aulas ───────────────────────────────────────────────────────────────────

  function abrirEdicao(a: AulaItem) {
    setEditandoId(a.id);
    setEditTitulo(a.titulo);
    setEditYoutube(a.youtubeId);
    setEditDescricao(a.descricaoMd);
  }

  function fecharEdicao() {
    setEditandoId(null);
  }

  function handleSalvarAula(id: string) {
    startTransition(async () => {
      const res = await editarAula({
        id,
        titulo: editTitulo.trim() || undefined,
        youtube: editYoutube.trim() || undefined,
        descricaoMd: editDescricao,
      });
      if (!res.ok) {
        setErro(res.mensagem);
      } else {
        setAulas((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  titulo: editTitulo.trim() || a.titulo,
                  youtubeId: editYoutube.trim() || a.youtubeId,
                  descricaoMd: editDescricao,
                }
              : a,
          ),
        );
        fecharEdicao();
      }
    });
  }

  function handleExcluirAula(id: string, titulo: string) {
    if (!confirm(`Excluir "${titulo}"?\nO progresso dos inscritos será removido.`)) return;
    startTransition(async () => {
      const res = await excluirAula({ id });
      if (!res.ok) setErro(res.mensagem);
      else setAulas((prev) => prev.filter((a) => a.id !== id));
    });
  }

  function handleAdicionarAula() {
    if (!novaTitulo.trim() || !novaYoutube.trim()) return;
    startTransition(async () => {
      const res = await criarAula({
        eadModuloId: moduloId,
        titulo: novaTitulo.trim(),
        youtube: novaYoutube.trim(),
        descricaoMd: novaDescricao,
      });
      if (!res.ok) {
        setErro(res.mensagem);
      } else {
        setAulas((prev) => [
          ...prev,
          {
            id: res.data!.id,
            titulo: novaTitulo.trim(),
            youtubeId: res.data!.youtubeId,
            descricaoMd: novaDescricao,
            ordem: (prev[prev.length - 1]?.ordem ?? 0) + 1,
          },
        ]);
        setNovaTitulo("");
        setNovaYoutube("");
        setNovaDescricao("");
        setAdicionando(false);
      }
    });
  }

  function handleExcluirModulo() {
    if (!confirm(`Excluir o Curso "${nomeInicial}"?\n\nEsta ação é irreversível. O módulo precisa estar sem aulas para ser excluído.`)) return;
    startTransition(async () => {
      const res = await excluirModuloEad({ id: moduloId });
      if (!res.ok) {
        setErro(res.mensagem);
      } else {
        router.push("/cursos");
      }
    });
  }

  return (
    <div>
      {erro && (
        <div className="curso-erro">
          <span>{erro}</span>
          <button className="curso-erro-fechar" onClick={() => setErro(null)}>fechar</button>
        </div>
      )}

      {/* ── Informações do Curso ── */}
      <section className="curso-editor-secao">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 className="curso-editor-secao-titulo" style={{ margin: 0 }}>Informações</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {infoSalvo && <span className="curso-editor-salvo">✓ Salvo</span>}
            <button
              className="curso-editor-btn-salvar"
              onClick={handleSalvarInfo}
              disabled={pending}
            >
              Salvar informações
            </button>
          </div>
        </div>

        <div className="curso-editor-campo">
          <label className="curso-editor-label">Nome do Curso</label>
          <input
            className="curso-editor-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Introdução ao Sittax Simples"
          />
        </div>

        <div className="curso-editor-campo">
          <label className="curso-editor-label">Capa</label>
          <div className="curso-editor-capa-grupo">
            <input
              className="curso-editor-input"
              value={capaUrl}
              onChange={(e) => setCapaUrlComReset(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
            />
            <label className={`curso-editor-upload-btn${uploadando ? " curso-editor-upload-btn--carregando" : ""}`}>
              {uploadando ? "Enviando…" : "Enviar arquivo"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                disabled={uploadando}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadCapa(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {capaUrl.trim() && !capaPreviewErro && (
            <div className="curso-editor-capa-preview">
              <img
                src={capaUrl.trim()}
                alt="Preview da capa"
                onError={() => setCapaPreviewErro(true)}
              />
            </div>
          )}
          {capaUrl.trim() && capaPreviewErro && (
            <p className="curso-editor-ajuda" style={{ color: "var(--danger, #c0392b)" }}>
              Imagem não pôde ser carregada — verifique a URL.
            </p>
          )}
        </div>

        <div className="curso-editor-campo">
          <label className="curso-editor-label">Descrição</label>
          <textarea
            className="curso-editor-textarea"
            rows={4}
            value={descricaoMd}
            onChange={(e) => setDescricaoMd(e.target.value)}
            placeholder="Descreva o conteúdo deste curso…"
          />
        </div>

        <div className="curso-editor-campo">
          <label className="curso-editor-label">Produto principal</label>
          <select
            className="curso-editor-input"
            value={principalId ?? ""}
            onChange={(e) => trocarPrincipal(e.target.value)}
          >
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        <div className="curso-editor-campo">
          <label className="curso-editor-label">Também aparece em</label>
          <p className="curso-editor-ajuda">
            Este curso também será exibido na trilha dos produtos selecionados abaixo.
          </p>
          {produtos.filter((p) => p.id !== principalId).length === 0 ? (
            <p className="curso-editor-ajuda">Nenhum outro produto disponível.</p>
          ) : (
            <div className="curso-editor-chips">
              {produtos
                .filter((p) => p.id !== principalId)
                .map((p) => {
                  const ativo = vinculados.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`curso-chip${ativo ? " curso-chip--ativo" : ""}`}
                      aria-pressed={ativo}
                      onClick={() => toggleVinculado(p.id)}
                    >
                      {p.nome}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

      </section>

      {/* ── Aulas (passo a passo) ── */}
      <section className="curso-editor-secao">
        <h2 className="curso-editor-secao-titulo">
          Aulas — passo a passo ({aulas.length})
        </h2>

        {aulas.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
            Nenhuma aula ainda. Adicione a primeira abaixo.
          </p>
        )}

        {aulas.map((a, i) => (
          <div key={a.id}>
            <div className="curso-editor-aula-row">
              <span className="curso-editor-aula-num">{String(i + 1).padStart(2, "0")}</span>
              <div className="curso-editor-aula-info">
                <div className="curso-editor-aula-titulo-text">{a.titulo}</div>
                <div className="curso-editor-aula-yt">{a.youtubeId}</div>
              </div>
              <span className="curso-editor-aula-acoes">
                <button
                  className="curso-gestao-icone-btn"
                  title="Editar aula"
                  onClick={() => editandoId === a.id ? fecharEdicao() : abrirEdicao(a)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="curso-gestao-icone-btn curso-gestao-icone-btn--perigo"
                  title="Excluir aula"
                  onClick={() => handleExcluirAula(a.id, a.titulo)}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>

            {editandoId === a.id && (
              <div className="curso-editor-aula-inline">
                <div className="curso-editor-campo" style={{ marginBottom: 0 }}>
                  <label className="curso-editor-label">Título</label>
                  <input
                    className="curso-editor-input"
                    value={editTitulo}
                    onChange={(e) => setEditTitulo(e.target.value)}
                  />
                </div>
                <div className="curso-editor-campo" style={{ marginBottom: 0 }}>
                  <label className="curso-editor-label">URL ou ID do YouTube</label>
                  <input
                    className="curso-editor-input"
                    value={editYoutube}
                    onChange={(e) => setEditYoutube(e.target.value)}
                    placeholder="youtube.com/watch?v=... ou ID de 11 chars"
                  />
                </div>
                <div className="curso-editor-campo" style={{ marginBottom: 0 }}>
                  <label className="curso-editor-label">Descrição (opcional)</label>
                  <textarea
                    className="curso-editor-textarea"
                    rows={3}
                    value={editDescricao}
                    onChange={(e) => setEditDescricao(e.target.value)}
                  />
                </div>
                <div className="curso-editor-aula-inline-acoes">
                  <button
                    className="curso-editor-btn-salvar"
                    onClick={() => handleSalvarAula(a.id)}
                    disabled={pending}
                  >
                    <Check size={13} style={{ marginRight: 4 }} />
                    Salvar aula
                  </button>
                  <button className="curso-editor-btn-cancelar" onClick={fecharEdicao}>
                    <X size={13} style={{ marginRight: 3 }} />
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Form: nova aula */}
        {adicionando ? (
          <div className="curso-editor-add-form">
            <div className="curso-editor-campo" style={{ marginBottom: 0 }}>
              <label className="curso-editor-label">Título da aula *</label>
              <input
                autoFocus
                className="curso-editor-input"
                value={novaTitulo}
                onChange={(e) => setNovaTitulo(e.target.value)}
                placeholder="Ex: Introdução ao módulo"
              />
            </div>
            <div className="curso-editor-campo" style={{ marginBottom: 0 }}>
              <label className="curso-editor-label">URL ou ID do YouTube *</label>
              <input
                className="curso-editor-input"
                value={novaYoutube}
                onChange={(e) => setNovaYoutube(e.target.value)}
                placeholder="https://youtube.com/watch?v=... ou dQw4w9WgXcQ"
              />
            </div>
            <div className="curso-editor-campo" style={{ marginBottom: 0 }}>
              <label className="curso-editor-label">Descrição (opcional)</label>
              <textarea
                className="curso-editor-textarea"
                rows={3}
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
              />
            </div>
            <div className="curso-editor-aula-inline-acoes">
              <button
                className="curso-editor-btn-salvar"
                onClick={handleAdicionarAula}
                disabled={pending || !novaTitulo.trim() || !novaYoutube.trim()}
              >
                {pending ? "Adicionando…" : "Adicionar aula"}
              </button>
              <button className="curso-editor-btn-cancelar" onClick={() => setAdicionando(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            className="curso-editor-add-aula-btn"
            onClick={() => setAdicionando(true)}
            disabled={pending}
          >
            <Plus size={13} />
            Adicionar aula
          </button>
        )}
      </section>

      {/* ── Zona de perigo ── */}
      <section className="curso-editor-secao curso-editor-secao--perigo">
        <h2 className="curso-editor-secao-titulo">Zona de perigo</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
          O módulo só pode ser excluído se não tiver aulas. Exclua todas as aulas antes de prosseguir.
        </p>
        <button
          className="curso-editor-btn-excluir"
          onClick={handleExcluirModulo}
          disabled={pending}
        >
          <Trash2 size={13} />
          Excluir Curso
        </button>
      </section>
    </div>
  );
}
