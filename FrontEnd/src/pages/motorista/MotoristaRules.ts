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
