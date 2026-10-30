import React, { useEffect, useRef, useState } from "react";
import { Plus, Search, Truck, Fuel } from "lucide-react";
import { Table, Badge, Button, Input, Select, Modal, Card } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";
import { veiculoSchema } from "./veiculoRules";

type TipoFrotaApi = "ADMINISTRATIVA" | "SVO";
type StatusVeiculoApi = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO" | "DESINFECCAO";

interface VeiculoApi {
  id: string;
  placa: string;
  modelo: string;
  tipoFrota: TipoFrotaApi;
  capacidadeMaxima: number;
  combustivel: string | null;
  ano: number | null;
  status: StatusVeiculoApi;
}

interface VeiculoItem {
  id: string;
  placa: string;
  modelo: string;
  tipoFrota: "Administrativa" | "SVO";
  capacidade: number;
  combustivel: string;
  ano: number | null;
  status: "Disponível" | "Em viagem" | "Manutenção" | "Desinfecção";
}

interface FormularioVeiculo {
  placa: string;
  modelo: string;
  tipoFrota: TipoFrotaApi;
  capacidadeMaxima: string;
  ano: string;
  combustivel: string;
}

const formularioVazio: FormularioVeiculo = {
  placa: "",
  modelo: "",
  tipoFrota: "ADMINISTRATIVA",
  capacidadeMaxima: "4",
  ano: "",
  combustivel: "",
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
    id: veiculo.id,
    placa: veiculo.placa,
    modelo: veiculo.modelo,
    tipoFrota: tipoFrotaLabel[veiculo.tipoFrota],
    capacidade: veiculo.capacidadeMaxima,
    combustivel: veiculo.combustivel || "—",
    ano: veiculo.ano,
    status: statusLabel[veiculo.status],
  };
}

export const VeiculosPage: React.FC = () => {
  const { token } = useAuth();
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
  if (consulta.busca) params.set("busca", consulta.busca);
  if (consulta.tipoFrota) params.set("tipoFrota", consulta.tipoFrota);
  const caminho = `/veiculos?${params}`;
  const chave = `${token}_${revisao}_${caminho}`;
  const chaveResumo = `${token}_${revisao}`;
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
    let ativo = true;
    void apiRequest<Resposta>(caminho, { token })
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
  }, [caminho, chave, token]);

  useEffect(() => {
    let ativo = true;
    const total = async (tipo = "") => {
      const dados = await apiRequest<Resposta>(
        `/veiculos?page=1&pageSize=1${tipo ? `&tipoFrota=${tipo}` : ""}`,
        { token },
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
  }, [chaveResumo, token]);

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
        token,
        body: JSON.stringify(validacao.data),
      });
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
      header: "Identificação / Placa",
      render: (veiculo) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-slate-700">
            <Truck className="h-5 w-5 stroke-[1.8]" />
          </div>
          <div>
            <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-slate-900">
              {veiculo.placa}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {veiculo.ano ? `Ano ${veiculo.ano}` : "Ano não informado"}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Modelo do Veículo",
      render: (veiculo) => (
        <div>
          <span className="block text-sm font-bold text-slate-900">{veiculo.modelo}</span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Fuel className="h-3.5 w-3.5 text-slate-400" />
            {veiculo.combustivel}
          </span>
        </div>
      ),
    },
    {
      header: "Frota",
      render: (veiculo) => (
        <Badge variant={veiculo.tipoFrota === "SVO" ? "danger" : "info"} size="md">
          {veiculo.tipoFrota === "SVO" ? "Frota SVO" : "Frota Administrativa"}
        </Badge>
      ),
    },
    {
      header: "Capacidade máxima",
      render: (veiculo) => (
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
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
          <Badge variant={variantMap[veiculo.status]} dot size="md">
            {veiculo.status}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="animate-in space-y-6 fade-in duration-200">
      <div className="flex flex-col gap-4 border-b border-slate-200/60 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
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
          className="rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
        >
          Novo Veículo
        </Button>
      </div>

      {errorMessage && !isModalOpen && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
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
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {successMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-4.5">
          <span className="text-xs font-medium text-slate-500">Total de veículos</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalVeiculos}</span>
            <span className="text-xs text-slate-400">cadastrados</span>
          </div>
        </Card>
        <Card className="rounded-2xl border border-blue-200/80 bg-blue-50/30 p-4.5">
          <span className="text-xs font-semibold text-blue-700">Frota administrativa</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-900">{administrativos}</span>
            <span className="text-xs font-medium text-blue-600">veículos</span>
          </div>
        </Card>
        <Card className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-4.5">
          <span className="text-xs font-semibold text-rose-700">Frota SVO</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-900">{svo}</span>
            <span className="text-xs font-medium text-rose-600">veículos</span>
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
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 p-1">
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
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
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
              className="bg-slate-900 text-white hover:bg-slate-800"
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
              label="Tipo de combustível"
              maxLength={30}
              value={formulario.combustivel}
              onChange={(event) => atualizarFormulario("combustivel", event.target.value)}
            />
          </fieldset>
          {formError && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {formError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};
