import React, { useMemo, useState } from "react";
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

interface FormularioMotorista {
  nome: string;
  cpf: string;
  numeroCnh: string;
  categoriaCnh: string;
  validadeCnh: string;
  contato: string;
  email: string;
  senha: string;
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
  cpf: "",
  numeroCnh: "",
  categoriaCnh: "",
  validadeCnh: "",
  contato: "",
  email: "",
  senha: "",
};

const dataHojeIso = () => {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
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
  "Em rota": "info",
  Disponível: "success",
  Indisponível: "warning",
  Inativo: "neutral",
};

const motoristas: Motorista[] = [];

export const MotoristasPage: React.FC = () => {
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

  const fecharCadastro = () => {
    setModalCadastroAberto(false);
    setFormulario(formularioVazio);
    setCpfTocado(false);
    setErroCadastro("");
    setCadastroValidado(false);
  };

  const cadastrarMotorista = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCpfTocado(true);
    setErroCadastro("");
    setCadastroValidado(false);

    if (!cpfValido(formulario.cpf)) {
      setErroCadastro("Informe um CPF válido.");
      return;
    }

    if (!formulario.nome.trim()) {
      setErroCadastro("Informe o nome completo do motorista.");
      return;
    }

    setCadastroValidado(true);
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
  }, [filtroCnhAtencao, filtros, termoBusca]);

  const emServico = motoristas.filter((motorista) => motorista.status === "Em rota").length;
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
          onClick={() => setModalCadastroAberto(true)}
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
                { value: "Em rota", label: "Em rota" },
                { value: "Disponível", label: "Disponível" },
                { value: "Indisponível", label: "Indisponível" },
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

      <Table
        columns={colunas}
        data={motoristasFiltrados}
        keyExtractor={(motorista) => motorista.id}
        emptyMessage="Nenhum motorista cadastrado."
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
        description="Preencha os dados pessoais, da CNH e da conta de acesso."
        footer={
          <>
            <Button variant="ghost" onClick={fecharCadastro}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="formulario-novo-motorista">
              Salvar
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
                maxLength={150}
                required
                value={formulario.nome}
                onChange={(event) => atualizarFormulario("nome", event.target.value)}
                placeholder="Nome completo do motorista"
              />
            </div>
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
              maxLength={20}
              required
              value={formulario.numeroCnh}
              onChange={(event) => atualizarFormulario("numeroCnh", event.target.value)}
              placeholder="Número da habilitação"
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
              required
              value={formulario.validadeCnh}
              onChange={(event) => atualizarFormulario("validadeCnh", event.target.value)}
            />
            <Input
              label="Telefone para contato"
              type="tel"
              autoComplete="tel"
              maxLength={20}
              required
              value={formulario.contato}
              onChange={(event) => atualizarFormulario("contato", event.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Conta de acesso</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="E-mail"
                type="email"
                autoComplete="email"
                maxLength={150}
                required
                value={formulario.email}
                onChange={(event) => atualizarFormulario("email", event.target.value)}
                placeholder="motorista@exemplo.com"
              />
              <Input
                label="Senha inicial"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={formulario.senha}
                onChange={(event) => atualizarFormulario("senha", event.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>
          </div>

          {erroCadastro && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {erroCadastro}
            </p>
          )}
          {cadastroValidado && (
            <p role="status" className="text-sm font-medium text-slate-600">
              Dados válidos. Nenhum cadastro foi enviado.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};
