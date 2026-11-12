import { SedeVeiculo, GerenciarSedes, type Sede } from "./SedeVeiculo";
import React, { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Table, Badge, Button, Input, Select, Modal, Card } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";
import { veiculoSchema, kmRevisaoFormularioSchema } from "./veiculoRules";
import { IndicadorRevisao } from "./IndicadorRevisao";
import { RevisaoVeiculo } from "./RevisaoVeiculo";
import AlertaDocumentos from "./AlertaDocumentos";
import { ProgramacaoManutencao } from "./ProgramacaoManutencao";

type TipoFrotaApi = "ADMINISTRATIVA" | "SVO";
type PropriedadeApi = "PROPRIO" | "LOCADO";
type StatusVeiculoApi = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO" | "DESINFECCAO";

interface FornecedorApi {
  id: string;
  razaoSocial: string;
  tipoServico: string | null;
  ativo: boolean;
}

interface VeiculoApi {
  sedeId?: string | null;
  foraDeSede?: boolean;
  sedeAtualizadaEm?: string | null;
  sede?: Sede | null;
  id: string;
  placa: string;
  modelo: string;
  tipoFrota: TipoFrotaApi;
  propriedade: PropriedadeApi;
  fornecedorId: string | null;
  capacidadeMaxima: number;
  combustivel: string | null;
  ano: number | null;
  status: StatusVeiculoApi;
  odometroAtual: number;
  kmProximaRevisao: number | null;
}

interface VeiculoItem {
  sedeId?: string | null;
  foraDeSede?: boolean;
  sedeAtualizadaEm?: string | null;
  sede?: Sede | null;
  id: string;
  placa: string;
  modelo: string;
  tipoFrota: "Administrativa" | "SVO";
  propriedade: PropriedadeApi;
  capacidade: number;
  combustivel: string;
  ano: number | null;
  status: "Disponível" | "Em viagem" | "Manutenção" | "Desinfecção";
  odometroAtual: number;
  kmProximaRevisao: number | null;
}

interface FormularioVeiculo {
  placa: string;
  modelo: string;
  tipoFrota: TipoFrotaApi;
  propriedade: PropriedadeApi;
  fornecedorId: string;
  capacidadeMaxima: string;
  ano: string;
  combustivel: string;
  kmProximaRevisao: string;
}

const formularioVazio: FormularioVeiculo = {
  placa: "",
  modelo: "",
  tipoFrota: "ADMINISTRATIVA",
  propriedade: "PROPRIO",
  fornecedorId: "",
  capacidadeMaxima: "4",
  ano: "",
  combustivel: "",
  kmProximaRevisao: "",
};

const tipoFrotaLabel: Record<TipoFrotaApi, VeiculoItem["tipoFrota"]> = {
  ADMINISTRATIVA: "Administrativa",
  SVO: "SVO",
};

const statusLabel: Record<StatusVeiculoApi, VeiculoItem["status"]> = {
  DISPONIVEL: "Disponível",
  EM_VIAGEM: "Em viagem",
  MANUTENCAO: "Manutenção",
  DESINFECCAO: "Desinfecção",
};

function mapearVeiculo(veiculo: VeiculoApi): VeiculoItem {
  return {
    sedeId: veiculo.sedeId,
    foraDeSede: veiculo.foraDeSede,
    sedeAtualizadaEm: veiculo.sedeAtualizadaEm,
    sede: veiculo.sede,
    id: veiculo.id,
    placa: veiculo.placa,
    modelo: veiculo.modelo,
    tipoFrota: tipoFrotaLabel[veiculo.tipoFrota],
    propriedade: veiculo.propriedade ?? "PROPRIO",
    capacidade: veiculo.capacidadeMaxima,
    combustivel: veiculo.combustivel || "—",
    ano: veiculo.ano,
    status: statusLabel[veiculo.status],
    odometroAtual: Number(veiculo.odometroAtual ?? 0),
    kmProximaRevisao: veiculo.kmProximaRevisao == null ? null : Number(veiculo.kmProximaRevisao),
  };
}

