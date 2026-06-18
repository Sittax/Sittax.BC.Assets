"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

interface RespostaLogin {
  ok?: boolean;
  erro?: string;
  mensagem?: string;
  aviso?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const body: RespostaLogin = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setErro(body.mensagem ?? "Não foi possível entrar. Tente novamente.");
      if (body.aviso) setAviso(body.aviso);
    } catch {
      setErro("Falha de comunicação com a central. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={entrar}>
        <h1 className="logo-login">
          <img src="/logo.png" alt="Sittax Conhecimento" />
        </h1>
        <p className="login-sub">
          Entre com o mesmo e-mail e senha que você já usa nas ferramentas
          Sittax.
        </p>

        <label className="login-label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          className="login-input"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="login-label" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          className="login-input"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && (
          <p className="login-erro" role="alert">
            {erro}
          </p>
        )}
        {aviso && <p className="login-aviso">{aviso}</p>}

        <button className="login-botao" type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
