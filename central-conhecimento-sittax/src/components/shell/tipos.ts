import type { Papel } from "@/lib/db/rls";

export interface ProdutoItem {
  id: string;
  nome: string;
  ordem: number;
}

export interface ModuloItem {
  href: string;
  rotulo: string;
  /** nome do ícone lucide usado no Rail */
  icone: "layout-dashboard" | "book-open" | "graduation-cap" | "megaphone" | "shield-check";
}

export interface UsuarioTopBar {
  nome: string;
  sobrenome: string | null;
  papel: Papel;
  escritorioNome: string | null;
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  padrao: "Padrão",
  suporte: "Suporte",
  dev: "Desenvolvedor",
  master: "Master",
};
