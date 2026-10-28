import React, { useState, useEffect } from "react";
import { Plus, Search, Truck, Fuel, Eye } from "lucide-react";
import { Table, Badge, Button, Input, Select, Modal, Card } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { z } from "zod"; 

const veiculoSchema = z.object({
  placa: z.string().min(7, "A placa deve ter pelo menos 7 caracteres").max(8, "Placa inválida"),
  modelo: z.string().min(3, "Informe o modelo e fabricante do veículo"),
  tipoFrota: z.enum(["ADMINISTRATIVA", "SVO"]),
  capacidadeMaxima: z.coerce.number().min(1, "A capacidade deve ser maior que zero"),
  combustivel: z.string().min(2, "Informe o tipo de combustível"),
  ano: z.coerce.number().min(2000, "Ano inválido").max(2030, "Ano inválido"),
});

type VeiculoFormData = z.infer<typeof veiculoSchema>;

interface VeiculoItem extends VeiculoFormData {
  id: string;
  status: "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO" | "DESINFECCCAO";
}

export const VeiculosPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tabFilter, setTabFilter] = useState<"TODOS" | "ADMIN" | "SVO">("TODOS");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  const LIMIT = 10;
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [contagens, setContagens] = useState({ todos: 0, admin: 0, svo: 0 });

  // Estados para controlar os inputs do formulário e erros
  const [formData, setFormData] = useState({
    placa: "",
    modelo: "",
    tipoFrota: "ADMINISTRATIVA" as "ADMINISTRATIVA" | "SVO",
    capacidadeMaxima: 4,
    combustivel: "",
    ano: 2024,
  });
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Função para validar e enviar POST para o Express com o endpoint e token corretos[cite: 1, 3]
  const handleSalvarVeiculo = async () => {
    try {
      setErroValidacao(null);
      const dadosValidados = veiculoSchema.parse(formData);
      setEnviando(true);

      const token = localStorage.getItem("token"); // Recupera o token de autenticação

      const resposta = await fetch('http://localhost:3000/api/v1/veiculos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Token Bearer exigido pela API[cite: 1]
        },
        body: JSON.stringify({ ...dadosValidados, status: "DISPONIVEL" }), // Status em maiúsculo[cite: 3]
      });

      if (!resposta.ok) throw new Error('Erro ao salvar veículo no servidor.');

      setIsModalOpen(false);
      setFormData({ placa: "", modelo: "", tipoFrota: "ADMINISTRATIVA", capacidadeMaxima: 4, combustivel: "", ano: 2024 });
      buscarVeiculos(searchTerm, page);
      buscarContagens();
    } catch (erro: any) {
      if (erro instanceof z.ZodError) {
        setErroValidacao(erro.issues[0].message);
      } else {
        setErroValidacao('Erro de conexão com o servidor Express.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const buscarVeiculos = async (termo = "", pagina = 1) => {
    try {
      setCarregando(true);
      const token = localStorage.getItem("token");

      const params = new URLSearchParams({ page: String(pagina), limit: String(LIMIT) });
      if (termo) params.set("busca", termo);
      if (tabFilter === "ADMIN") params.set("tipoFrota", "ADMINISTRATIVA");
      if (tabFilter === "SVO") params.set("tipoFrota", "SVO");

      const resposta = await fetch(`http://localhost:3000/api/v1/veiculos?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}` // Token Bearer no GET[cite: 1]
        }
      });
      if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
      const dados = await resposta.json();
      
      // A API retorna { data, meta }, extraímos o array de .data[cite: 2]
      setVeiculos(dados.data || []);
      setMeta(dados.meta);
    } catch (erro) {
      console.error('Erro ao buscar veículos da API:', erro);
    } finally {
      setCarregando(false);
    }
  };

  // Busca os totais reais de cada frota (lê apenas o meta.total)
  const buscarContagens = async () => {
    const token = localStorage.getItem("token");

    const total = async (tipo?: string) => {
      const q = new URLSearchParams({ page: "1", limit: "1" });
      if (tipo) q.set("tipoFrota", tipo);
      const r = await fetch(`http://localhost:3000/api/v1/veiculos?${q}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`Erro ${r.status}`);
      return (await r.json()).meta.total as number;
    };

    try {
      const [todos, admin, svo] = await Promise.all([total(), total("ADMINISTRATIVA"), total("SVO")]);
      setContagens({ todos, admin, svo });
    } catch (erro) {
      console.error('Erro ao buscar contagens da frota:', erro);
    }
  };

  // Carrega os totais das frotas assim que a página abre
  useEffect(() => {
    buscarContagens();
  }, []);

  // Ao mudar a busca ou a aba, volta para a primeira página
  useEffect(() => {
    setPage(1);
  }, [searchTerm, tabFilter]);

  // Busca dinâmica conforme o usuário digita, troca de aba ou de página
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      buscarVeiculos(searchTerm, page);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, tabFilter, page]);

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
          {v.tipoFrota === "SVO" ? `${v.capacidadeMaxima} urnas (Portaria)` : `${v.capacidadeMaxima} ocupantes`}
        </span>
      ),
    },
    {
      header: "Status Operacional",
      render: (v) => {
        // Mapeamento ajustado para os novos valores em maiúsculo do backend
        const variantMap: Record<string, "success" | "info" | "warning" | "danger"> = {
          DISPONIVEL: "success",
          EM_VIAGEM: "info",
          MANUTENCAO: "warning",
          DESINFECCCAO: "danger",
        };
        return (
          <Badge variant={variantMap[v.status] || "success"} dot size="md">
            {v.status === "DESINFECCCAO" ? "Em Desinfecção Sanitária" : v.status}
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
            <span className="text-2xl font-bold text-slate-900">{contagens.todos}</span>
            <span className="text-xs text-slate-400">cadastrados</span>
          </div>
        </Card>

        <Card className="p-4.5 rounded-2xl border border-blue-200/80 bg-blue-50/30">
          <span className="text-xs text-blue-700 font-semibold">Frota Administrativa</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-900">
              {contagens.admin}
            </span>
            <span className="text-xs text-blue-600 font-medium">veículos (LACEN / Hemose)</span>
          </div>
        </Card>

        <Card className="p-4.5 rounded-2xl border border-rose-200/80 bg-rose-50/30">
          <span className="text-xs text-rose-700 font-semibold">Frota Especializada SVO</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-900">
              {contagens.svo}
            </span>
            <span className="text-xs text-rose-600 font-medium">viaturas (Limite 4 urnas)</span>
          </div>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-md">
          <Input
            placeholder="Buscar por placa, modelo ou combustível..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

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
            Todos ({contagens.todos})
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
            Administrativa ({contagens.admin})
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
            SVO ({contagens.svo})
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200/80">
          Carregando veículos da API...
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            data={veiculos}
            keyExtractor={(item) => item.id}
            emptyMessage="Nenhum veículo encontrado com esse filtro ou busca."
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Página {page} de {meta.totalPages} · {meta.total} veículos
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="ghost" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
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
              onClick={handleSalvarVeiculo}
              disabled={enviando}
            >
              {enviando ? "Salvando..." : "Salvar Veículo"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {erroValidacao && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {erroValidacao}
            </div>
          )}

          <Input 
            label="Placa (Padrão Mercosul ou CTB)" 
            placeholder="Ex: BRA2E19" 
            required 
            value={formData.placa}
            onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
          />
          <Input
            label="Modelo e Fabricante"
            placeholder="Ex: Chevrolet S10 2.8 Turbo 4x4"
            required
            value={formData.modelo}
            onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
          />
          <Select
            label="Tipo de Frota"
            required
            value={formData.tipoFrota}
            onChange={(e: any) => setFormData({ ...formData, tipoFrota: e.target.value })}
            options={[
              { value: "ADMINISTRATIVA", label: "Frota Administrativa (LACEN, Hemose, Diretoria)" },
              { value: "SVO", label: "Frota Especializada SVO (Com protocolo de desinfecção biológica)" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Capacidade Máxima" 
              type="number" 
              placeholder="Ex: 4" 
              required 
              value={formData.capacidadeMaxima}
              onChange={(e) => setFormData({ ...formData, capacidadeMaxima: Number(e.target.value) })}
            />
            <Input 
              label="Ano Fabricação" 
              type="number" 
              placeholder="Ex: 2024" 
              required 
              value={formData.ano}
              onChange={(e) => setFormData({ ...formData, ano: Number(e.target.value) })}
            />
          </div>
          <Input 
            label="Tipo de Combustível" 
            placeholder="Ex: Diesel S10 / Flex" 
            required 
            value={formData.combustivel}
            onChange={(e) => setFormData({ ...formData, combustivel: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
};