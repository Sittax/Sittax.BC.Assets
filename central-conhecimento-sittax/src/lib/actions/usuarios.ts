"use server";

import { hash } from "@node-rs/argon2";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db/rls";
import { escritorio, usuario } from "@/lib/db/schema";
import { normalizarEmail } from "@/lib/auth/mirror";
import { exigirMaster, type ActionResult } from "./gate";

export interface UsuarioListado {
  id: string;
  nome: string;
  sobrenome: string | null;
  email: string;
  papel: "padrao" | "suporte" | "dev" | "master";
  origem: "sistema" | "central";
  ativo: boolean;
  escritorioId: string | null;
  escritorioNome: string | null;
}

export async function listarUsuarios(): Promise<UsuarioListado[]> {
  const sessao = await exigirMaster();
  return withUser(sessao.userId, sessao.papel, async (tx) => {
    const rows = await tx
      .select({
        id: usuario.id,
        nome: usuario.nome,
        sobrenome: usuario.sobrenome,
        email: usuario.email,
        papel: usuario.papel,
        origem: usuario.origem,
        ativo: usuario.ativo,
        escritorioId: usuario.escritorioId,
        escritorioNome: escritorio.nome,
      })
      .from(usuario)
      .leftJoin(escritorio, eq(usuario.escritorioId, escritorio.id))
      .orderBy(asc(usuario.nome));
    return rows;
  });
}

const baseSchema = z.object({
  nome: z.string().trim().min(1, "informe o nome"),
  sobrenome: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  papel: z.enum(["padrao", "suporte", "dev", "master"]),
  escritorioId: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().uuid().nullable()),
});

function validarPapelEscritorio(d: {
  papel: string;
  escritorioId: string | null;
}): string | null {
  // FR-012: papel padrão exige escritório (o CHECK do banco garante por baixo)
  if (d.papel === "padrao" && !d.escritorioId) {
    return "Usuário de papel padrão precisa de um escritório.";
  }
  return null;
}

export async function criarUsuarioCentral(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const parsed = baseSchema
    .extend({
      email: z.string().email("informe um e-mail válido"),
      senha: z.string().min(10, "senha deve ter no mínimo 10 caracteres"),
    })
    .safeParse({
      nome: formData.get("nome") ?? "",
      sobrenome: formData.get("sobrenome") ?? "",
      email: formData.get("email") ?? "",
      senha: formData.get("senha") ?? "",
      papel: formData.get("papel"),
      escritorioId: formData.get("escritorioId") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, mensagem: parsed.error.issues[0].message };
  }
  const erroPapel = validarPapelEscritorio(parsed.data);
  if (erroPapel) return { ok: false, mensagem: erroPapel };

  const senhaHash = await hash(parsed.data.senha);
  try {
    await withUser(sessao.userId, sessao.papel, (tx) =>
      tx.insert(usuario).values({
        nome: parsed.data.nome,
        sobrenome: parsed.data.sobrenome,
        email: normalizarEmail(parsed.data.email),
        papel: parsed.data.papel,
        origem: "central",
        senhaHash,
        escritorioId: parsed.data.escritorioId,
      }),
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, mensagem: "Já existe um usuário com este e-mail." };
    }
    throw err;
  }
  revalidatePath("/gerencia/usuarios");
  return { ok: true, mensagem: "Usuário criado." };
}

export async function editarUsuarioCentral(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const parsed = baseSchema
    .extend({
      id: z.string().uuid(),
      senha: z
        .string()
        .transform((v) => (v === "" ? null : v))
        .pipe(z.string().min(10, "senha deve ter no mínimo 10 caracteres").nullable()),
    })
    .safeParse({
      id: formData.get("id"),
      nome: formData.get("nome") ?? "",
      sobrenome: formData.get("sobrenome") ?? "",
      senha: formData.get("senha") ?? "",
      papel: formData.get("papel"),
      escritorioId: formData.get("escritorioId") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, mensagem: parsed.error.issues[0].message };
  }
  const erroPapel = validarPapelEscritorio(parsed.data);
  if (erroPapel) return { ok: false, mensagem: erroPapel };

  const atualizado = await withUser(sessao.userId, sessao.papel, async (tx) => {
    // só origem central — a policy RLS já restringe; o where é defesa explícita
    return tx
      .update(usuario)
      .set({
        nome: parsed.data.nome,
        sobrenome: parsed.data.sobrenome,
        papel: parsed.data.papel,
        escritorioId: parsed.data.escritorioId,
        ...(parsed.data.senha ? { senhaHash: await hash(parsed.data.senha) } : {}),
      })
      .where(eq(usuario.id, parsed.data.id))
      .returning({ id: usuario.id, origem: usuario.origem });
  });
  if (atualizado.length === 0) {
    return {
      ok: false,
      mensagem: "Usuário espelhado da origem não pode ser editado aqui.",
    };
  }
  revalidatePath("/gerencia/usuarios");
  return { ok: true, mensagem: "Usuário atualizado." };
}

async function alterarAtivo(formData: FormData, ativo: boolean): Promise<ActionResult> {
  const sessao = await exigirMaster();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, mensagem: "Usuário inválido." };
  const rows = await withUser(sessao.userId, sessao.papel, (tx) =>
    tx
      .update(usuario)
      .set({ ativo })
      .where(eq(usuario.id, id.data))
      .returning({ id: usuario.id }),
  );
  if (rows.length === 0) {
    return {
      ok: false,
      mensagem: "Usuário espelhado da origem não pode ser desativado aqui.",
    };
  }
  revalidatePath("/gerencia/usuarios");
  return { ok: true, mensagem: ativo ? "Usuário reativado." : "Usuário desativado." };
}

export async function desativarUsuarioCentral(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return alterarAtivo(formData, false);
}

export async function reativarUsuarioCentral(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return alterarAtivo(formData, true);
}
