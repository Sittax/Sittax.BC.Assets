"use client";

import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ModuloItem } from "./tipos";

const ICONES: Record<ModuloItem["icone"], LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  megaphone: Megaphone,
  "shield-check": ShieldCheck,
};

/**
 * Navegação de módulos no cabeçalho (substitui o rail lateral por decisão do
 * PO em 2026-06-12). Em mobile vira barra inferior fixa (CSS). A lista chega
 * filtrada por papel PELO SERVIDOR — aqui é só apresentação.
 */
export function NavModulos({ modulos }: { modulos: ModuloItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav-modulos" aria-label="Módulos">
      <ul className="nav-modulos-lista">
        {modulos.map((m) => {
          const Icone = ICONES[m.icone];
          const ativo = pathname === m.href || pathname.startsWith(`${m.href}/`);
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                className={`nav-modulos-item${ativo ? " nav-modulos-item-ativo" : ""}`}
                aria-label={m.rotulo}
                aria-current={ativo ? "page" : undefined}
                title={m.rotulo}
              >
                <Icone size={18} aria-hidden />
                <span className="nav-modulos-rotulo">{m.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
