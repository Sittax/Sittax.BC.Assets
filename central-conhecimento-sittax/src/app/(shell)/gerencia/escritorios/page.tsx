import {
  listarEscritorios,
  listarProdutosCatalogo,
} from "@/lib/actions/escritorios";
import { EscritoriosClient } from "./escritorios-client";

export const dynamic = "force-dynamic";

export default async function EscritoriosPage() {
  const [escritorios, produtos] = await Promise.all([
    listarEscritorios(),
    listarProdutosCatalogo(),
  ]);
  return <EscritoriosClient escritorios={escritorios} produtos={produtos} />;
}
