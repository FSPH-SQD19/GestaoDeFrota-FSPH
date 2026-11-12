import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, RefreshCw } from "lucide-react";
import { Badge, Button, Card } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { listarMeusAbastecimentosApi } from "../../services/abastecimentosService";
import { listarMinhasViagensApi } from "../../services/solicitacoesService";
import type { AbastecimentoMotorista } from "../../types/abastecimento";
import type {
  ExecucaoViagemResposta,
  ListaMinhasViagensResposta,
  SolicitacaoViagem,
  StatusSolicitacao,
} from "../../types/solicitacao";
import { ChecklistViagemModal } from "./ChecklistViagemModal";
import { RegistrarAbastecimentoModal } from "./RegistrarAbastecimentoModal";

type FiltroViagem = "TODAS" | "A_INICIAR" | "CONCLUIDAS";

const PAGE_SIZE = 20;
const ABASTECIMENTOS_PAGE_SIZE = 10;
const FILTROS: { id: FiltroViagem; label: string; status?: StatusSolicitacao }[] = [
  { id: "A_INICIAR", label: "A iniciar", status: "APROVADA" },
  { id: "CONCLUIDAS", label: "Concluídas", status: "CONCLUIDA" },
  { id: "TODAS", label: "Todas" },
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
  CANCELADA: { label: "Cancelada", variant: "neutral" },
};

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const moedaFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numeroFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatarDataHora(data?: string | null): string {
  if (!data) return "Data não informada";
  const valor = new Date(data);
  return Number.isNaN(valor.getTime()) ? "Data não informada" : dataHoraFmt.format(valor);
}

