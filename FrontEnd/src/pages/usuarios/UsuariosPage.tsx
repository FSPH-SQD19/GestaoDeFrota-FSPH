import React, { useMemo, useState } from "react";
import { ChevronDown, MoreVertical, Plus, Search, UserRound } from "lucide-react";
import { Button, Input, Modal, Select, Table } from "../../components/common";
import type { Column } from "../../components/common/Table";
import type { UsuarioGestao } from "../../types/usuario";
import { SETORES, USUARIOS_INICIAIS } from "./usuariosMock";

function formatarDataAtual(data: Date): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(data);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function proximoCodigo(usuarios: UsuarioGestao[]): string {
  const maior = usuarios.reduce((atual, usuario) => {
    const numero = Number(usuario.codigo.replace("#", ""));
    return Number.isNaN(numero) ? atual : Math.max(atual, numero);
  }, 1000);
  return `#${maior + 1}`;
}

export const UsuariosPage: React.FC = () => {
  const [hoje] = useState(() => new Date());
  const [usuarios, setUsuarios] = useState<UsuarioGestao[]>(USUARIOS_INICIAIS);
  const [busca, setBusca] = useState("");
  const [setor, setSetor] = useState<string>("TODOS");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios.filter((usuario) => {
      const noSetor = setor === "TODOS" || usuario.setor === setor;
      const noTexto =
        termo.length === 0 ||
        usuario.nome.toLowerCase().includes(termo) ||
        usuario.email.toLowerCase().includes(termo) ||
        usuario.setor.toLowerCase().includes(termo) ||
        usuario.codigo.toLowerCase().includes(termo);
      return noSetor && noTexto;
    });
  }, [usuarios, busca, setor]);

  const colunas: Column<UsuarioGestao>[] = [
    {
      header: "ID",
      render: (usuario) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-500">
            <UserRound className="h-4 w-4" />
          </div>
          <span className="font-semibold text-slate-800">{usuario.codigo}</span>
        </div>
      ),
    },
    { header: "Nome", render: (usuario) => usuario.nome },
    { header: "Setor", render: (usuario) => usuario.setor },
    { header: "Telefone", render: (usuario) => usuario.telefone },
    {
      header: "E-mail",
      render: (usuario) => (
        <span className="text-slate-700 underline decoration-slate-300 underline-offset-2">
          {usuario.email}
        </span>
      ),
    },
    {
      header: "",
      className: "w-12",
      render: (usuario) => (
        <button
          type="button"
          aria-label={`Ações de ${usuario.nome}`}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 sm:text-sm">
          {formatarDataAtual(hoje)}
        </p>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Usuários
        </h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Input
            aria-label="Buscar usuário"
            placeholder="Buscar usuário"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setModalAberto(true)}
        >
          Novo usuário
        </Button>
        <div className="relative">
          <Button
            variant="outline"
            rightIcon={<ChevronDown className="h-4 w-4" />}
            onClick={() => setFiltroAberto((aberto) => !aberto)}
          >
            Filtrar
          </Button>
          {filtroAberto && (
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <FiltroOpcao
                ativo={setor === "TODOS"}
                onClick={() => {
                  setSetor("TODOS");
                  setFiltroAberto(false);
                }}
              >
                Todos os setores
              </FiltroOpcao>
              {SETORES.map((item) => (
                <FiltroOpcao
                  key={item}
                  ativo={setor === item}
                  onClick={() => {
                    setSetor(item);
                    setFiltroAberto(false);
                  }}
                >
                  {item}
                </FiltroOpcao>
              ))}
            </div>
          )}
        </div>
      </div>

      <Table
        columns={colunas}
        data={visiveis}
        keyExtractor={(usuario) => usuario.id}
        emptyMessage="Nenhum usuário encontrado."
      />

      <NovoUsuarioModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onCreate={(dados) => {
          const codigo = proximoCodigo(usuarios);
          setUsuarios((atual) => [
            {
              id: `usr-${codigo.replace("#", "")}`,
              codigo,
              ...dados,
            },
            ...atual,
          ]);
          setModalAberto(false);
        }}
      />
    </div>
  );
};

function FiltroOpcao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold ${
        ativo ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function NovoUsuarioModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (dados: Omit<UsuarioGestao, "id" | "codigo">) => void;
}) {
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState<string>(SETORES[0]);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function limpar() {
    setNome("");
    setSetor(SETORES[0]);
    setTelefone("");
    setEmail("");
    setErro(null);
  }

  function salvar() {
    if (!nome.trim() || !telefone.trim() || !email.trim()) {
      setErro("Preencha nome, telefone e e-mail.");
      return;
    }
    onCreate({
      nome: nome.trim(),
      setor,
      telefone: telefone.trim(),
      email: email.trim(),
    });
    limpar();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        limpar();
        onClose();
      }}
      title="Novo usuário"
      description="O cadastro fica nesta tela até existir o endpoint."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              limpar();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button variant="primary" onClick={salvar}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Nome" value={nome} onChange={(event) => setNome(event.target.value)} />
        <Select
          label="Setor"
          value={setor}
          onChange={(event) => setSetor(event.target.value)}
          options={SETORES.map((item) => ({ value: item, label: item }))}
        />
        <Input
          label="Telefone"
          value={telefone}
          onChange={(event) => setTelefone(event.target.value)}
        />
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {erro && <p className="text-sm text-rose-600">{erro}</p>}
      </div>
    </Modal>
  );
}
