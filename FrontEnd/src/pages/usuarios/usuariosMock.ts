import type { UsuarioGestao } from "../../types/usuario";

// Dados sintéticos do layout de Usuários — substituir pela API quando o endpoint existir.
export const USUARIOS_INICIAIS: UsuarioGestao[] = [
  {
    id: "usr-6034",
    codigo: "#6034",
    nome: "Laudelino Santos",
    setor: "Administrativo",
    telefone: "(79)9956-3040",
    email: "laudelino22903@gmail.com",
  },
  {
    id: "usr-6032",
    codigo: "#6032",
    nome: "Marcio Roberto",
    setor: "Diretoria",
    telefone: "(79)93200-2763",
    email: "MRobert203@gmail.com",
  },
  {
    id: "usr-4034",
    codigo: "#4034",
    nome: "João Francisco",
    setor: "LACEN",
    telefone: "(82)9442-3096",
    email: "Chico123JJ@gmail.com",
  },
  {
    id: "usr-6424",
    codigo: "#6424",
    nome: "Eduardo Jorge",
    setor: "T.I",
    telefone: "(71)9933-2457",
    email: "Eddu134@gmail.com",
  },
  {
    id: "usr-7821",
    codigo: "#7821",
    nome: "Micaela Santos",
    setor: "RH",
    telefone: "(79)92837-2622",
    email: "Michaelassssu@gmail.com",
  },
  {
    id: "usr-3097",
    codigo: "#3097",
    nome: "Vitor",
    setor: "Diretoria",
    telefone: "(79)9283-9933",
    email: "1928ViV@gmail.com",
  },
];

export const SETORES = ["Administrativo", "Diretoria", "LACEN", "T.I", "RH"] as const;
