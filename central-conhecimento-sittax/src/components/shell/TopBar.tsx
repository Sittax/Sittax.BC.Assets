import { AvatarMenu } from "./AvatarMenu";
import { BuscaTopBar } from "./BuscaTopBar";
import { NavModulos } from "./NavModulos";
import { ProductSelector } from "./ProductSelector";
import type { ModuloItem, ProdutoItem, UsuarioTopBar } from "./tipos";

/**
 * Top bar: logo, seletor de produto, navegação de módulos (ex-rail, movida
 * para o cabeçalho por decisão do PO em 2026-06-12), busca e avatar.
 */
export function TopBar({
  produtos,
  produtoSelecionadoId,
  usuario,
  modulos,
}: {
  produtos: ProdutoItem[];
  produtoSelecionadoId: string | null;
  usuario: UsuarioTopBar;
  modulos: ModuloItem[];
}) {
  return (
    <header className="topbar">
      <div className="topbar-esquerda">
        <img src="/logo.png" alt="Sittax Conhecimento" className="logo-img" />
        <ProductSelector produtos={produtos} selecionadoId={produtoSelecionadoId} />
      </div>
      <NavModulos modulos={modulos} />
      <div className="topbar-direita">
        <BuscaTopBar />
        <AvatarMenu usuario={usuario} />
      </div>
    </header>
  );
}
