import "dotenv/config";

/**
 * Ambiente mínimo para os testes importarem src/lib/config.ts sem depender
 * do .env completo. O DATABASE_URL aponta para o central_test como
 * central_app (senha definida por tests/helpers/db.ts no setup).
 */
process.env.SESSION_SECRET ??= "segredo-de-teste-com-32-caracteres!!";
process.env.SSO_BASE_URLS ??= Array(6)
  .fill("https://sso-invalido.teste.example")
  .join(",");

if (process.env.DATABASE_ADMIN_URL) {
  // a role central_app é do CLUSTER: os testes reutilizam a senha já
  // configurada no DATABASE_URL do ambiente para não sobrescrevê-la
  let senha = "central_test_pw";
  try {
    const original = new URL(process.env.DATABASE_URL ?? "");
    if (original.username === "central_app" && original.password) {
      senha = original.password;
    }
  } catch {}
  const u = new URL(process.env.DATABASE_ADMIN_URL);
  u.pathname = "/central_test";
  u.username = "central_app";
  u.password = senha;
  process.env.DATABASE_URL = u.toString();
}
