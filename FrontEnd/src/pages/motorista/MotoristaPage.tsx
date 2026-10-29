import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Filter,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select, Table } from "../../components/common";
import type { Column } from "../../components/common/Table";
import {
  categoriasCnh,
  cpfValido,
  formatarCpf,
  type Motorista,
  type StatusMotorista,
} from "./MotoristaRules";
import { useAuth } from "../../contexts/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface FormularioMotorista {
  nome: string;
  email: string;
  senha: string;
  telefone: string;
  cpf: string;
  numeroCnh: string;
  categoriaCnh: string;
  validadeCnh: string;
}

interface FiltrosMotoristas {
  id: string;
  nome: string;
  validadeCnh: string;
  status: string;
  contato: string;
}

const formularioVazio: FormularioMotorista = {
  nome: "",
  email: "",
  senha: "",
  telefone: "",
  cpf: "",
  numeroCnh: "",
  categoriaCnh: "",
  validadeCnh: "",
};

const dataHojeIso = () => {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};

const formatarTelefone = (valor: string) => {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 10) {
    return digitos.replace(/^(\d{2})(\d{0,4})(\d{0,4})$/, (_, ddd, parte1, parte2) =>
      parte2 ? `(${ddd}) ${parte1}-${parte2}` : `(${ddd}) ${parte1}`,
    );
  }
  return digitos.replace(/^(\d{2})(\d{0,5})(\d{0,4})$/, (_, ddd, parte1, parte2) =>
    parte2 ? `(${ddd}) ${parte1}-${parte2}` : `(${ddd}) ${parte1}`,
  );
};

