/**
 * Roda uma vez na subida do servidor Next (boot): valida as env vars e
 * derruba o processo com mensagem clara se algo estiver inválido (R3).
 */
export async function register() {
  const { validarConfig } = await import("./lib/config");
  validarConfig();
}
