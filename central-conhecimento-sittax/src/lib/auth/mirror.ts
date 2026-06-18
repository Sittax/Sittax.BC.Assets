import { and, eq, isNull, sql } from "drizzle-orm";
import { formatarCnpj, normalizarCnpj } from "@/lib/cnpj";
import { withSystem, type Tx } from "@/lib/db/rls";
import { escritorio, papelMapeamento, usuario } from "@/lib/db/schema";
import type { DadosSsoValidado } from "./sso-client";

/**
 * Espelhamento de usuário/escritório a cada login validado na origem:
 * tradução role/nivel pelo mapeamento (R8), CNPJ como chave de escritório
 * (R9), e-mail normalizado como chave de identidade (R1).
 */

export type PapelEspelhavel = "padrao" | "suporte" | "dev";

/** Papel traduzido é padrão e a origem não informou escritório (FR-028). */
export class SemEscritorioError extends Error {
  constructor() {
    super("usuário sem escritório vinculado");
  }
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolução do mapeamento: exato → curinga de nível → fallback padrão (R8).
 * `mapeado` distingue tradução real de fallback — no relogin, papel mapeado
 * SEMPRE ressincroniza (inclusive downgrade); só o fallback preserva promoção.
 */
export async function traduzirPapel(
  tx: Tx,
  role: string,
  nivel: number | null,
): Promise<{ papel: PapelEspelhavel; mapeado: boolean }> {
  if (nivel !== null) {
    const exato = await tx
      .select()
      .from(papelMapeamento)
      .where(
        and(
          eq(papelMapeamento.roleOrigem, role),
          eq(papelMapeamento.nivelOrigem, nivel),
        ),
      );
    if (exato[0]) return { papel: exato[0].papelCentral, mapeado: true };
  }
  const curinga = await tx
    .select()
    .from(papelMapeamento)
    .where(
      and(eq(papelMapeamento.roleOrigem, role), isNull(papelMapeamento.nivelOrigem)),
    );
  if (curinga[0]) return { papel: curinga[0].papelCentral, mapeado: true };
  return { papel: "padrao", mapeado: false };
}

export type UsuarioEspelhado = typeof usuario.$inferSelect;

/**
 * Upsert de escritório (por CNPJ) e usuário (por e-mail) via withSystem.
 * Lança SemEscritorioError quando papel traduzido = padrão e CNPJ vazio.
 */
export async function espelharLogin(
  dados: DadosSsoValidado,
): Promise<UsuarioEspelhado> {
  return withSystem(async (tx) => {
    const { papel, mapeado } = await traduzirPapel(tx, dados.role, dados.nivel);
    const cnpj = normalizarCnpj(dados.escritorioCnpj);

    if (!cnpj && papel === "padrao") throw new SemEscritorioError();

    let escritorioId: string | null = null;
    if (cnpj) {
      const nomeClaim = dados.escritorioNome.trim();
      const existente = await tx
        .select()
        .from(escritorio)
        .where(eq(escritorio.cnpj, cnpj));
      if (existente[0]) {
        escritorioId = existente[0].id;
        // nome só é ressincronizado quando a origem informa um — nome vazio
        // não apaga ajuste manual do Master (R9)
        if (nomeClaim && nomeClaim !== existente[0].nome) {
          await tx
            .update(escritorio)
            .set({ nome: nomeClaim })
            .where(eq(escritorio.id, escritorioId));
        }
      } else {
        const [novo] = await tx
          .insert(escritorio)
          .values({ cnpj, nome: nomeClaim || formatarCnpj(cnpj) })
          .returning();
        escritorioId = novo.id;
      }
    }

    const email = normalizarEmail(dados.email);
    const atual = await tx.select().from(usuario).where(eq(usuario.email, email));

    if (atual[0] && atual[0].origem === "central") {
      // local-first: o fluxo de login nunca chega aqui para usuário central;
      // proteção contra sobrescrever cadastro local por engano
      throw new Error("e-mail pertence a usuário só central");
    }

    if (atual[0]) {
      const HIERARQUIA: PapelEspelhavel[] = ["padrao", "suporte", "dev"];
      const nivelAtual = HIERARQUIA.indexOf(atual[0].papel as PapelEspelhavel);
      const nivelNovo = HIERARQUIA.indexOf(papel);
      // Papel MAPEADO ressincroniza sempre (a central espelha, não inventa —
      // escopo §2/§3); o fallback sem mapeamento preserva promoção manual
      const papelFinal =
        !mapeado && nivelAtual > nivelNovo
          ? (atual[0].papel as PapelEspelhavel)
          : papel;

      const [atualizado] = await tx
        .update(usuario)
        .set({
          nome: dados.nome,
          sobrenome: dados.sobrenome,
          papel: papelFinal,
          escritorioId,
          idOrigem: atual[0].idOrigem ?? (dados.idOrigem || null),
          ultimoLoginEm: sql`now()`,
        })
        .where(eq(usuario.id, atual[0].id))
        .returning();
      return atualizado;
    }

    const [criado] = await tx
      .insert(usuario)
      .values({
        nome: dados.nome,
        sobrenome: dados.sobrenome,
        email,
        papel,
        origem: "sistema",
        escritorioId,
        idOrigem: dados.idOrigem || null,
        ultimoLoginEm: sql`now()`,
      })
      .returning();
    return criado;
  });
}
