import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Truck, Fuel } from "lucide-react";
import { Table, Badge, Button, Input, Select, Modal, Card } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";

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
  capacidadeMaxima: "",
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
  const [searchTerm, setSearchTerm] = useState("");
  const [tabFilter, setTabFilter] = useState<"TODOS" | "ADMIN" | "SVO">("TODOS");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([]);
  const [totalVeiculos, setTotalVeiculos] = useState(0);
  const [hasLoadedVeiculos, setHasLoadedVeiculos] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formulario, setFormulario] = useState(formularioVazio);

  const carregarVeiculos = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await apiRequest<{
        data: VeiculoApi[];
        meta: { total: number };
      }>("/veiculos?page=1&pageSize=100", { token });
      setVeiculos(response.data.map(mapearVeiculo));
      setTotalVeiculos(response.meta.total);
      setHasLoadedVeiculos(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar os veículos.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void carregarVeiculos();
  }, [carregarVeiculos]);

  const filteredVeiculos = useMemo(() => {
    const termo = searchTerm.trim().toLocaleLowerCase("pt-BR");
    return veiculos.filter((veiculo) => {
      const correspondeBusca =
        !termo ||
        veiculo.placa.toLocaleLowerCase("pt-BR").includes(termo) ||
        veiculo.modelo.toLocaleLowerCase("pt-BR").includes(termo) ||
        veiculo.combustivel.toLocaleLowerCase("pt-BR").includes(termo);
      const correspondeTipo =
        tabFilter === "TODOS" ||
        (tabFilter === "ADMIN" && veiculo.tipoFrota === "Administrativa") ||
        (tabFilter === "SVO" && veiculo.tipoFrota === "SVO");
      return correspondeBusca && correspondeTipo;
    });
  }, [searchTerm, tabFilter, veiculos]);

  const atualizarFormulario = <K extends keyof FormularioVeiculo>(
    campo: K,
    valor: FormularioVeiculo[K],
  ) => setFormulario((atual) => ({ ...atual, [campo]: valor }));

  const salvarVeiculo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSaving(true);
    try {
      const response = await apiRequest<VeiculoApi>("/veiculos", {
        method: "POST",
        token,
        body: JSON.stringify({
          placa: formulario.placa,
          modelo: formulario.modelo,
          tipoFrota: formulario.tipoFrota,
          capacidadeMaxima: Number(formulario.capacidadeMaxima),
          ano: formulario.ano ? Number(formulario.ano) : undefined,
          combustivel: formulario.combustivel || undefined,
        }),
      });
      setVeiculos((atuais) => [mapearVeiculo(response), ...atuais]);
      setTotalVeiculos((total) => total + 1);
      setHasLoadedVeiculos(true);
      setFormulario(formularioVazio);
      setIsModalOpen(false);
      setSuccessMessage(`Veículo ${response.placa} cadastrado.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o veículo.");
    } finally {
      setIsSaving(false);
    }
  };

  const fecharModal = () => {
    setIsModalOpen(false);
    setFormulario(formularioVazio);
    setErrorMessage("");
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

  const administrativos = veiculos.filter((veiculo) => veiculo.tipoFrota === "Administrativa").length;
  const svo = veiculos.filter((veiculo) => veiculo.tipoFrota === "SVO").length;

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
            setErrorMessage("");
            setIsModalOpen(true);
          }}
          className="rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
        >
          Novo Veículo
        </Button>
      </div>

      {errorMessage && !isModalOpen && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-4.5">
          <span className="text-xs font-medium text-slate-500">Total de veículos</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {hasLoadedVeiculos ? totalVeiculos : "—"}
            </span>
            <span className="text-xs text-slate-400">cadastrados</span>
          </div>
        </Card>
        <Card className="rounded-2xl border border-blue-200/80 bg-blue-50/30 p-4.5">
          <span className="text-xs font-semibold text-blue-700">Frota administrativa</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-900">
              {hasLoadedVeiculos ? administrativos : "—"}
            </span>
            <span className="text-xs font-medium text-blue-600">veículos</span>
          </div>
        </Card>
        <Card className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-4.5">
          <span className="text-xs font-semibold text-rose-700">Frota SVO</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-900">{hasLoadedVeiculos ? svo : "—"}</span>
            <span className="text-xs font-medium text-rose-600">veículos</span>
          </div>
        </Card>
      </div>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-md">
          <Input
            placeholder="Buscar por placa, modelo ou combustível..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            leftIcon={<Search className="h-4 w-4 text-slate-400" />}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-slate-100 p-1">
          {([
            ["TODOS", `Todos (${hasLoadedVeiculos ? totalVeiculos : "—"})`],
            ["ADMIN", `Administrativa (${hasLoadedVeiculos ? administrativos : "—"})`],
            ["SVO", `SVO (${hasLoadedVeiculos ? svo : "—"})`],
          ] as const).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTabFilter(filter)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                tabFilter === filter ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Table
        columns={columns}
        data={filteredVeiculos}
        keyExtractor={(item) => item.id}
        emptyMessage={
          isLoading
            ? "Carregando veículos..."
            : errorMessage
              ? "Não foi possível carregar os veículos."
              : "Nenhum veículo cadastrado para esse filtro ou busca."
        }
      />

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
        <form id="formulario-novo-veiculo" onSubmit={salvarVeiculo} className="space-y-4">
          <Input
            label="Placa"
            placeholder="Ex.: BRA2E19"
            value={formulario.placa}
            onChange={(event) => atualizarFormulario("placa", event.target.value)}
            required
          />
          <Input
            label="Modelo e fabricante"
            value={formulario.modelo}
            onChange={(event) => atualizarFormulario("modelo", event.target.value)}
            required
          />
          <Select
            label="Tipo de frota"
            value={formulario.tipoFrota}
            onChange={(event) => atualizarFormulario("tipoFrota", event.target.value as TipoFrotaApi)}
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
              value={formulario.ano}
              onChange={(event) => atualizarFormulario("ano", event.target.value)}
            />
          </div>
          <Input
            label="Tipo de combustível"
            value={formulario.combustivel}
            onChange={(event) => atualizarFormulario("combustivel", event.target.value)}
          />
          {errorMessage && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {errorMessage}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};
