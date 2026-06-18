import type { NotaParaLeitura } from "@/lib/notas/consultas";
import { NotaCard } from "./NotaCard";

type Props = {
  notas: NotaParaLeitura[];
  podeEditar: boolean;
};

export function ListaNotas({ notas, podeEditar }: Props) {
  if (notas.length === 0) {
    return (
      <p className="dash-vazio">
        Nenhuma release note publicada para este produto ainda.
      </p>
    );
  }

  return (
    <div className="notas-lista">
      {notas.map((n) => (
        <NotaCard key={n.id} nota={n} podeEditar={podeEditar} />
      ))}
    </div>
  );
}
