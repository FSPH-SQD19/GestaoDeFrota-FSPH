export type ErroDetalhe = { campo: string; mensagem: string };

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: ErroDetalhe[] = [],
  ) {
    super(message);
    this.name = "HttpError";
  }
}