export const VeiculosPage: React.FC = () => {
  const { sessionKey, user } = useAuth();
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [erroSedes, setErroSedes] = useState("");
  const [sedeCadastro, setSedeCadastro] = useState("");
  const [filtroSede, setFiltroSede] = useState("");
  const [veiculoSede, setVeiculoSede] = useState<VeiculoItem | null>(null);
  const [gerenciarSedes, setGerenciarSedes] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<VeiculoItem | null>(null);
  const [veiculoProgramacao, setVeiculoProgramacao] = useState<VeiculoItem | null>(null);
  const [veiculoRevisao, setVeiculoRevisao] = useState<VeiculoItem | null>(null);
  const [anoMaximo] = useState(() => new Date().getFullYear() + 1);
  const [searchTerm, setSearchTerm] = useState("");
  const [consulta, setConsulta] = useState({ busca: "", tipoFrota: "", page: 1 });
  const [revisao, setRevisao] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const salvando = useRef(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formulario, setFormulario] = useState(formularioVazio);
  const previaRevisao = kmRevisaoFormularioSchema.safeParse(formulario.kmProximaRevisao);
  const [locadoras, setLocadoras] = useState<FornecedorApi[]>([]);
  const [erroLocadoras, setErroLocadoras] = useState("");
  type Resposta = {
    data: VeiculoApi[];
    meta: { total: number; totalPages: number; page: number; pageSize: number };
  };
  const [resultado, setResultado] = useState<{
    chave: string;
    dados: Resposta | null;
    erro: string;
  } | null>(null);
  const [resumo, setResumo] = useState<{
    chave: string;
    todos: number;
    admin: number;
    svo: number;
    erro: string;
  } | null>(null);
  const params = new URLSearchParams({ page: String(consulta.page), pageSize: "10" });
  if (filtroSede) params.set("sede", filtroSede);
  if (consulta.busca) params.set("busca", consulta.busca);
  if (consulta.tipoFrota) params.set("tipoFrota", consulta.tipoFrota);
  const caminho = `/veiculos?${params}`;
  const chave = `${sessionKey}_${revisao}_${caminho}`;
  const chaveResumo = `${sessionKey}_${revisao}`;
  const atual = resultado?.chave === chave ? resultado : null;
  const contagens = resumo?.chave === chaveResumo ? resumo : null;
  const veiculos = atual?.dados?.data.map(mapearVeiculo) ?? [];
  const meta = atual?.dados?.meta;
  const errorMessage = atual?.erro ?? "";
  const isLoading = !atual;
  const tabFilter =
    consulta.tipoFrota === "ADMINISTRATIVA"
      ? "ADMIN"
      : consulta.tipoFrota === "SVO"
        ? "SVO"
        : "TODOS";
  const totalVeiculos = contagens && !contagens.erro ? contagens.todos : "—";
  const administrativos = contagens && !contagens.erro ? contagens.admin : "—";
  const svo = contagens && !contagens.erro ? contagens.svo : "—";
  const recarregarVeiculos = () => setRevisao((valor) => valor + 1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setConsulta((atual) =>
        atual.busca === searchTerm.trim() ? atual : { ...atual, busca: searchTerm.trim(), page: 1 },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!isModalOpen) return;
    let ativo = true;
    void apiRequest<{ dados: FornecedorApi[] }>("/fornecedores", {})
      .then((resposta) => {
        if (!ativo) return;
        setLocadoras(
          (resposta.dados ?? []).filter(
            (fornecedor) => fornecedor.ativo && fornecedor.tipoServico === "LOCADORA",
          ),
        );
        setErroLocadoras("");
      })
      .catch((error: unknown) => {
        if (!ativo) return;
        setLocadoras([]);
        setErroLocadoras(
          error instanceof Error ? error.message : "Não foi possível carregar as locadoras.",
        );
      });
    return () => {
      ativo = false;
    };
  }, [isModalOpen, sessionKey]);

  useEffect(() => {
    let ativo = true;
    void apiRequest<Resposta>(caminho, {})
      .then((dados) => {
        if (ativo) setResultado({ chave, dados, erro: "" });
      })
      .catch((error: unknown) => {
        if (ativo)
          setResultado({
            chave,
            dados: null,
            erro: error instanceof Error ? error.message : "Não foi possível carregar os veículos.",
          });
      });
    return () => {
      ativo = false;
    };
  }, [caminho, chave, sessionKey]);

  useEffect(() => {
    let ativo = true;
    const total = async (tipo = "") => {
      const dados = await apiRequest<Resposta>(
        `/veiculos?page=1&pageSize=1${tipo ? `&tipoFrota=${tipo}` : ""}`,
        {},
      );
      return dados.meta.total;
    };
    void Promise.all([total(), total("ADMINISTRATIVA"), total("SVO")])
      .then(([todos, admin, svo]) => {
        if (ativo) setResumo({ chave: chaveResumo, todos, admin, svo, erro: "" });
      })
      .catch(() => {
        if (ativo)
          setResumo({
            chave: chaveResumo,
            todos: 0,
            admin: 0,
            svo: 0,
            erro: "Não foi possível carregar as contagens da frota.",
          });
      });
    return () => {
      ativo = false;
    };
  }, [chaveResumo, sessionKey]);

  useEffect(() => {
    let ativo = true;
    void apiRequest<{ data: Sede[] }>("/sedes", {})
      .then((r) => {
        if (ativo) {
          setSedes(r.data);
          setErroSedes("");
        }
      })
      .catch((e) => {
        if (ativo) setErroSedes(e.message);
      });
    return () => {
      ativo = false;
    };
  }, [sessionKey, revisao]);

  const atualizarFormulario = <K extends keyof FormularioVeiculo>(
    campo: K,
    valor: FormularioVeiculo[K],
  ) => setFormulario((atual) => ({ ...atual, [campo]: valor }));

  const salvarVeiculo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (salvando.current) return;
    setFormError("");
    const validacao = veiculoSchema.safeParse(formulario);
    if (!validacao.success) {
      setFormError(validacao.error.issues[0]?.message ?? "Revise os dados do veículo.");
      return;
    }
    salvando.current = true;
    setIsSaving(true);
    setSuccessMessage("");
    try {
      const response = await apiRequest<VeiculoApi>("/veiculos", {
        method: "POST",
        data: {
          ...validacao.data,
          sedeId: sedeCadastro && sedeCadastro !== "FORA_DE_SEDE" ? sedeCadastro : null,
          foraDeSede: sedeCadastro === "FORA_DE_SEDE",
        },
      });
      setSedeCadastro("");
      setFormulario(formularioVazio);
      setIsModalOpen(false);
      setSearchTerm("");
      setConsulta({ busca: "", tipoFrota: "", page: 1 });
      recarregarVeiculos();
      setSuccessMessage(`Veículo ${response.placa} cadastrado.`);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Não foi possível cadastrar o veículo.",
      );
    } finally {
      salvando.current = false;
      setIsSaving(false);
    }
  };

  const fecharModal = () => {
    if (salvando.current) return;
    setIsModalOpen(false);
    setFormulario(formularioVazio);
    setFormError("");
  };

  const columns: Column<VeiculoItem>[] = [
    {
      header: "Sede atual / Atualização",
      render: (v) => (
        <div>
          <p>{v.foraDeSede ? "Fora de sede" : (v.sede?.nome ?? "Sede não informada")}</p>
          <p>
            {v.sedeAtualizadaEm
              ? new Date(v.sedeAtualizadaEm).toLocaleString("pt-BR")
              : "Sem registro"}
          </p>
          <Button size="sm" variant="outline" onClick={() => setVeiculoSede(v)}>
            Detalhes / Editar sede
          </Button>
        </div>
      ),
    },
    {
      header: "Identificação / Placa",
      render: (veiculo) => (
        <div>
          <span className="inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-900">
            {veiculo.placa}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            {veiculo.ano ? `Ano ${veiculo.ano}` : "Ano não informado"}
          </span>
        </div>
      ),
    },
    {
      header: "Modelo do Veículo",
      render: (veiculo) => (
        <div>
          <span className="block text-sm font-semibold text-slate-900">{veiculo.modelo}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{veiculo.combustivel}</span>
        </div>
      ),
    },
    {
      header: "Frota",
      render: (veiculo) => (
        <span className="text-xs font-medium text-slate-700">
          {veiculo.tipoFrota === "SVO" ? "Frota SVO" : "Frota Administrativa"}
        </span>
      ),
    },
    {
      header: "Propriedade",
      render: (veiculo) => (
        <Badge variant={veiculo.propriedade === "LOCADO" ? "warning" : "neutral"} size="md">
          {veiculo.propriedade === "LOCADO" ? "Locado" : "Próprio"}
        </Badge>
      ),
    },
    {
      header: "Capacidade máxima",
      render: (veiculo) => (
        <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">
          {veiculo.capacidade}
        </span>
      ),
    },
    {
      header: "Status Operacional",
      render: (veiculo) => {
        const variantMap = {
          Disponível: "success",
          "Em viagem": "info",
          Manutenção: "warning",
          Desinfecção: "danger",
        } as const;
        return (
          <Badge variant={variantMap[veiculo.status]} dot size="sm">
            {veiculo.status}
          </Badge>
        );
      },
    },
    {
      header: "Manutenção preventiva",
      render: (veiculo) => (
        <Button
          variant="outline"
          size="sm"
          aria-label={`Programação preventiva do veículo ${veiculo.placa}`}
          onClick={() => setVeiculoProgramacao(veiculo)}
        >
          Programação e histórico
        </Button>
      ),
    },
    {
      header: "Revisão preventiva",
      render: (veiculo) => (
        <Button
          variant="outline"
          size="sm"
          aria-label={`Ver revisão do veículo ${veiculo.placa}`}
          onClick={() => setVeiculoRevisao(veiculo)}
        >
          Ver revisão
        </Button>
      ),
    },
    {
      header: "Documentos",
      render: (veiculo) => (
        <Button
          variant="outline"
          size="sm"
          aria-label={`Ver documentos do veículo ${veiculo.placa}`}
          onClick={() => setVeiculoSelecionado(veiculo)}
        >
          Ver documentos
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Gestão da Frota de Veículos
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Consulte e mantenha os veículos cadastrados na frota.
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setFormError("");
            setIsModalOpen(true);
          }}
        >
          Novo Veículo
        </Button>
      </div>

      {errorMessage && !isModalOpen && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {errorMessage}
          <Button variant="outline" size="sm" onClick={recarregarVeiculos}>
            Tentar novamente
          </Button>
        </div>
      )}
      {contagens?.erro && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-rose-700">
          {contagens.erro}
          <Button variant="outline" size="sm" onClick={recarregarVeiculos}>
            Recarregar contagens
          </Button>
        </div>
      )}
      {successMessage && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {successMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-xs font-semibold text-slate-500">Total de veículos</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{totalVeiculos}</span>
            <span className="text-xs text-slate-500">cadastrados</span>
          </div>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold text-slate-500">Frota administrativa</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {administrativos}
            </span>
            <span className="text-xs text-slate-500">veículos</span>
          </div>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold text-slate-500">Frota SVO</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{svo}</span>
            <span className="text-xs text-slate-500">veículos</span>
          </div>
        </Card>
      </div>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-md">
          <Input
            aria-label="Buscar veículo"
            maxLength={100}
            placeholder="Buscar por placa ou modelo..."
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
            }}
            leftIcon={<Search className="h-4 w-4 text-slate-400" />}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1">
          {(
            [
              ["TODOS", `Todos (${totalVeiculos})`],
              ["ADMIN", `Administrativa (${administrativos})`],
              ["SVO", `SVO (${svo})`],
            ] as const
          ).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              aria-pressed={tabFilter === filter}
              onClick={() =>
                setConsulta((atual) => ({
                  ...atual,
                  page: 1,
                  tipoFrota: filter === "ADMIN" ? "ADMINISTRATIVA" : filter === "SVO" ? "SVO" : "",
                }))
              }
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                tabFilter === filter
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {erroSedes && <p role="alert">{erroSedes}</p>}
      <Select
        label="Filtrar por sede"
        value={filtroSede}
        onChange={(e) => {
          setFiltroSede(e.target.value);
          setConsulta((a) => ({ ...a, page: 1 }));
        }}
        options={[
          { value: "", label: "Todas as sedes" },
          { value: "SEM_SEDE", label: "Sede não informada" },
          { value: "FORA_DE_SEDE", label: "Fora de sede" },
          ...sedes.map((s) => ({ value: s.id, label: s.nome + (s.ativo ? "" : " (inativa)") })),
        ]}
      />
      {user?.roles.includes("ADMIN") && (
        <Button onClick={() => setGerenciarSedes(true)}>Gerenciar sedes</Button>
      )}
      <Modal
        isOpen={veiculoSede !== null || gerenciarSedes}
        onClose={() => {
          setVeiculoSede(null);
          setGerenciarSedes(false);
        }}
        title={veiculoSede ? `Sede do veículo ${veiculoSede.placa}` : "Gerenciar sedes"}
      >
        {veiculoSede ? (
          <SedeVeiculo
            key={veiculoSede.id}
            veiculo={veiculoSede}
            onAtualizado={() => {
              recarregarVeiculos();
              setVeiculoSede(null);
            }}
          />
        ) : (
          gerenciarSedes && <GerenciarSedes onAtualizado={recarregarVeiculos} />
        )}
      </Modal>
      <Table
        columns={columns}
        data={veiculos}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyMessage={
          isLoading
            ? "Carregando veículos..."
            : errorMessage
              ? "Não foi possível carregar os veículos."
              : "Nenhum veículo cadastrado para esse filtro ou busca."
        }
      />

      {meta && meta.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Página {meta.page} de {meta.totalPages} · {meta.total} veículos
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || consulta.page <= 1}
              onClick={() => setConsulta((atual) => ({ ...atual, page: atual.page - 1 }))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || consulta.page >= meta.totalPages}
              onClick={() => setConsulta((atual) => ({ ...atual, page: atual.page + 1 }))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={veiculoProgramacao !== null}
        onClose={() => setVeiculoProgramacao(null)}
        title="Manutenção preventiva"
        size="xl"
        description={
          veiculoProgramacao
            ? `${veiculoProgramacao.placa} · ${veiculoProgramacao.modelo}`
            : undefined
        }
      >
        {veiculoProgramacao && (
          <ProgramacaoManutencao key={veiculoProgramacao.id} veiculoId={veiculoProgramacao.id} />
        )}
      </Modal>

      <Modal
        isOpen={veiculoRevisao !== null}
        onClose={() => setVeiculoRevisao(null)}
        title="Revisão preventiva"
        description={
          veiculoRevisao ? `${veiculoRevisao.placa} · ${veiculoRevisao.modelo}` : undefined
        }
      >
        {veiculoRevisao && (
          <RevisaoVeiculo
            key={veiculoRevisao.id}
            veiculoId={veiculoRevisao.id}
            odometroAtual={veiculoRevisao.odometroAtual}
            kmProximaRevisao={veiculoRevisao.kmProximaRevisao}
            onAtualizado={(kmProximaRevisao) => {
              setVeiculoRevisao((atual) =>
                atual?.id === veiculoRevisao.id ? { ...atual, kmProximaRevisao } : atual,
              );
              recarregarVeiculos();
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={veiculoSelecionado !== null}
        onClose={() => setVeiculoSelecionado(null)}
        title="Documentos do veículo"
        description={
          veiculoSelecionado
            ? `${veiculoSelecionado.placa} · ${veiculoSelecionado.modelo}`
            : undefined
        }
      >
        {veiculoSelecionado && <AlertaDocumentos veiculoId={veiculoSelecionado.id} />}
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={fecharModal}
        title="Cadastrar novo veículo"
        description="Os dados serão salvos no cadastro da frota."
        footer={
          <>
            <Button variant="ghost" onClick={fecharModal} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="formulario-novo-veiculo"
              isLoading={isSaving}
            >
              Salvar veículo
            </Button>
          </>
        }
      >
        <form
          id="formulario-novo-veiculo"
          onSubmit={salvarVeiculo}
          className="space-y-4"
          noValidate
        >
          <fieldset disabled={isSaving} className="space-y-4">
            <Select
              label="Sede atual"
              value={sedeCadastro}
              onChange={(e) => setSedeCadastro(e.target.value)}
              options={[
                { value: "", label: "Sede não informada" },
                { value: "FORA_DE_SEDE", label: "Fora de sede" },
                ...sedes.filter((s) => s.ativo).map((s) => ({ value: s.id, label: s.nome })),
              ]}
            />
            <Input
              label="Placa"
              placeholder="Ex.: BRA2E19"
              maxLength={8}
              value={formulario.placa}
              onChange={(event) => atualizarFormulario("placa", event.target.value)}
              required
            />
            <Input
              label="Modelo e fabricante"
              maxLength={100}
              value={formulario.modelo}
              onChange={(event) => atualizarFormulario("modelo", event.target.value)}
              required
            />
            <Select
              label="Tipo de frota"
              value={formulario.tipoFrota}
              onChange={(event) =>
                atualizarFormulario("tipoFrota", event.target.value as TipoFrotaApi)
              }
              options={[
                { value: "ADMINISTRATIVA", label: "Frota administrativa" },
                { value: "SVO", label: "Frota SVO" },
              ]}
            />
            <Select
              label="Propriedade"
              value={formulario.propriedade}
              onChange={(event) => {
                const propriedade = event.target.value as PropriedadeApi;
                setFormulario((atual) => ({
                  ...atual,
                  propriedade,
                  fornecedorId: propriedade === "LOCADO" ? atual.fornecedorId : "",
                }));
              }}
              options={[
                { value: "PROPRIO", label: "Próprio" },
                { value: "LOCADO", label: "Locado" },
              ]}
            />
            {formulario.propriedade === "LOCADO" && (
              <Select
                label="Locadora"
                value={formulario.fornecedorId}
                onChange={(event) => atualizarFormulario("fornecedorId", event.target.value)}
                options={[
                  { value: "", label: "Selecione a locadora" },
                  ...locadoras.map((locadora) => ({
                    value: locadora.id,
                    label: locadora.razaoSocial,
                  })),
                ]}
              />
            )}
            {formulario.propriedade === "LOCADO" && erroLocadoras && (
              <p role="alert" className="text-sm font-medium text-rose-600">
                {erroLocadoras}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Capacidade máxima"
                type="number"
                min="1"
                max="50"
                value={formulario.capacidadeMaxima}
                onChange={(event) => atualizarFormulario("capacidadeMaxima", event.target.value)}
                required
              />
              <Input
                label="Ano de fabricação"
                type="number"
                min="1950"
                max={anoMaximo}
                value={formulario.ano}
                onChange={(event) => atualizarFormulario("ano", event.target.value)}
              />
            </div>
            <Input
              label="Próxima revisão (km)"
              type="number"
              min="0.01"
              max="99999999.99"
              step="0.01"
              value={formulario.kmProximaRevisao}
              onChange={(event) => atualizarFormulario("kmProximaRevisao", event.target.value)}
              helperText="Opcional. Informe a leitura prevista no odômetro para a próxima revisão."
            />
            {previaRevisao.success && previaRevisao.data !== null && (
              <IndicadorRevisao odometroAtual={0} kmProximaRevisao={previaRevisao.data} />
            )}
            <Input
              label="Tipo de combustível"
              maxLength={30}
              value={formulario.combustivel}
              onChange={(event) => atualizarFormulario("combustivel", event.target.value)}
            />
          </fieldset>
          {formError && (
            <p role="alert" className="text-sm font-medium text-rose-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};
