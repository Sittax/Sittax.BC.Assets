"use client";

import { useState } from "react";
import Link from "next/link";
import { FileArchive, Upload } from "lucide-react";

interface Relatorio {
  topicos: number;
  atualizados: number;
  imagens: number;
  avisos: string[];
}

type ProdutoOpcao = { id: string; nome: string };

export function ImportarForm({
  produtos,
  produtoAtivoId,
}: {
  produtos: ProdutoOpcao[];
  produtoAtivoId: string | null;
}) {
  const [produtoId, setProdutoId] = useState(
    produtoAtivoId ?? produtos[0]?.id ?? "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleImportar = async () => {
    if (!file || !produtoId) return;
    setCarregando(true);
    setRelatorio(null);
    setErro(null);

    const form = new FormData();
    form.append("vault", file);
    form.append("produtoId", produtoId);

    try {
      const resp = await fetch("/api/importar-obsidian", {
        method: "POST",
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErro(data.erro ?? "Erro ao importar.");
      } else {
        setRelatorio(data);
      }
    } catch {
      setErro("Erro de rede ao importar.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="importar-card">
      <div className="notas-header">
        <h1>Importar Markdown</h1>
        <Link href="/base" className="editor-voltar">
          ← Base de conhecimento
        </Link>
      </div>

      <p className="importar-ajuda">
        Envie um <strong>.zip</strong> de arquivos markdown (ex.: uma vault do
        Obsidian): pastas viram módulos e tópicos, o frontmatter é aproveitado,{" "}
        <code>[[wikilinks]]</code> são convertidos e as imagens migradas para o
        produto escolhido. Reimportar o mesmo .zip <strong>atualiza</strong> o
        conteúdo — não duplica páginas.
      </p>

      <div className="editor-nota-campos">
        <label className="editor-nota-campo">
          Produto de destino
          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="editor-nota-campo">
          Arquivo ZIP da vault
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <button
        className="login-botao importar-btn"
        onClick={handleImportar}
        disabled={!file || !produtoId || carregando}
      >
        <Upload size={15} />
        {carregando ? "Importando…" : "Importar"}
      </button>

      {erro && <p className="editor-erro">{erro}</p>}

      {relatorio && (
        <div className="importar-relatorio">
          <h2>
            <FileArchive size={16} /> Relatório de importação
          </h2>
          <p>
            <strong>{relatorio.topicos}</strong>{" "}
            {relatorio.topicos === 1 ? "tópico criado" : "tópicos criados"},{" "}
            <strong>{relatorio.atualizados}</strong>{" "}
            {relatorio.atualizados === 1 ? "atualizado" : "atualizados"} (já
            existiam) e <strong>{relatorio.imagens}</strong>{" "}
            {relatorio.imagens === 1 ? "imagem migrada" : "imagens migradas"}.
            Reimportar a mesma vault <strong>atualiza</strong> o conteúdo — não
            duplica páginas.
          </p>
          {relatorio.avisos.length > 0 && (
            <>
              <p className="importar-avisos-titulo">
                Avisos ({relatorio.avisos.length})
              </p>
              <ul className="importar-avisos">
                {relatorio.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
