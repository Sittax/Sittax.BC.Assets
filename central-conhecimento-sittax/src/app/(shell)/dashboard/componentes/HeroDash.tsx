import Link from "next/link";

type Props = { temProduto: boolean };

export function HeroDash({ temProduto }: Props) {
  return (
    <div className="dash-hero">
      <div className="dash-hero-deco1" />
      <div className="dash-hero-deco2" />
      <div className="dash-hero-corpo">
        <span className="dash-hero-badge">NOVIDADE</span>
        <h2 className="dash-hero-titulo">
          Reforma tributária: o que muda em 2025
        </h2>
      </div>
      {temProduto && (
        <Link href="/base" className="dash-hero-cta">
          Ler na base →
        </Link>
      )}
    </div>
  );
}
