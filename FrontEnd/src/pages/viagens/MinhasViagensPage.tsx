import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { Badge, Button, Card } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { listarMinhasViagensApi } from "../../services/solicitacoesService";
import type {
  ExecucaoViagemResposta,
  ListaMinhasViagensResposta,
  SolicitacaoViagem,
  StatusSolicitacao,
} from "../../types/solicitacao";
import { ChecklistViagemModal } from "./ChecklistViagemModal";

type FiltroViagem = "TODAS" | "A_INICIAR" | "CONCLUIDAS";

const PAGE_SIZE = 20;
const FILTROS: { id: FiltroViagem; label: string; status?: StatusSolicitacao }[] = [
  { id: "TODAS", label: "Todas" },
  { id: "A_INICIAR", label: "A iniciar", status: "APROVADA" },
  { id: "CONCLUIDAS", label: "Concluídas", status: "CONCLUIDA" },
];

const STATUS_VIAGEM: Record<
  StatusSolicitacao,
  { label: string; variant: "success" | "info" | "warning" | "danger" | "neutral" }
> = {
  PENDENTE: { label: "Pendente", variant: "warning" },
  APROVADA: { label: "A iniciar", variant: "info" },
  EM_TRANSITO: { label: "Em andamento", variant: "warning" },
  CONCLUIDA: { label: "Concluída", variant: "success" },
  RECUSADA: { label: "Recusada", variant: "danger" },
};

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatarDataHora(data?: string | null): string {
  if (!data) return "Data não informada";
  const valor = new Date(data);
  return Number.isNaN(valor.getTime()) ? "Data não informada" : dataHoraFmt.format(valor);
}

