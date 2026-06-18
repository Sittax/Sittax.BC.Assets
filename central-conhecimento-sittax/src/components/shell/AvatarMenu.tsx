"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROTULO_PAPEL, type UsuarioTopBar } from "./tipos";

/** Avatar com menu: nome, papel, escritório (quando houver) e sair (FR-021). */
export function AvatarMenu({ usuario }: { usuario: UsuarioTopBar }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const inicial = usuario.nome.charAt(0).toUpperCase() || "?";
  const nomeCompleto = [usuario.nome, usuario.sobrenome].filter(Boolean).join(" ");

  return (
    <div className="avatar-wrap" ref={ref}>
      <button
        type="button"
        className="avatar-botao"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Menu de ${nomeCompleto}`}
        onClick={() => setAberto((v) => !v)}
      >
        {inicial}
      </button>
      {aberto && (
        <div className="avatar-menu" role="menu">
          <p className="avatar-nome">{nomeCompleto}</p>
          <p className="avatar-detalhe">{ROTULO_PAPEL[usuario.papel]}</p>
          {usuario.escritorioNome && (
            <p className="avatar-detalhe">{usuario.escritorioNome}</p>
          )}
          <hr className="avatar-separador" />
          <button type="button" className="avatar-sair" role="menuitem" onClick={sair}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
