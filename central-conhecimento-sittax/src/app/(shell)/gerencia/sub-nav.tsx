"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubNav({ itens }: { itens: { href: string; rotulo: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="gerencia-subnav" aria-label="Seções da gerência">
      {itens.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`gerencia-aba${pathname.startsWith(i.href) ? " gerencia-aba-ativa" : ""}`}
        >
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
