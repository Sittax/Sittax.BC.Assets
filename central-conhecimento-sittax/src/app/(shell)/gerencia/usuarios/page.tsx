import { listarEscritorios } from "@/lib/actions/escritorios";
import { listarUsuarios } from "@/lib/actions/usuarios";
import { UsuariosClient } from "./usuarios-client";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const [usuarios, escritorios] = await Promise.all([
    listarUsuarios(),
    listarEscritorios(),
  ]);
  return (
    <UsuariosClient
      usuarios={usuarios}
      escritorios={escritorios.map((e) => ({ id: e.id, nome: e.nome }))}
    />
  );
}