export const MinhasViagensPage: React.FC = () => {
  const { sessionKey } = useAuth();
  const [filtro, setFiltro] = useState<FiltroViagem>("TODAS");
  const [pagina, setPagina] = useState(1);
  const [revisao, setRevisao] = useState(0);
  const [resultado, setResultado] = useState<{
    chave: string;
    dados: ListaMinhasViagensResposta | null;
    erro: string;
  } | null>(null);
  const [selecionada, setSelecionada] = useState<SolicitacaoViagem | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const statusFiltro = FILTROS.find((item) => item.id === filtro)?.status;
  const chave = JSON.stringify([sessionKey, pagina, filtro, revisao]);
  const atual = resultado?.chave === chave ? resultado : null;
  const dados = atual?.dados ?? null;
  const erro = atual?.erro ?? "";
  const carregando = !atual;
  const viagemEmAndamento = dados?.viagemEmAndamento ?? null;
  const viagens = useMemo(
    () =>
      [...(dados?.data ?? [])]
        .filter((viagem) => viagem.status !== "EM_TRANSITO")
        .sort(
          (a, b) =>
            Number(b.status === "APROVADA") - Number(a.status === "APROVADA") ||
            new Date(a.dataHoraPretendida ?? 0).getTime() -
              new Date(b.dataHoraPretendida ?? 0).getTime(),
        ),
    [dados?.data],
  );
  const totalPaginas = Math.max(1, dados?.meta.totalPages ?? 1);

  useEffect(() => {
    let ativa = true;
    void listarMinhasViagensApi({
      page: pagina,
      pageSize: PAGE_SIZE,
      status: statusFiltro ? [statusFiltro] : undefined,
    })
      .then((resposta) => {
        if (ativa) setResultado({ chave, dados: resposta, erro: "" });
      })
      .catch((error: unknown) => {
        if (ativa) {
          setResultado({
            chave,
            dados: null,
            erro:
              error instanceof Error && error.message
                ? error.message
                : "Não foi possível carregar suas viagens.",
          });
        }
      });
    return () => {
      ativa = false;
    };
  }, [chave, filtro, pagina, revisao, sessionKey, statusFiltro]);

  const atualizarLista = () => {
    setMensagemSucesso(null);
    setRevisao((atual) => atual + 1);
  };

  const finalizarChecklist = (mensagem: string, _resposta: ExecucaoViagemResposta) => {
    setSelecionada(null);
    setMensagemSucesso(mensagem);
    setRevisao((atual) => atual + 1);
  };

  if (viagemEmAndamento) {
    const status = STATUS_VIAGEM[viagemEmAndamento.status];
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-500">Área do motorista</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Viagem em andamento
          </h1>
          <p className="text-sm text-slate-600">
            Ao retornar, registre o checklist de chegada para concluir a viagem.
          </p>
        </header>

        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Protocolo
              </p>
              <h2 className="mt-0.5 text-base font-bold text-slate-950">
                {viagemEmAndamento.protocolo}
              </h2>
            </div>
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Destino
                </p>
                <p className="mt-0.5 break-words text-base font-bold leading-snug text-slate-950">
                  {viagemEmAndamento.destino || "Destino não informado"}
                </p>
                <div className="mt-2 flex items-start gap-1.5 border-t border-blue-100 pt-2 text-xs text-slate-600">
                  <ArrowDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <p className="break-words">
                    <span className="font-medium text-slate-500">Saída de: </span>
                    {viagemEmAndamento.origem || "Origem não informada"}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:grid-cols-2">
            <span className="inline-flex items-center gap-2">
              <CarFront className="h-4 w-4 shrink-0 text-slate-400" />
              {viagemEmAndamento.veiculoAlocado
                ? `${viagemEmAndamento.veiculoAlocado.placa} · ${viagemEmAndamento.veiculoAlocado.modelo}`
                : "Veículo não informado"}
            </span>
            <span className="inline-flex items-center gap-2">
              <UsersRound className="h-4 w-4 shrink-0 text-slate-400" />
              {viagemEmAndamento.quantidadePassageiros}{" "}
              {viagemEmAndamento.quantidadePassageiros === 1 ? "passageiro" : "passageiros"}
            </span>
            {viagemEmAndamento.execucao?.dataHoraInicio && (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
                Iniciada {formatarDataHora(viagemEmAndamento.execucao.dataHoraInicio)}
              </span>
            )}
          </div>
          <Button
            type="button"
            className="min-h-11 w-full"
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
            onClick={() => setSelecionada(viagemEmAndamento)}
          >
            Concluir viagem
          </Button>
        </Card>

        {selecionada && (
          <ChecklistViagemModal
            modo="RETORNO"
            viagem={selecionada}
            odometroAtualVeiculo={selecionada.veiculoAlocado?.odometroAtual}
            onClose={() => setSelecionada(null)}
            onConcluido={finalizarChecklist}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
      <header className="space-y-1">
        <p className="text-sm font-medium text-slate-500">Área do motorista</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Minhas viagens
        </h1>
        <p className="text-sm text-slate-600">
          Acompanhe seus deslocamentos e registre cada etapa da viagem.
        </p>
      </header>

      <nav aria-label="Filtrar viagens" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {FILTROS.map((item) => {
            const ativo = filtro === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => {
                  setPagina(1);
                  setFiltro(item.id);
                }}
                className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${
                  ativo
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {mensagemSucesso && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-800"
        >
          {mensagemSucesso}
        </p>
      )}

      {carregando ? (
        <Card role="status" className="py-8 text-center text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando suas viagens...
          </span>
        </Card>
      ) : erro ? (
        <Card className="space-y-3 p-5 text-center">
          <p role="alert" className="text-sm text-rose-700">
            {erro}
          </p>
          <Button type="button" variant="outline" onClick={atualizarLista}>
            Tentar novamente
          </Button>
        </Card>
      ) : viagens.length > 0 ? (
        <section aria-label="Lista de viagens" className="space-y-3">
          {viagens.map((viagem) => {
            const status = STATUS_VIAGEM[viagem.status];
            const podeIniciar = viagem.status === "APROVADA";
            return (
              <Card key={viagem.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {formatarDataHora(viagem.dataHoraPretendida)}
                    </p>
                    <h2 className="mt-1 truncate text-sm font-bold text-slate-950">
                      {viagem.protocolo}
                    </h2>
                  </div>
                  <Badge variant={status.variant} dot>
                    {status.label}
                  </Badge>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Destino
                      </p>
                      <p className="mt-0.5 break-words text-base font-bold leading-snug text-slate-950">
                        {viagem.destino || "Destino não informado"}
                      </p>
                      <div className="mt-2 flex items-start gap-1.5 border-t border-blue-100 pt-2 text-xs text-slate-600">
                        <ArrowDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <p className="break-words">
                          <span className="font-medium text-slate-500">Saída de: </span>
                          {viagem.origem || "Origem não informada"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:grid-cols-2">
                  <span className="inline-flex items-center gap-2">
                    <CarFront className="h-4 w-4 shrink-0 text-slate-400" />
                    {viagem.veiculoAlocado
                      ? `${viagem.veiculoAlocado.placa} · ${viagem.veiculoAlocado.modelo}`
                      : "Veículo não informado"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <UsersRound className="h-4 w-4 shrink-0 text-slate-400" />
                    {viagem.quantidadePassageiros}{" "}
                    {viagem.quantidadePassageiros === 1 ? "passageiro" : "passageiros"}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-2 sm:col-span-2">
                    <UsersRound className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      Solicitante: {viagem.solicitanteNome || "Não informado"}
                    </span>
                  </span>
                </div>

                {podeIniciar && (
                  <Button
                    type="button"
                    className="min-h-11 w-full"
                    leftIcon={<ArrowRight className="h-4 w-4" />}
                    onClick={() => setSelecionada(viagem)}
                  >
                    Iniciar viagem
                  </Button>
                )}
              </Card>
            );
          })}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || carregando}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
                onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-slate-500">
                Página {pagina} de {totalPaginas}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagina >= totalPaginas || carregando}
                rightIcon={<ChevronRight className="h-4 w-4" />}
                onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}
              >
                Próxima
              </Button>
            </div>
          )}
        </section>
      ) : (
        <Card className="px-5 py-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <MapPin className="h-5 w-5" />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            {filtro === "CONCLUIDAS" ? "Nenhuma viagem concluída" : "Nenhuma viagem disponível"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {filtro === "CONCLUIDAS"
              ? "As viagens concluídas aparecerão aqui."
              : "Não há viagens atribuídas a você no momento."}
          </p>
        </Card>
      )}

      {selecionada && selecionada.status === "APROVADA" && (
        <ChecklistViagemModal
          modo="SAIDA"
          viagem={selecionada}
          odometroAtualVeiculo={selecionada.veiculoAlocado?.odometroAtual}
          onClose={() => setSelecionada(null)}
          onConcluido={finalizarChecklist}
        />
      )}
    </div>
  );
};
