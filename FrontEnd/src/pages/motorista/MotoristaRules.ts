import { z } from "zod";

export type StatusMotorista = string;

export interface Motorista {
  id: string;
  nome: string;
  cpf: string;
  numeroCnh: string;
  categoriaCnh: string;
  validadeCnh: string;
  ativo: boolean;
  status: StatusMotorista;
  telefone?: string;
  email?: string;
}

export const categoriasCnh = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "AB",
  "AC",
  "AD",
  "AE",
  "BC",
  "BD",
  "BE",
  "CD",
  "CE",
  "DE",
];

export const formatarCpf = (valor: string) => {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

export const cpfValido = (cpf: string) => {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce(
      (total, digito, index) => total + Number(digito) * (pesoInicial - index),
      0,
    );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiroDigito = calcularDigito(digitos.slice(0, 9), 10);
  if (primeiroDigito !== Number(digitos[9])) return false;

  const segundoDigito = calcularDigito(digitos.slice(0, 10), 11);
  return segundoDigito === Number(digitos[10]);
};

export const motoristaCadastroSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome completo.").max(150),
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.").max(150)),
  senha: z
    .string()
    .refine(
      (senha) => Array.from(senha).length >= 6,
      "A senha deve possuir pelo menos 6 caracteres.",
    )
    .refine(
      (v) => new TextEncoder().encode(v).length <= 72,
      "A senha deve ter no máximo 72 bytes.",
    ),
  telefone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{10,11}$/, "Informe um telefone com DDD e 8 ou 9 dígitos.")),
  cpf: z
    .string()
    .refine(cpfValido, "Informe um CPF válido.")
    .transform((v) => v.replace(/\D/g, "")),
  numeroCnh: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "Número da CNH deve conter 11 dígitos."),
  categoriaCnh: z
    .string()
    .refine((v) => categoriasCnh.includes(v), "Selecione uma categoria de CNH válida."),
  validadeCnh: z.iso
    .date("Informe uma data válida para a CNH.")
    .refine(
      (v) => v >= new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      "A CNH está vencida.",
    ),
});