const formatarData = (data: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${data}T00:00:00Z`));

const diasAteVencimento = (data: string) => {
  const paraDiaUtc = (dataIso: string) => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso);
    if (!partes) return Number.NaN;
    return Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  };

  return (paraDiaUtc(data) - paraDiaUtc(dataHojeIso())) / (1000 * 60 * 60 * 24);
};

const filtrosVazios: FiltrosMotoristas = {
  id: "",
  nome: "",
  validadeCnh: "",
  status: "",
  contato: "",
};

const statusVariant: Record<StatusMotorista, "info" | "success" | "warning" | "neutral"> = {
  "Em Rota": "info",
  Disponível: "success",
  Inativo: "neutral",
};

const statusPorApi: Record<string, StatusMotorista> = {
  DISPONIVEL: "Disponível",
  INATIVO: "Inativo",
  EM_ROTA: "Em Rota",
};

interface MotoristaApi {
  id: string;
  cpf: string;
  numeroCnh: string;
  categoriaCnh: string | null;
  validadeCnh: string;
  telefone: string | null;
  status: string;
  ativo: boolean;
  usuario: { nome: string; email: string } | null;
}

function mapearMotoristaApi(valor: unknown): Motorista {
  if (!valor || typeof valor !== "object") {
    throw new Error("A API retornou um cadastro de motorista inválido.");
  }

  const motoristaApi = valor as Partial<MotoristaApi>;
  if (
    typeof motoristaApi.id !== "string" ||
    typeof motoristaApi.cpf !== "string" ||
    typeof motoristaApi.numeroCnh !== "string" ||
    typeof motoristaApi.validadeCnh !== "string" ||
    typeof motoristaApi.status !== "string"
  ) {
    throw new Error("A API retornou dados incompletos de um motorista.");
  }

  const status = motoristaApi.ativo === false
    ? "Inativo"
    : statusPorApi[motoristaApi.status.toUpperCase()];
  if (!status) {
    throw new Error(`Status de motorista não suportado pela tela: ${motoristaApi.status}`);
  }

  const validadeCnh = motoristaApi.validadeCnh.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validadeCnh)) {
    throw new Error("A API retornou uma validade de CNH inválida.");
  }

  return {
    id: motoristaApi.id,
    nome:
      motoristaApi.usuario && typeof motoristaApi.usuario.nome === "string"
        ? motoristaApi.usuario.nome
        : "Sem usuário associado",
    cpf: motoristaApi.cpf,
    numeroCnh: motoristaApi.numeroCnh,
    categoriaCnh:
      typeof motoristaApi.categoriaCnh === "string" ? motoristaApi.categoriaCnh : "",
    validadeCnh,
    status,
    contato: typeof motoristaApi.telefone === "string" ? motoristaApi.telefone : "",
    email:
      motoristaApi.usuario && typeof motoristaApi.usuario.email === "string"
        ? motoristaApi.usuario.email
        : undefined,
  };
}

async function mensagemErroApi(resposta: Response): Promise<string> {
  const corpo = (await resposta.json().catch(() => null)) as
    | { mensagem?: string; message?: string }
    | null;

  return (
    corpo?.mensagem ??
    corpo?.message ??
    (resposta.status === 401 || resposta.status === 403
      ? "A API recusou a autenticação. Entre com uma sessão válida para consultar motoristas."
      : `Não foi possível consultar os motoristas (HTTP ${resposta.status}).`)
  );
}

async function buscarMotoristas(token: string): Promise<Motorista[]> {
  const resposta = await fetch(`${API_URL}/motoristas`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) {
    throw new Error(await mensagemErroApi(resposta));
  }

  const dados: unknown = await resposta.json();
  if (!Array.isArray(dados)) {
    throw new Error("A API retornou uma lista de motoristas inválida.");
  }

  return dados.map(mapearMotoristaApi);
}

export const MotoristasPage: React.FC = () => {
  const { token } = useAuth();
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [carregandoMotoristas, setCarregandoMotoristas] = useState(Boolean(token));
  const [erroLista, setErroLista] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [filtroCnhAtencao, setFiltroCnhAtencao] = useState(false);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<Motorista | null>(null);
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [formulario, setFormulario] = useState(formularioVazio);
  const [cpfTocado, setCpfTocado] = useState(false);
  const [erroCadastro, setErroCadastro] = useState("");
  const [cadastroValidado, setCadastroValidado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const tentativaCadastroRef = useRef(0);

  useEffect(() => {
    if (!token) return;

    let ativa = true;
    void buscarMotoristas(token)
      .then((dados) => {
        if (ativa) {
          setErroLista("");
          setMotoristas(dados);
        }
      })
      .catch((error: unknown) => {
        if (ativa) {
          setMotoristas([]);
          setErroLista(
            error instanceof Error
              ? error.message
              : "Não foi possível conectar à API para consultar os motoristas.",
          );
        }
      })
      .finally(() => {
        if (ativa) setCarregandoMotoristas(false);
      });

    return () => {
      ativa = false;
    };
  }, [token]);

  const atualizarFormulario = <K extends keyof FormularioMotorista>(
    campo: K,
    valor: FormularioMotorista[K],
  ) => {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    setErroCadastro("");
    setCadastroValidado(false);
  };

  const digitosCpf = formulario.cpf.replace(/\D/g, "");
  const mostrarErroCpf =
    digitosCpf.length > 0 && (cpfTocado || digitosCpf.length === 11) && !cpfValido(formulario.cpf);

  const abrirCadastro = () => {
    tentativaCadastroRef.current += 1;
    setModalCadastroAberto(true);
  };

  const fecharCadastro = () => {
    tentativaCadastroRef.current += 1;
    setModalCadastroAberto(false);
    setFormulario(formularioVazio);
    setCpfTocado(false);
    setErroCadastro("");
    setCadastroValidado(false);
    setSalvando(false);
  };

  const cadastrarMotorista = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCpfTocado(true);
    setErroCadastro("");
    setCadastroValidado(false);

    if (!cpfValido(formulario.cpf)) {
      setErroCadastro("Informe um CPF válido.");
      return;
    }

    if (!token) {
      setErroCadastro("Sua sessão expirou. Entre novamente para cadastrar o motorista.");
      return;
    }

    if (!formulario.nome.trim() || !formulario.email.trim() || !formulario.senha) {
      setErroCadastro("Informe nome, e-mail e senha para a conta do motorista.");
      return;
    }

    if (formulario.senha.length < 4) {
      setErroCadastro("A senha deve possuir pelo menos 4 caracteres.");
      return;
    }

    if (![10, 11].includes(formulario.telefone.replace(/\D/g, "").length)) {
      setErroCadastro("Informe um telefone com DDD e 8 ou 9 dígitos.");
      return;
    }

    const idTentativa = ++tentativaCadastroRef.current;
    const tentativaAindaAtiva = () =>
      modalCadastroAberto && tentativaCadastroRef.current === idTentativa;

    setSalvando(true);

    try {
      const resposta = await fetch(`${API_URL}/motoristas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: formulario.nome.trim(),
          email: formulario.email.trim(),
          senha: formulario.senha,
          telefone: formulario.telefone,
          cpf: formulario.cpf.replace(/\D/g, ""),
          numeroCnh: formulario.numeroCnh.trim(),
          categoriaCnh: formulario.categoriaCnh,
          validadeCnh: formulario.validadeCnh,
        }),
      });

      if (!resposta.ok) {
        throw new Error(await mensagemErroApi(resposta));
      }

      if (tentativaAindaAtiva()) {
        setCadastroValidado(true);
      }

      try {
        const dados = await buscarMotoristas(token);
        setErroLista("");
        setMotoristas(dados);
      } catch (error) {
        setErroLista(
          error instanceof Error
            ? `O cadastro foi realizado, mas a lista não foi atualizada: ${error.message}`
            : "O cadastro foi realizado, mas não foi possível atualizar a lista.",
        );
      }
    } catch (error) {
      if (tentativaAindaAtiva()) {
        setErroCadastro(
          error instanceof Error
            ? error.message
            : "Não foi possível conectar à API para cadastrar o motorista.",
        );
      }
    } finally {
      if (tentativaAindaAtiva()) {
        setSalvando(false);
      }
    }
  };

  const motoristasFiltrados = useMemo(() => {
    const busca = termoBusca.trim().toLocaleLowerCase("pt-BR");

    return motoristas.filter((motorista) => {
      const diasParaVencimento = diasAteVencimento(motorista.validadeCnh);
      const cnhPrecisaAtencao = motorista.status !== "Inativo" && diasParaVencimento <= 30;
      const correspondeBusca =
        !busca ||
        motorista.id.toLocaleLowerCase("pt-BR").includes(busca) ||
        motorista.nome.toLocaleLowerCase("pt-BR").includes(busca);

      return (
        (!filtroCnhAtencao || cnhPrecisaAtencao) &&
        correspondeBusca &&
        motorista.id
          .toLocaleLowerCase("pt-BR")
          .includes(filtros.id.trim().toLocaleLowerCase("pt-BR")) &&
        motorista.nome
          .toLocaleLowerCase("pt-BR")
          .includes(filtros.nome.trim().toLocaleLowerCase("pt-BR")) &&
        (!filtros.validadeCnh || motorista.validadeCnh === filtros.validadeCnh) &&
        (!filtros.status || motorista.status === filtros.status) &&
        motorista.contato.replace(/\D/g, "").includes(filtros.contato.replace(/\D/g, ""))
      );
    });
  }, [filtroCnhAtencao, filtros, motoristas, termoBusca]);

  const emServico = motoristas.filter((motorista) => motorista.status === "Em Rota").length;
  const disponiveis = motoristas.filter((motorista) => motorista.status === "Disponível").length;
  const motoristasComCnhAtencao = motoristas.filter(
    (motorista) => motorista.status !== "Inativo" && diasAteVencimento(motorista.validadeCnh) <= 30,
  );
  const cnHsVencidas = motoristasComCnhAtencao.filter(
    (motorista) => diasAteVencimento(motorista.validadeCnh) <= 0,
  ).length;
  const cnHsVencendo = motoristasComCnhAtencao.length - cnHsVencidas;
  const cardCnhClasses =
    cnHsVencidas > 0
      ? "border-rose-200/80 bg-rose-50/30"
      : cnHsVencendo > 0
        ? "border-amber-200/80 bg-amber-50/30"
        : "border-slate-200/80 bg-white";

  const alternarFiltroCnhAtencao = () => {
    setFiltroCnhAtencao((ativo) => !ativo);
    setTermoBusca("");
    setFiltros(filtrosVazios);
  };

  const colunas: Column<Motorista>[] = [
    {
      header: "ID",
      render: (motorista) => (
        <span className="font-mono text-xs font-bold tracking-wide text-slate-700">
          {motorista.id}
        </span>
      ),
    },
    {
      header: "Nome",
      render: (motorista) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <UserRound className="h-4 w-4" />
          </div>
          <span className="font-semibold text-slate-900">{motorista.nome}</span>
        </div>
      ),
    },
    {
      header: "Vencimento da CNH",
      render: (motorista) => {
        const dias = diasAteVencimento(motorista.validadeCnh);
        const vencida = dias <= 0;
        const proxima = dias > 0 && dias <= 30;

        return (
          <div className="flex items-center gap-2 text-xs">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span
              className={
                vencida
                  ? "font-semibold text-rose-700"
                  : proxima
                    ? "font-semibold text-amber-700"
                    : "text-slate-600"
              }
            >
              {formatarData(motorista.validadeCnh)}
            </span>
            {(vencida || proxima) && (
              <Badge variant={vencida ? "danger" : "warning"} size="sm">
                {vencida ? "Vencida" : "Próxima"}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      header: "Status",
      render: (motorista) => (
        <Badge variant={statusVariant[motorista.status]} dot size="md">
          {motorista.status}
        </Badge>
      ),
    },
    {
      header: "Contato",
      render: (motorista) =>
        motorista.contato ? (
          <a
            href={`tel:${motorista.contato.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900"
          >
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            {motorista.contato}
          </a>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      header: "",
      className: "w-12",
      render: (motorista) => (
        <button
          type="button"
          onClick={() => {
            setMotoristaSelecionado(motorista);
          }}
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title={`Ver detalhes de ${motorista.nome}`}
          aria-label={`Ver detalhes de ${motorista.nome}`}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      ),
    },
  ];

  const atualizarFiltro = (campo: keyof FiltrosMotoristas, valor: string) => {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
  };

  const filtrosAtivos = Object.values(filtros).some(Boolean);

  return (
    <div className="animate-in space-y-6 fade-in duration-200">
      <div className="flex flex-col gap-4 border-b border-slate-200/60 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Gestão de Motoristas
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Acompanhe a disponibilidade da equipe e a validade das CNHs.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={abrirCadastro}
          className="h-11 w-full shrink-0 rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 sm:w-48"
        >
          Novo motorista
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-blue-200/80 bg-blue-50/30 p-4.5">
          <span className="text-xs font-semibold text-blue-700">Motoristas em serviço</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-900">{emServico}</span>
            <span className="text-xs font-medium text-blue-600">em rota</span>
          </div>
        </Card>

        <Card className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4.5">
          <span className="text-xs font-semibold text-emerald-700">Motoristas disponíveis</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-900">{disponiveis}</span>
            <span className="text-xs font-medium text-emerald-600">prontos para atendimento</span>
          </div>
        </Card>

        <button
          type="button"
          onClick={alternarFiltroCnhAtencao}
          aria-pressed={filtroCnhAtencao}
          className={`rounded-2xl border p-4.5 text-left transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${cardCnhClasses} ${
            filtroCnhAtencao ? "ring-2 ring-slate-400 ring-offset-2" : ""
          }`}
        >
          <span
            className={`text-xs font-semibold ${cnHsVencidas > 0 ? "text-rose-700" : cnHsVencendo > 0 ? "text-amber-700" : "text-slate-600"}`}
          >
            CNH com atenção
          </span>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span
              className={`text-2xl font-bold ${cnHsVencidas > 0 ? "text-rose-900" : cnHsVencendo > 0 ? "text-amber-900" : "text-slate-900"}`}
            >
              {cnHsVencidas} vencida{cnHsVencidas === 1 ? "" : "s"}
            </span>
            <span
              className={`text-xs font-medium ${cnHsVencidas > 0 ? "text-rose-700" : cnHsVencendo > 0 ? "text-amber-700" : "text-slate-500"}`}
            >
              · {cnHsVencendo} vencendo em 30 dias
            </span>
          </div>
          <span
            className={`mt-1 block text-xs ${cnHsVencidas > 0 ? "text-rose-600" : cnHsVencendo > 0 ? "text-amber-600" : "text-slate-500"}`}
          >
            {filtroCnhAtencao
              ? "Filtro aplicado — clique para limpar"
              : "Clique para ver motoristas com CNH vencida ou próxima"}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:max-w-md">
            <Input
              placeholder="Buscar motorista por ID ou nome..."
              value={termoBusca}
              onChange={(event) => setTermoBusca(event.target.value)}
              leftIcon={<Search className="h-4 w-4 text-slate-400" />}
            />
          </div>
          <Button
            variant={filtrosAtivos ? "secondary" : "outline"}
            leftIcon={<Filter className="h-4 w-4" />}
            rightIcon={filtrosAtivos ? <span className="text-xs font-bold">●</span> : undefined}
            onClick={() => setFiltrosAbertos((abertos) => !abertos)}
            aria-expanded={filtrosAbertos}
          >
            Filtros
          </Button>
        </div>

        <Button
          variant="primary"
          leftIcon={<Upload className="h-4 w-4" />}
          className="h-11 w-full shrink-0 rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 sm:ml-auto sm:w-48"
        >
          Importar CSV
        </Button>
      </div>

      {filtrosAbertos && (
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Filtrar motoristas</h2>
              <p className="text-xs text-slate-500">
                Refine os resultados por cada informação da tabela.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFiltrosAbertos(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar filtros"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              label="ID"
              placeholder="Ex.: MOT-001"
              value={filtros.id}
              onChange={(event) => atualizarFiltro("id", event.target.value)}
            />
            <Input
              label="Nome"
              placeholder="Nome do motorista"
              value={filtros.nome}
              onChange={(event) => atualizarFiltro("nome", event.target.value)}
            />
            <Input
              label="Vencimento da CNH"
              type="date"
              value={filtros.validadeCnh}
              onChange={(event) => atualizarFiltro("validadeCnh", event.target.value)}
            />
            <Select
              label="Status"
              value={filtros.status}
              onChange={(event) => atualizarFiltro("status", event.target.value)}
              options={[
                { value: "", label: "Todos os status" },
                { value: "Em Rota", label: "Em Rota" },
                { value: "Disponível", label: "Disponível" },
                { value: "Inativo", label: "Inativo" },
              ]}
            />
            <Input
              label="Contato"
              placeholder="Telefone"
              value={filtros.contato}
              onChange={(event) => atualizarFiltro("contato", event.target.value)}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setFiltros(filtrosVazios)}>
              Limpar filtros
            </Button>
          </div>
        </Card>
      )}

      {erroLista && motoristas.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
        >
          {erroLista}
        </div>
      )}

      <Table
        columns={colunas}
        data={motoristasFiltrados}
        keyExtractor={(motorista) => motorista.id}
        isLoading={carregandoMotoristas}
        emptyMessage={
          erroLista ||
          (!token
            ? "Sua sessão expirou. Entre novamente para consultar os motoristas."
            : "Nenhum motorista cadastrado.")
        }
      />

      <Modal
        isOpen={Boolean(motoristaSelecionado)}
        onClose={() => setMotoristaSelecionado(null)}
        title="Dados do motorista"
        description={motoristaSelecionado ? `Cadastro ${motoristaSelecionado.id}` : undefined}
        footer={
          motoristaSelecionado && (
            <Button variant="ghost" onClick={() => setMotoristaSelecionado(null)}>
              Fechar
            </Button>
          )
        }
      >
        {motoristaSelecionado && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-xs">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{motoristaSelecionado.nome}</p>
                <p className="text-xs text-slate-500">{motoristaSelecionado.id}</p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">CPF</dt>
                <dd className="mt-1 font-semibold text-slate-800">{motoristaSelecionado.cpf}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Número da CNH</dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {motoristaSelecionado.numeroCnh}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Categoria da CNH</dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {motoristaSelecionado.categoriaCnh}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Validade da CNH</dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {formatarData(motoristaSelecionado.validadeCnh)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Contato</dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {motoristaSelecionado.contato}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Status</dt>
                <dd className="mt-1">
                  <Badge variant={statusVariant[motoristaSelecionado.status]} dot>
                    {motoristaSelecionado.status}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={modalCadastroAberto}
        onClose={fecharCadastro}
        title="Novo motorista"
        description="Cadastre os dados do motorista e crie sua conta de acesso."
        footer={
          <>
            <Button variant="ghost" onClick={fecharCadastro}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="formulario-novo-motorista"
              disabled={salvando || cadastroValidado}
            >
              {salvando ? "Salvando..." : cadastroValidado ? "Salvo" : "Salvar"}
            </Button>
          </>
        }
      >
        <form id="formulario-novo-motorista" onSubmit={cadastrarMotorista} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Nome completo"
                autoComplete="name"
                required
                maxLength={150}
                value={formulario.nome}
                onChange={(event) => atualizarFormulario("nome", event.target.value)}
                placeholder="Nome do motorista"
              />
            </div>
            <Input
              label="E-mail de acesso"
              type="email"
              autoComplete="email"
              required
              maxLength={150}
              value={formulario.email}
              onChange={(event) => atualizarFormulario("email", event.target.value)}
              placeholder="nome@exemplo.com"
            />
            <Input
              label="Senha inicial"
              type="password"
              autoComplete="new-password"
              required
              minLength={4}
              value={formulario.senha}
              onChange={(event) => atualizarFormulario("senha", event.target.value)}
              placeholder="Mínimo de 4 caracteres"
            />
            <Input
              label="Telefone para contato"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={15}
              value={formulario.telefone}
              onChange={(event) =>
                atualizarFormulario("telefone", formatarTelefone(event.target.value))
              }
              placeholder="(79) 99999-9999"
            />
            <Input
              label="CPF"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              required
              value={formulario.cpf}
              error={mostrarErroCpf ? "CPF inválido" : undefined}
              onBlur={() => setCpfTocado(true)}
              onChange={(event) => {
                atualizarFormulario("cpf", formatarCpf(event.target.value));
              }}
            />
            <Input
              label="Número da CNH"
              inputMode="numeric"
              maxLength={11}
              minLength={11}
              pattern="[0-9]{11}"
              required
              value={formulario.numeroCnh}
              onChange={(event) => atualizarFormulario("numeroCnh", event.target.value)}
              placeholder="11 dígitos"
            />
            <Select
              label="Categoria da CNH"
              required
              value={formulario.categoriaCnh}
              onChange={(event) => atualizarFormulario("categoriaCnh", event.target.value)}
              placeholder="Selecione uma categoria"
              options={categoriasCnh.map((categoria) => ({
                value: categoria,
                label: categoria,
              }))}
            />
            <Input
              label="Validade da CNH"
              type="date"
              min={dataHojeIso()}
              required
              value={formulario.validadeCnh}
              onChange={(event) => atualizarFormulario("validadeCnh", event.target.value)}
            />
          </div>

          {erroCadastro && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {erroCadastro}
            </p>
          )}
          {cadastroValidado && (
            <p role="status" className="text-sm font-medium text-slate-600">
              Motorista cadastrado com sucesso.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};
