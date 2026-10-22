import React, { useState, useEffect } from "react";
import { Plus, Search, Truck, Fuel, Eye } from "lucide-react";
import { Table, Badge, Button, Input, Select, Modal, Card } from "../../components/common";
import type { Column } from "../../components/common/Table";

interface VeiculoItem {
  id: string;
  placa: string;
  modelo: string;
  tipoFrota: "Administrativa" | "SVO";
  capacidade: number;
  combustivel: string;
  ano: number;
  status: "Disponível" | "Em viagem" | "Manutenção" | "Desinfecção";
}

export const VeiculosPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tabFilter, setTabFilter] = useState<"TODOS" | "ADMIN" | "SVO">("TODOS");
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Novos estados para gerenciar os dados da API
  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Função para buscar os veículos da API do Express (porta 3000)
  const buscarVeiculos = async (termo = "") => {
    try {
      setCarregando(true);
      const url = termo
        ? `http://localhost:3000/veiculos?busca=${encodeURIComponent(termo)}`
        : "http://localhost:3000/veiculos";

      const resposta = await fetch(url);
      const dados = await resposta.json();
      setVeiculos(dados);
    } catch (erro) {
      console.error("Erro ao buscar veículos da API:", erro);
    } finally {
      setCarregando(false);
    }
  };

  // Carrega a lista assim que a página abre
  useEffect(() => {
    buscarVeiculos();
  }, []);

  // Busca dinâmica conforme o usuário digita no input
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      buscarVeiculos(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const filteredVeiculos = veiculos.filter((v) => {
    if (tabFilter === "ADMIN") return v.tipoFrota === "Administrativa";
    if (tabFilter === "SVO") return v.tipoFrota === "SVO";
    return true;
  });

  const columns: Column<VeiculoItem>[] = [
    {
      header: "Identificação / Placa",
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold shrink-0">
            <Truck className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <span className="font-mono font-bold text-slate-900 text-sm tracking-wider px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
              {v.placa}
            </span>
            <span className="block text-xs text-slate-500 mt-1">Ano {v.ano}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Modelo do Veículo",
      render: (v) => (
        <div>
          <span className="font-bold text-slate-900 text-sm block">{v.modelo}</span>
          <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <Fuel className="w-3.5 h-3.5 text-slate-400" />
            {v.combustivel}
          </span>
        </div>
      ),
    },
    {
      header: "Frota Alocada",
      render: (v) => (
        <Badge variant={v.tipoFrota === "SVO" ? "danger" : "info"} size="md">
          {v.tipoFrota === "SVO" ? "Frota SVO (Óbitos)" : "Frota Administrativa"}
        </Badge>
      ),
    },
    {
      header: "Capacidade",
      render: (v) => (
        <span className="text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
          {v.tipoFrota === "SVO" ? `${v.capacidade} urnas (Portaria)` : `${v.capacidade} ocupantes`}
        </span>
      ),
    },
    {
      header: "Status Operacional",
      render: (v) => {
        const variantMap = {
          Disponível: "success" as const,
          "Em viagem": "info" as const,
          Manutenção: "warning" as const,
          Desinfecção: "danger" as const,
        };
        return (
          <Badge variant={variantMap[v.status]} dot size="md">
            {v.status === "Desinfecção" ? "Em Desinfecção Sanitária" : v.status}
          </Badge>
        );
      },
    },
    {
      header: "Ações",
      render: () => (
        <button
          type="button"
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Ver detalhes do diário de bordo"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Topo da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Gestão da Frota de Veículos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Cadastro, disponibilidade e controle estrito de segregação entre frotas FSPH.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-sm"
        >
          Novo Veículo
        </Button>
      </div>

      {/* 3 Mini Indicadores de Frota */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4.5 rounded-2xl border border-slate-200/80 bg-white">
          <span className="text-xs text-slate-500 font-medium">Total de Veículos</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{veiculos.length}</span>
            <span className="text-xs text-slate-400">cadastrados</span>
          </div>
        </Card>

        <Card className="p-4.5 rounded-2xl border border-blue-200/80 bg-blue-50/30">
          <span className="text-xs text-blue-700 font-semibold">Frota Administrativa</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-900">
              {veiculos.filter((v) => v.tipoFrota === "Administrativa").length}
            </span>
            <span className="text-xs text-blue-600 font-medium">veículos (LACEN / Hemose)</span>
          </div>
        </Card>

        <Card className="p-4.5 rounded-2xl border border-rose-200/80 bg-rose-50/30">
          <span className="text-xs text-rose-700 font-semibold">Frota Especializada SVO</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-900">
              {veiculos.filter((v) => v.tipoFrota === "SVO").length}
            </span>
            <span className="text-xs text-rose-600 font-medium">viaturas (Limite 4 urnas)</span>
          </div>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Campo de Busca */}
        <div className="w-full sm:max-w-md">
          <Input
            placeholder="Buscar por placa, modelo ou combustível..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        {/* Abas de Filtro de Frota */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setTabFilter("TODOS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tabFilter === "TODOS"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Todos ({veiculos.length})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("ADMIN")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tabFilter === "ADMIN"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Administrativa ({veiculos.filter((v) => v.tipoFrota === "Administrativa").length})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("SVO")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tabFilter === "SVO"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            SVO ({veiculos.filter((v) => v.tipoFrota === "SVO").length})
          </button>
        </div>
      </div>

      {/* Indicador visual de carregamento ou Tabela Reutilizável */}
      {carregando ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200/80">
          Carregando veículos da API...
        </div>
      ) : (
        <Table
          columns={columns}
          data={filteredVeiculos}
          keyExtractor={(item) => item.id}
          emptyMessage="Nenhum veículo encontrado com esse filtro ou busca."
        />
      )}

      {/* Modal Reutilizável de Cadastro de Veículo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Novo Veículo"
        description="Atenção à regra de segregação de frota da FSPH (Administrativa vs SVO)."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => setIsModalOpen(false)}
            >
              Salvar Veículo
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Placa (Padrão Mercosul ou CTB)" placeholder="Ex: BRA2E19" required />
          <Input
            label="Modelo e Fabricante"
            placeholder="Ex: Chevrolet S10 2.8 Turbo 4x4"
            required
          />
          <Select
            label="Tipo de Frota"
            required
            defaultValue="Administrativa"
            options={[
              { value: "Administrativa", label: "Frota Administrativa (LACEN, Hemose, Diretoria)" },
              {
                value: "SVO",
                label: "Frota Especializada SVO (Com protocolo de desinfecção biológica)",
              },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Capacidade Máxima" type="number" placeholder="Ex: 4" required />
            <Input label="Ano Fabricação" type="number" placeholder="Ex: 2024" required />
          </div>
          <Input label="Tipo de Combustível" placeholder="Ex: Diesel S10 / Flex" required />
        </div>
      </Modal>
    </div>
  );
};
