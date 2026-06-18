import { listarMapeamentos } from "@/lib/actions/mapeamento";
import { MapeamentoClient } from "./mapeamento-client";

export const dynamic = "force-dynamic";

export default async function MapeamentoPage() {
  const entradas = await listarMapeamentos();
  return <MapeamentoClient entradas={entradas} />;
}