export const MinhasViagensPage: React.FC = () => {
  const { sessionKey } = useAuth();
  const [filtro, setFiltro] = useState<FiltroViagem>("A_INICIAR");
  const [pagina, setPagina] = useState(1);
  const [revisao, setRevisao] = useState(0);
  const [resultado, setResultado] = useState<{
    chave: string;
    sessionKey: string | null;
    dados: ListaMinhasViagensResposta | null;
    erro: string;
  } | null>(null);
  const [selecionada, setSelecionada] = useState<SolicitacaoViagem | null>(null);
  const [modalAbastecimentoAberto, setModalAbastecimentoAberto] = useState(false);
  const [resultadoAbastecimentos, setResultadoAbastecimentos] = useState<{
    chave: string;
    dados: AbastecimentoMotorista[];
    erro: string;
  } | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const statusFiltro = FILTROS.find((item) => item.id === filtro)?.status;
  const chave = JSON.stringify([sessionKey, pagina, filtro, revisao]);
  const chaveAbastecimentos = JSON.stringify([sessionKey, revisao]);
  const atual = resultado?.chave === chave ? resultado : null;
  const dados = atual?.dados ?? null;
  const erro = atual?.erro ?? "";
  const carregando = !atual;
  const abastecimentos = resultadoAbastecimentos?.dados ?? [];
  const erroAbastecimentos =
    resultadoAbastecimentos?.chave === chaveAbastecimentos ? resultadoAbastecimentos.erro : "";
  const carregandoAbastecimentos = resultadoAbastecimentos?.chave !== chaveAbastecimentos;
  const viagemEmAndamento =
    resultado?.sessionKey === sessionKey ? (resultado.dados?.viagemEmAndamento ?? null) : null;
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
  const totalPaginasInformadas = dados?.meta?.totalPages;
  const totalPaginasInformadasValidas =
    typeof totalPaginasInformadas === "number" &&
    Number.isInteger(totalPaginasInformadas) &&
    totalPaginasInformadas > 0;
  const totalPaginas = totalPaginasInformadasValidas ? totalPaginasInformadas : Math.max(1, pagina);

  useEffect(() => {
    let ativa = true;
    void listarMinhasViagensApi({
      page: pagina,
      pageSize: PAGE_SIZE,
      status: statusFiltro ? [statusFiltro] : undefined,
    })
      .then((resposta) => {
        if (!ativa) return;
        if (!resposta || !Array.isArray(resposta.data)) {
          throw new Error(
            "Não foi possível carregar suas viagens. Atualize a página e tente novamente.",
          );
        }
        const totalPaginasResposta = resposta.meta?.totalPages;
        if (
          typeof totalPaginasResposta === "number" &&
          Number.isInteger(totalPaginasResposta) &&
          totalPaginasResposta > 0 &&
          pagina > totalPaginasResposta
        ) {
          setPagina(totalPaginasResposta);
          return;
        }
        setResultado({ chave, sessionKey, dados: resposta, erro: "" });
      })
      .catch((error: unknown) => {
        if (ativa) {
          setResultado({
            chave,
            sessionKey,
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

  useEffect(() => {
    let ativa = true;

    void Promise.resolve(
      listarMeusAbastecimentosApi?.({
        page: 1,
        pageSize: ABASTECIMENTOS_PAGE_SIZE,
      }),
    )
      .then((resposta) => {
        if (!ativa) return;
        setResultadoAbastecimentos((anterior) => ({
          chave: chaveAbastecimentos,
          dados: resposta && Array.isArray(resposta.data) ? resposta.data : (anterior?.dados ?? []),
          erro: "",
        }));
      })
      .catch((error: unknown) => {
        if (!ativa) return;
        setResultadoAbastecimentos((anterior) => ({
          chave: chaveAbastecimentos,
          dados: anterior?.dados ?? [],
          erro:
            error instanceof Error && error.message
              ? error.message
              : "Não foi possível carregar o histórico de abastecimentos.",
        }));
      });

    return () => {
      ativa = false;
    };
  }, [chaveAbastecimentos]);

  const atualizarLista = () => {
    setMensagemSucesso(null);
    setRevisao((atual) => atual + 1);
  };

  const finalizarChecklist = (mensagem: string, _resposta: ExecucaoViagemResposta) => {
    setSelecionada(null);
    setMensagemSucesso(mensagem);
    setRevisao((atual) => atual + 1);
  };

  const finalizarAbastecimento = (mensagem: string, novoAbastecimento: AbastecimentoMotorista) => {
    setModalAbastecimentoAberto(false);
    setMensagemSucesso(mensagem);
    setResultadoAbastecimentos((anterior) => ({
      chave: chaveAbastecimentos,
      dados: [
        novoAbastecimento,
        ...(anterior?.dados ?? []).filter((item) => item.id !== novoAbastecimento.id),
      ],
      erro: "",
    }));
    setRevisao((atual) => atual + 1);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-medium text-slate-500">Área do motorista</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Minhas viagens</h1>
      </header>

      {mensagemSucesso && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {mensagemSucesso}
        </p>
      )}

      {viagemEmAndamento && (
        <section aria-labelledby="viagem-em-andamento" className="space-y-2">
          <h2 id="viagem-em-andamento" className="text-sm font-bold text-slate-900">
            Viagem em andamento
          </h2>
          <Card className="space-y-4 border-l-4 border-l-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold leading-snug text-slate-900">
                  {viagemEmAndamento.destino || "Destino não informado"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Saída de: {viagemEmAndamento.origem || "Origem não informada"}
                </p>
              </div>
              <Badge variant={STATUS_VIAGEM[viagemEmAndamento.status].variant} dot>
                {STATUS_VIAGEM[viagemEmAndamento.status].label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">
                {viagemEmAndamento.veiculoAlocado
                  ? `${viagemEmAndamento.veiculoAlocado.placa} · ${viagemEmAndamento.veiculoAlocado.modelo}`
                  : "Veículo não informado"}
              </span>
              <span>
                {viagemEmAndamento.quantidadePassageiros}{" "}
                {viagemEmAndamento.quantidadePassageiros === 1 ? "passageiro" : "passageiros"}
              </span>
              <h2 className="text-xs font-normal text-slate-400">{viagemEmAndamento.protocolo}</h2>
              {viagemEmAndamento.execucao?.dataHoraInicio && (
                <span>Iniciada {formatarDataHora(viagemEmAndamento.execucao.dataHoraInicio)}</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
              <Button
                type="button"
                className="min-h-12 w-full text-sm font-semibold"
                onClick={() => setSelecionada(viagemEmAndamento)}
              >
                Retomar checklist
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full text-sm font-semibold"
                onClick={() => setModalAbastecimentoAberto(true)}
              >
                Registrar abastecimento (Cartão Prime)
              </Button>
            </div>
          </Card>
        </section>
      )}

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
                className={`min-h-10 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
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
              <Card key={viagem.id} className="space-y-3.5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatarDataHora(viagem.dataHoraPretendida)}
                    </p>
                    <h2 className="text-xs text-slate-400">{viagem.protocolo}</h2>
                  </div>
                  <Badge variant={status.variant} dot>
                    {status.label}
                  </Badge>
                </div>

                <div>
                  <p className="text-lg font-bold leading-snug text-slate-900">
                    {viagem.destino || "Destino não informado"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Saída de: {viagem.origem || "Origem não informada"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">
                    {viagem.veiculoAlocado
                      ? `${viagem.veiculoAlocado.placa} · ${viagem.veiculoAlocado.modelo}`
                      : "Veículo não informado"}
                  </span>
                  <span>
                    {viagem.quantidadePassageiros}{" "}
                    {viagem.quantidadePassageiros === 1 ? "passageiro" : "passageiros"}
                  </span>
                  <span className="text-slate-500">
                    Solicitante: {viagem.solicitanteNome || "Não informado"}
                  </span>
                </div>

                {podeIniciar && (
                  <Button
                    type="button"
                    className="min-h-12 w-full text-sm font-semibold"
                    disabled={Boolean(viagemEmAndamento)}
                    onClick={() => {
                      if (!viagemEmAndamento) setSelecionada(viagem);
                    }}
                  >
                    Iniciar viagem
                  </Button>
                )}
                {podeIniciar && viagemEmAndamento && (
                  <p className="text-center text-xs text-slate-500">
                    Conclua a viagem em andamento antes de iniciar outra.
                  </p>
                )}
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className="px-5 py-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
            <MapPin className="h-4.5 w-4.5" />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            {pagina > 1
              ? "Nenhuma viagem nesta página"
              : filtro === "CONCLUIDAS"
                ? "Nenhuma viagem concluída"
                : "Nenhuma viagem disponível"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {pagina > 1
              ? "Pode ter havido uma atualização. Volte à página anterior para continuar consultando."
              : filtro === "CONCLUIDAS"
                ? "As viagens concluídas aparecerão aqui."
                : "Não há viagens atribuídas a você no momento."}
          </p>
        </Card>
      )}

      {(totalPaginas > 1 || pagina > 1) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagina <= 1}
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

      <section
        aria-labelledby="historico-abastecimentos"
        className="space-y-3 border-t border-slate-200 pt-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="historico-abastecimentos" className="text-sm font-bold text-slate-900">
            Abastecimentos (Cartão Prime)
          </h2>
          {!viagemEmAndamento && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={() => setModalAbastecimentoAberto(true)}
            >
              Registrar abastecimento (Cartão Prime)
            </Button>
          )}
        </div>

        {carregandoAbastecimentos && abastecimentos.length === 0 ? (
          <Card className="py-6 text-center text-xs text-slate-500">
            Carregando abastecimentos...
          </Card>
        ) : erroAbastecimentos && abastecimentos.length === 0 ? (
          <Card className="p-4 text-center text-xs text-rose-700">{erroAbastecimentos}</Card>
        ) : abastecimentos.length > 0 ? (
          <div className="space-y-2.5">
            {abastecimentos.map((item) => (
              <Card key={item.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.postoCredenciado || "Posto não informado"}
                    </p>
                    <p className="text-xs text-slate-500">{formatarDataHora(item.dataHora)}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {item.valorTotal !== null ? moedaFmt.format(item.valorTotal) : "—"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>
                    {item.odometro !== null ? `${numeroFmt.format(item.odometro)} km` : "—"}
                  </span>
                  <span>{item.litros !== null ? `${numeroFmt.format(item.litros)} L` : "—"}</span>
                  {item.kmPorLitro !== null && item.kmPorLitro !== undefined && (
                    <span>{numeroFmt.format(item.kmPorLitro)} km/L</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Nenhum abastecimento registrado.</p>
        )}
      </section>

      {selecionada &&
        (selecionada.status === "APROVADA" || selecionada.status === "EM_TRANSITO") && (
          <ChecklistViagemModal
            modo={selecionada.status === "EM_TRANSITO" ? "RETORNO" : "SAIDA"}
            viagem={selecionada}
            odometroAtualVeiculo={selecionada.veiculoAlocado?.odometroAtual}
            onClose={() => setSelecionada(null)}
            onConcluido={finalizarChecklist}
          />
        )}

      <RegistrarAbastecimentoModal
        isOpen={modalAbastecimentoAberto}
        viagem={viagemEmAndamento}
        onClose={() => setModalAbastecimentoAberto(false)}
        onConcluido={finalizarAbastecimento}
      />
    </div>
  );
};
