import { z } from "zod";

/**
 * Validação das variáveis de ambiente na inicialização (research R3 + adendo PO):
 * falha de validação derruba o boot com mensagem clara. Nenhum outro módulo lê
 * process.env diretamente — importa `config` daqui.
 */

const ssoBaseUrls = z
  .string({ required_error: "SSO_BASE_URLS é obrigatória" })
  .transform((v) =>
    v
      .split(",")
      .map((u) => u.trim())
      .filter((u) => u.length > 0),
  )
  .superRefine((urls, ctx) => {
    if (urls.length !== 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `SSO_BASE_URLS deve conter exatamente 6 URLs separadas por vírgula (recebidas: ${urls.length})`,
      });
      return;
    }
    for (const u of urls) {
      let parsed: URL;
      try {
        parsed = new URL(u);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SSO_BASE_URLS contém URL inválida: "${u}"`,
        });
        continue;
      }
      if (parsed.protocol !== "https:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SSO_BASE_URLS exige HTTPS em todas as URLs — "${u}" não é HTTPS`,
        });
      }
    }
  });

const positiveIntFromEnv = (name: string, def: number) =>
  z
    .string()
    .optional()
    .default(String(def))
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n > 0, {
      message: `${name} deve ser um inteiro positivo`,
    });

const envSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL é obrigatória" })
    .min(1, "DATABASE_URL é obrigatória"),
  MINIO_ENDPOINT: z
    .string({ required_error: "MINIO_ENDPOINT é obrigatória" })
    .url("MINIO_ENDPOINT deve ser uma URL válida"),
  MINIO_ACCESS_KEY: z
    .string({ required_error: "MINIO_ACCESS_KEY é obrigatória" })
    .min(1, "MINIO_ACCESS_KEY não pode ser vazia"),
  MINIO_SECRET_KEY: z
    .string({ required_error: "MINIO_SECRET_KEY é obrigatória" })
    .min(1, "MINIO_SECRET_KEY não pode ser vazia"),
  MINIO_BUCKET: z
    .string({ required_error: "MINIO_BUCKET é obrigatório" })
    .min(1, "MINIO_BUCKET não pode ser vazio"),
  MINIO_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  SESSION_SECRET: z
    .string({ required_error: "SESSION_SECRET é obrigatória" })
    .min(32, "SESSION_SECRET deve ter no mínimo 32 caracteres"),
  SSO_BASE_URLS: ssoBaseUrls,
  SSO_TIMEOUT_MS: positiveIntFromEnv("SSO_TIMEOUT_MS", 3000),
  SSO_TOTAL_TIMEOUT_MS: positiveIntFromEnv("SSO_TOTAL_TIMEOUT_MS", 10000),
  SESSION_IDLE_DAYS: positiveIntFromEnv("SESSION_IDLE_DAYS", 7),
  SESSION_MAX_DAYS: positiveIntFromEnv("SESSION_MAX_DAYS", 30),
});

export type AppConfig = z.infer<typeof envSchema>;

let carregada: AppConfig | null = null;

export function validarConfig(): AppConfig {
  if (carregada) return carregada;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const detalhes = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Configuração de ambiente inválida — a aplicação não pode subir:\n${detalhes}\n` +
        `Confira o .env (modelo em .env.example).`,
    );
  }
  carregada = result.data;
  return carregada;
}

// Validação lazy no acesso (o `next build` importa os módulos do servidor sem
// ambiente); a falha NO BOOT é garantida por src/instrumentation.ts, que
// chama validarConfig() na subida do servidor.
export const config: AppConfig = new Proxy({} as AppConfig, {
  get(_t, prop) {
    return validarConfig()[prop as keyof AppConfig];
  },
});
