import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Eye,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Database,
  Layers,
} from "lucide-react";
import { Badge, Button, Card, Input, Select, Table } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { listarAuditoriaApi } from "../../services/auditoriaService";
import type { FiltrosAuditoria, ItemAuditoria } from "../../types/auditoria";
import { DetalhesAuditoriaModal } from "./DetalhesAuditoriaModal";

const TABELAS_AFETADAS_OPTIONS = [
  { value: "TODAS", label: "Todos os módulos" },
  { value: "SOLICITACAO_VIAGEM", label: "Solicitações de Viagem" },
  { value: "VEICULO", label: "Veículos da Frota" },
  { value: "USUARIO", label: "Usuários e Acessos" },
  { value: "MULTA", label: "Multas de Trânsito" },
  { value: "CHAMADO_SVO", label: "Chamados SVO" },
  { value: "ORDEM_COLETA_SVO", label: "Ordens de Coleta SVO" },
  { value: "ABASTECIMENTO", label: "Abastecimentos" },
];

const ACOES_OPTIONS = [
  { value: "TODAS", label: "Todas as ações" },
  { value: "CRIAR", label: "Criação (CRIAR)" },
  { value: "ATUALIZAR", label: "Atualização (ATUALIZAR)" },
  { value: "EXCLUIR", label: "Exclusão (EXCLUIR)" },
  { value: "CANCELAR", label: "Cancelamento (CANCELAR)" },
  { value: "LOGIN", label: "Autenticação (LOGIN)" },
];

function obterAcaoBadgeVariant(acao: string): "success" | "info" | "warning" | "danger" | "neutral" {
  const normalizada = acao.toUpperCase();
  if (normalizada.includes("CRIAR") || normalizada.includes("CREATE") || normalizada.includes("CRIACAO")) {
    return "success";
  }
  if (normalizada.includes("ATUALIZAR") || normalizada.includes("UPDATE") || normalizada.includes("EDICAO")) {
    return "info";
  }
  if (normalizada.includes("EXCLUIR") || normalizada.includes("DELETE") || normalizada.includes("CANCELAR")) {
    return "danger";
  }
  if (normalizada.includes("LOGIN") || normalizada.includes("LOGOUT") || normalizada.includes("AUTH")) {
    return "warning";
  }
  return "neutral";
}

function formatarDataHora(dataIso: string): string {
  try {
    const data = new Date(dataIso);
    if (isNaN(data.getTime())) return dataIso;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(data);
  } catch {
    return dataIso;
  }
}

