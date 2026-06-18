"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";

/**
 * Thumbnail do curso com fallback robusto: capa ausente, vazia OU que falha
 * ao carregar cai para um placeholder neutro — nunca imagem quebrada.
 */
export function CapaCurso({ src, alt }: { src: string | null; alt: string }) {
  const [erro, setErro] = useState(false);
  const valida = !!src && src.trim().length > 0 && !erro;

  return (
    <div className="curso-card-capa">
      {valida ? (
        <img src={src!} alt={alt} onError={() => setErro(true)} loading="lazy" />
      ) : (
        <div className="curso-card-capa-placeholder" aria-hidden>
          <GraduationCap size={34} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
