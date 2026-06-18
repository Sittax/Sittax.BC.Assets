// Utilitários PUROS de CNPJ — sem nenhum import de banco/servidor, para
// poderem entrar em bundles de client components.

/** 14 dígitos, sem máscara (R9). Vazio se a origem não informou. */
export function normalizarCnpj(cnpj: string | null | undefined): string {
  return (cnpj ?? "").replace(/\D/g, "");
}

export function formatarCnpj(cnpj14: string): string {
  return cnpj14.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

/** Validação de CNPJ: 14 dígitos + dígitos verificadores (R9/FR-023). */
export function validarCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const dv = (tamanho: number): number => {
    const pesos =
      tamanho === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, p, i) => acc + p * Number(cnpj[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}
