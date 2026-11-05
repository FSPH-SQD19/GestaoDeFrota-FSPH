import { HttpError } from "../lib/http_error";

export function normalizarTelefone(telefone: string | null | undefined) {
  if (telefone === undefined) return undefined;
  if (telefone === null || !telefone.trim()) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(digitos)) {
    throw new HttpError(400, "Telefone deve conter DDD e 8 ou 9 dígitos.", [
      { campo: "telefone", mensagem: "Telefone deve conter DDD e 8 ou 9 dígitos." },
    ]);
  }
  return digitos.length === 11
    ? digitos.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
    : digitos.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
}
