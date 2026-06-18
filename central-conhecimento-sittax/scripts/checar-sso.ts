import "dotenv/config";

/**
 * Inspeção pontual do SSO (homolog): mostra o que a API de login retorna
 * para um usuário — claims do JWT decodificadas + objeto `usuario` — e como
 * a central traduziria (mapeamento role/nivel → papel).
 *
 * Uso: npx tsx scripts/checar-sso.ts <email> <senha>
 * NÃO COMMITAR SAÍDAS. O token bruto não é exibido.
 */

async function main() {
  const [email, senha] = process.argv.slice(2);
  if (!email || !senha) {
    console.error("Uso: npx tsx scripts/checar-sso.ts <email> <senha>");
    process.exit(1);
  }

  const bases = (process.env.SSO_BASE_URLS ?? "").split(",").filter(Boolean);
  if (bases.length === 0) {
    console.error("SSO_BASE_URLS não configurado no .env");
    process.exit(1);
  }

  // as 6 URLs de homolog são iguais — chama só as distintas
  const distintas = [...new Set(bases)];

  for (const base of distintas) {
    console.log(`\n═══ ${base} ═══`);
    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario: email, senha }),
        signal: AbortSignal.timeout(10_000),
      });
      console.log(`HTTP ${res.status}`);
      const body = (await res.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      if (!body) {
        console.log("(corpo não-JSON ou vazio)");
        continue;
      }

      const { token, ...resto } = body;
      console.log("\n— corpo (sem token) —");
      console.log(JSON.stringify(resto, null, 2));

      if (typeof token === "string" && token.split(".").length >= 2) {
        const claims = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
        );
        console.log("\n— claims do JWT —");
        console.log(JSON.stringify(claims, null, 2));
      } else {
        console.log("\n(sem token decodificável na resposta)");
      }
    } catch (e) {
      console.log(`falha: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main();
