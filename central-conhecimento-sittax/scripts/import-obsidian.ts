import "dotenv/config";
import { createReadStream, readFileSync } from "fs";
import { join, resolve } from "path";
import AdmZip from "adm-zip";
import { importarObsidian } from "../src/lib/conteudo/importer";
import { getStorage } from "../src/lib/storage/minio";
import { getDb, endPool } from "../src/lib/db/client";

/**
 * CLI de importação de vault Obsidian.
 * Uso: npx tsx scripts/import-obsidian.ts <pasta-vault> <produtoId>
 *
 * Lê a pasta local, compacta em memória e chama o MESMO motor via withSystem
 * (Princípio VII — um motor, dois invólucros).
 */

async function main() {
  const [, , pastaVault, produtoId] = process.argv;
  if (!pastaVault || !produtoId) {
    console.error("Uso: npx tsx scripts/import-obsidian.ts <pasta-vault> <produtoId>");
    process.exitCode = 1;
    return;
  }

  const pastaAbsoluta = resolve(pastaVault);
  console.log(`Compactando vault em: ${pastaAbsoluta}`);

  const zip = new AdmZip();
  zip.addLocalFolder(pastaAbsoluta);
  const zipBuffer = zip.toBuffer();

  console.log(`ZIP em memória: ${(zipBuffer.byteLength / 1024).toFixed(1)} KB`);
  console.log(`Importando para produto: ${produtoId}`);

  const relatorio = await importarObsidian(zipBuffer, produtoId, getStorage(), getDb);

  console.log("\n── Relatório ──────────────────────────────");
  console.log(`Tópicos criados : ${relatorio.topicos}`);
  console.log(`Imagens migradas: ${relatorio.imagens}`);
  if (relatorio.avisos.length > 0) {
    console.log(`\nAvisos (${relatorio.avisos.length}):`);
    for (const a of relatorio.avisos) console.log(`  - ${a}`);
  } else {
    console.log("Sem avisos.");
  }
}

main()
  .catch((err) => {
    console.error("Falha na importação:", err);
    process.exitCode = 1;
  })
  .finally(() => endPool());
