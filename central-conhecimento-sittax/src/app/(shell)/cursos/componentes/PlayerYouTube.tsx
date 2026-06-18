"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  youtubeId: string;
  aulaId: string;
  onProgressoAtualizado?: (percentual: number) => void;
};

export default function PlayerYouTube({ youtubeId, aulaId, onProgressoAtualizado }: Props) {
  const aulaIdRef = useRef(aulaId);
  aulaIdRef.current = aulaId;
  const cbRef = useRef(onProgressoAtualizado);
  cbRef.current = onProgressoAtualizado;
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (typeof e.origin !== "string" || !e.origin.includes("youtube")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "onStateChange" && data?.info === 0) {
          fetch("/api/ead/progresso", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aulaId: aulaIdRef.current }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && cbRef.current?.(d.percentual))
            .catch(() => {});
        }
        if (data?.event === "onError") {
          setErro("Este vídeo está indisponível.");
        }
      } catch {
        // mensagem não-JSON de outras origens — ignorar
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (erro) {
    return <div className="curso-player-indisponivel">{erro}</div>;
  }

  return (
    <div className="curso-player-wrap">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&autoplay=0&rel=0`}
        title="Player de vídeo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}