export const AuditoriaPage: React.FC = () => {
  const [pagina, setPagina] = useState(1);
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const [tabelaAfetada, setTabelaAfetada] = useState("TODAS");
  const [acao, setAcao] = useState("TODAS");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [logs, setLogs] = useState<ItemAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [logSelecionado, setLogSelecionado] = useState<ItemAuditoria | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    const filtros: FiltrosAuditoria = {
      pagina,
      limite: 20,
    };
    if (tabelaAfetada !== "TODAS") filtros.tabelaAfetada = tabelaAfetada;
    if (acao !== "TODAS") filtros.acao = acao;
    if (busca.trim()) filtros.busca = busca.trim();
    if (dataInicio.trim()) filtros.dataInicio = dataInicio.trim();
    if (dataFim.trim()) filtros.dataFim = dataFim.trim();

    void Promise.resolve().then(() => {
      if (ativo) setCarregando(true);
    });

    void listarAuditoriaApi(filtros)
      .then((resposta) => {
        if (!ativo) return;
        setLogs(resposta.itens);
        setTotal(resposta.total);
        setTotalPaginas(resposta.totalPaginas);
        setErro(null);
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        setErro(err instanceof Error ? err.message : "Erro ao carregar registros de auditoria.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [pagina, busca, tabelaAfetada, acao, dataInicio, dataFim]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setBusca(termo);
    setPagina(1);
  };

  const handleLimpar = () => {
    setTermo("");
    setBusca("");
    setTabelaAfetada("TODAS");
    setAcao("TODAS");
    setDataInicio("");
    setDataFim("");
    setPagina(1);
  };

  const colunas: Column<ItemAuditoria>[] = useMemo(
    () => [
      {
        header: "Data / Hora",
        accessor: "criadoEm",
        render: (item) => (
          <span className="font-mono text-xs text-slate-700 whitespace-nowrap">
            {formatarDataHora(item.criadoEm)}
          </span>
        ),
      },
      {
        header: "Ação",
        accessor: "acao",
        render: (item) => (
          <Badge variant={obterAcaoBadgeVariant(item.acao)} dot size="sm">
            {item.acao}
          </Badge>
        ),
      },
      {
        header: "Módulo / Tabela",
        accessor: "tabelaAfetada",
        render: (item) => (
          <span className="font-semibold text-xs text-slate-800">
            {item.tabelaAfetada}
          </span>
        ),
      },
      {
        header: "ID Registro",
        accessor: "registroId",
        render: (item) =>
          item.registroId ? (
            <span
              className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded max-w-[120px] truncate block"
              title={item.registroId}
            >
              {item.registroId}
            </span>
          ) : (
            <span className="text-slate-400 text-xs italic">—</span>
          ),
      },
      {
        header: "Responsável",
        render: (item) =>
          item.usuario ? (
            <div className="flex flex-col text-xs">
              <span className="font-medium text-slate-900">{item.usuario.nome}</span>
              <span className="text-[11px] text-slate-500">
                {item.usuario.perfil} · Mat. {item.usuario.matricula}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-500 italic">
              {item.usuarioId ? `ID: ${item.usuarioId}` : "Sistema / Rotina"}
            </span>
          ),
      },
      {
        header: "Ações",
        className: "text-right",
        render: (item) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Eye className="w-3.5 h-3.5" />}
              onClick={() => {
                setLogSelecionado(item);
                setModalAberto(true);
              }}
              title="Inspecionar log e payload"
            >
              Inspecionar
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Trilha de Auditoria
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Rastreabilidade e histórico de operações críticas da frota e do SVO em conformidade com a LGPD.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot size="md">
            LGPD Ativo
          </Badge>
          <Badge variant="info" size="md">
            Restrito a ADMIN
          </Badge>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total de Eventos</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{total}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Módulos Rastreados</p>
            <p className="text-xl font-bold text-slate-900">Frota &amp; SVO</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Proteção LGPD</p>
            <p className="text-sm font-semibold text-emerald-700">Segredos Sanitizados</p>
          </div>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card>
        <form onSubmit={handleBuscar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Buscar no Registro"
              placeholder="Ação, ID ou dados..."
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
            <Select
              label="Módulo / Tabela"
              value={tabelaAfetada}
              onChange={(e) => {
                setTabelaAfetada(e.target.value);
                setPagina(1);
              }}
              options={TABELAS_AFETADAS_OPTIONS}
              leftIcon={<Layers className="w-4 h-4 text-slate-400" />}
            />
            <Select
              label="Ação"
              value={acao}
              onChange={(e) => {
                setAcao(e.target.value);
                setPagina(1);
              }}
              options={ACOES_OPTIONS}
              leftIcon={<Activity className="w-4 h-4 text-slate-400" />}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="De"
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPagina(1);
                }}
              />
              <Input
                label="Até"
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPagina(1);
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={handleLimpar}
            >
              Limpar Filtros
            </Button>
            <Button
              type="submit"
              size="sm"
              leftIcon={<Search className="w-3.5 h-3.5" />}
            >
              Aplicar Busca
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabela de Logs */}
      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          {erro}
        </div>
      )}

      <div className="space-y-3">
        <Table
          columns={colunas}
          data={logs}
          keyExtractor={(item) => item.id}
          emptyMessage="Nenhum registro de auditoria encontrado para os filtros selecionados."
          isLoading={carregando}
        />

        {/* Paginação */}
        {!erro && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 text-xs text-slate-500">
            <span className="tabular-nums">
              Página {pagina} de {totalPaginas} · {total} evento(s) encontrado(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || carregando}
                onClick={() => setPagina((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= totalPaginas || carregando}
                onClick={() => setPagina((prev) => Math.min(totalPaginas, prev + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Nota LGPD e Rastreabilidade */}
      <div className="flex items-center gap-2.5 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          Em conformidade com a LGPD e as normas de governança da FSPH, todos os acessos a esta trilha são registrados e senhas/segredos são permanentemente mascarados.
        </span>
      </div>

      {/* Modal de Detalhes */}
      <DetalhesAuditoriaModal
        log={logSelecionado}
        isOpen={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setLogSelecionado(null);
        }}
      />
    </div>
  );
};
