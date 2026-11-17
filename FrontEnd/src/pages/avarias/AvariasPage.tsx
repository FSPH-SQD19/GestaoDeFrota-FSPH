import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, RotateCcw, Wrench } from "lucide-react";
import { Badge, Button, Card, Modal, Select, Textarea } from "../../components/common";
import {
  analisarAvariaApi,
  listarAvarias,
  listarVeiculosComAvaria,
  obterHistoricoAvaria,
  type AvariaViagem,
  type DecisaoAvaria,
  type HistoricoAvaria,
  type SituacaoAvaria,
  type VeiculoAvariaFiltro,
} from "../../services/avariasService";

const PAGE_SIZE = 20;
const SITUACAO_LABEL: Record<SituacaoAvaria, string> = {
  PENDENTE: "Pendente de análise",
  LIBERADA: "Veículo liberado",
  ENCAMINHADA_MANUTENCAO: "Encaminhada à manutenção",
};
const SITUACAO_VARIANT: Record<SituacaoAvaria, "warning" | "success" | "info"> = {
  PENDENTE: "warning",
  LIBERADA: "success",
  ENCAMINHADA_MANUTENCAO: "info",
};
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "Data indisponível" : DATA_HORA.format(data);
}

function mensagemErro(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AvariasPage() {
  const [veiculos, setVeiculos] = useState<VeiculoAvariaFiltro[]>([]);
  const [erroVeiculos, setErroVeiculos] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [situacao, setSituacao] = useState<"" | SituacaoAvaria>("");
  const [pagina, setPagina] = useState(1);
  const [revisao, setRevisao] = useState(0);
  const chaveConsulta = `${pagina}|${revisao}|${situacao}|${veiculoId}`;
  const [resultado, setResultado] = useState<{
    chave: string;
    data: AvariaViagem[];
    total: number;
    totalPages: number;
  } | null>(null);
  const [erroConsulta, setErroConsulta] = useState<{ chave: string; mensagem: string } | null>(
    null,
  );
  const [acao, setAcao] = useState<{ avaria: AvariaViagem; decisao: DecisaoAvaria } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erroAcao, setErroAcao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [historicos, setHistoricos] = useState<Record<string, HistoricoAvaria[]>>({});
  const [historicoCarregando, setHistoricoCarregando] = useState<string | null>(null);
  const [erroHistorico, setErroHistorico] = useState("");
  const resultadoAtual = resultado?.chave === chaveConsulta ? resultado : null;
  const erro = erroConsulta?.chave === chaveConsulta ? erroConsulta.mensagem : "";
  const carregando = !resultadoAtual && !erro;
  const registros = resultadoAtual?.data ?? [];
  const total = resultadoAtual?.total ?? 0;
  const totalPages = resultadoAtual?.totalPages ?? 1;

  useEffect(() => {
    let ativo = true;
    void listarVeiculosComAvaria()
      .then((dados) => {
        if (!ativo) return;
        setVeiculos(dados);
        setErroVeiculos("");
      })
      .catch((error: unknown) => {
        if (ativo) setErroVeiculos(mensagemErro(error, "Não foi possível carregar os veículos."));
      });
    return () => {
      ativo = false;
    };
  }, [revisao]);

  useEffect(() => {
    let ativo = true;
    void listarAvarias({
      page: pagina,
      pageSize: PAGE_SIZE,
      ...(veiculoId ? { veiculoId } : {}),
      ...(situacao ? { situacao } : {}),
    })
      .then((resposta) => {
        if (!ativo) return;
        const totalPages = Math.max(1, resposta.meta.totalPages);
        setResultado({
          chave: chaveConsulta,
          data: resposta.data,
          total: resposta.meta.total,
          totalPages,
        });
        setErroConsulta(null);
        if (pagina > totalPages) setPagina(totalPages);
      })
      .catch((error: unknown) => {
        if (ativo) {
          setErroConsulta({
            chave: chaveConsulta,
            mensagem: mensagemErro(error, "Não foi possível carregar as avarias."),
          });
        }
      });
    return () => {
      ativo = false;
    };
  }, [chaveConsulta, pagina, situacao, veiculoId]);

  const carregarHistorico = async (avariaId: string) => {
    setErroHistorico("");
    setHistoricoCarregando(avariaId);
    try {
      const eventos = await obterHistoricoAvaria(avariaId);
      setHistoricos((atuais) => ({ ...atuais, [avariaId]: eventos }));
    } catch (error: unknown) {
      setErroHistorico(mensagemErro(error, "Não foi possível carregar o histórico."));
    } finally {
      setHistoricoCarregando(null);
    }
  };

  const abrirHistorico = async (avariaId: string) => {
    if (historicoAberto === avariaId) {
      setHistoricoAberto(null);
      return;
    }
    setHistoricoAberto(avariaId);
    if (!historicos[avariaId]) await carregarHistorico(avariaId);
  };

  const abrirAnalise = (avaria: AvariaViagem, decisao: DecisaoAvaria) => {
    setAcao({ avaria, decisao });
    setJustificativa("");
    setErroAcao("");
  };

  const fecharAnalise = () => {
    if (salvando) return;
    setAcao(null);
    setJustificativa("");
    setErroAcao("");
  };

  const salvarAnalise = async () => {
    const motivo = justificativa.trim();
    if (motivo.length < 5) {
      setErroAcao("Informe uma justificativa com pelo menos 5 caracteres.");
      return;
    }
    if (motivo.length > 500 || !acao) {
      setErroAcao("A justificativa deve ter no máximo 500 caracteres.");
      return;
    }
    setSalvando(true);
    setErroAcao("");
    try {
      await analisarAvariaApi(acao.avaria.id, { decisao: acao.decisao, justificativa: motivo });
      const avariaId = acao.avaria.id;
      setAcao(null);
      setJustificativa("");
      setHistoricoAberto(null);
      setHistoricos((atuais) => {
        const atualizados = { ...atuais };
        delete atualizados[avariaId];
        return atualizados;
      });
      setRevisao((valor) => valor + 1);
    } catch (error: unknown) {
      setErroAcao(mensagemErro(error, "Não foi possível salvar a avaliação."));
    } finally {
      setSalvando(false);
    }
  };

  const alterarFiltroVeiculo = (valor: string) => {
    setPagina(1);
    setVeiculoId(valor);
  };
  const alterarFiltroSituacao = (valor: string) => {
    setPagina(1);
    setSituacao(valor as "" | SituacaoAvaria);
  };

  const inicio = total === 0 ? 0 : (pagina - 1) * PAGE_SIZE + 1;
  const fim = Math.min(pagina * PAGE_SIZE, total);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <header className="space-y-1">
        <p className="text-sm font-medium text-slate-500">Manutenção e segurança da frota</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Avarias de viagem
        </h1>
        <p className="text-sm text-slate-600">
          Analise as ocorrências registradas no checklist de retorno e acompanhe a decisão.
        </p>
      </header>

      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <Select
          label="Veículo"
          value={veiculoId}
          onChange={(event) => alterarFiltroVeiculo(event.target.value)}
          options={[
            { value: "", label: "Todos os veículos" },
            ...veiculos.map((veiculo) => ({
              value: veiculo.id,
              label: `${veiculo.placa} · ${veiculo.modelo}`,
            })),
          ]}
          disabled={Boolean(erroVeiculos)}
          error={erroVeiculos || undefined}
        />
        <Select
          label="Situação"
          value={situacao}
          onChange={(event) => alterarFiltroSituacao(event.target.value)}
          options={[
            { value: "", label: "Todas as situações" },
            { value: "PENDENTE", label: SITUACAO_LABEL.PENDENTE },
            { value: "LIBERADA", label: SITUACAO_LABEL.LIBERADA },
            { value: "ENCAMINHADA_MANUTENCAO", label: SITUACAO_LABEL.ENCAMINHADA_MANUTENCAO },
          ]}
        />
      </Card>

      {erro && (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <p role="alert" className="text-sm text-rose-700">
            {erro}
          </p>
          <Button type="button" variant="outline" onClick={() => setRevisao((valor) => valor + 1)}>
            Tentar novamente
          </Button>
        </Card>
      )}

      {!erro && carregando && (
        <Card role="status" className="py-8 text-center text-sm text-slate-500">
          Carregando avarias...
        </Card>
      )}

      {!erro && !carregando && registros.length === 0 && (
        <Card className="space-y-2 p-8 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
          <p className="font-semibold text-slate-800">Nenhuma avaria encontrada.</p>
          <p className="text-sm text-slate-500">
            Ocorrências do checklist de retorno aparecerão aqui.
          </p>
        </Card>
      )}

      {!erro && registros.length > 0 && (
        <section aria-label="Fila de avarias" className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Exibindo {inicio}–{fim} de {total} registro(s)
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => setRevisao((valor) => valor + 1)}
              disabled={carregando}
            >
              Atualizar
            </Button>
          </div>
          {registros.map((avaria) => {
            const aberto = historicoAberto === avaria.id;
            return (
              <Card key={avaria.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold tracking-wide text-slate-700">
                      Viagem {avaria.solicitacao.protocolo}
                    </p>
                    <h2 className="mt-1 text-base font-bold text-slate-950">
                      {avaria.veiculo.placa} · {avaria.veiculo.modelo}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {avaria.solicitacao.origem || "Origem não informada"} →{" "}
                      {avaria.solicitacao.destino || "Destino não informado"}
                    </p>
                  </div>
                  <Badge variant={SITUACAO_VARIANT[avaria.situacao]} dot>
                    {SITUACAO_LABEL[avaria.situacao]}
                  </Badge>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <p className="whitespace-pre-wrap text-sm text-slate-800">{avaria.descricao}</p>
                  </div>
                </div>

                <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-3">
                  <p className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                    Registrada {formatarDataHora(avaria.criadaEm)}
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                    {avaria.analisadaPor
                      ? `Analisada por ${avaria.analisadaPor.nome}${avaria.analisadaEm ? ` · ${formatarDataHora(avaria.analisadaEm)}` : ""}`
                      : "Aguardando responsável pela análise"}
                  </p>
                  {avaria.manutencao ? (
                    <p className="inline-flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-slate-400" />
                      Manutenção {avaria.manutencao.status.toLowerCase()}
                    </p>
                  ) : (
                    <p className="text-slate-500">
                      Veículo: {avaria.veiculo.ativo ? "ativo" : "inativo"}
                    </p>
                  )}
                </div>

                {avaria.justificativa && (
                  <p className="border-l-2 border-slate-300 pl-3 text-sm text-slate-700">
                    <span className="font-semibold">Decisão:</span> {avaria.justificativa}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {avaria.situacao === "PENDENTE" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={carregando}
                        leftIcon={<CheckCircle2 className="h-4 w-4" />}
                        onClick={() => abrirAnalise(avaria, "LIBERAR")}
                      >
                        Liberar veículo
                      </Button>
                      <Button
                        type="button"
                        disabled={carregando}
                        leftIcon={<Wrench className="h-4 w-4" />}
                        onClick={() => abrirAnalise(avaria, "ENCAMINHAR_MANUTENCAO")}
                      >
                        Encaminhar para manutenção
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void abrirHistorico(avaria.id)}
                    aria-expanded={aberto}
                    aria-controls={`historico-${avaria.id}`}
                  >
                    {aberto ? "Ocultar histórico" : "Ver histórico"}
                  </Button>
                </div>

                {aberto && (
                  <div
                    id={`historico-${avaria.id}`}
                    className="space-y-2 rounded-lg bg-slate-50 p-3"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      Histórico da avaria
                    </h3>
                    {historicoCarregando === avaria.id ? (
                      <p role="status" className="text-sm text-slate-500">
                        Carregando histórico...
                      </p>
                    ) : erroHistorico ? (
                      <div className="space-y-2">
                        <p role="alert" className="text-sm text-rose-700">
                          {erroHistorico}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void carregarHistorico(avaria.id)}
                        >
                          Tentar novamente
                        </Button>
                      </div>
                    ) : (historicos[avaria.id] ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum evento no histórico.</p>
                    ) : (
                      <ol className="space-y-2">
                        {historicos[avaria.id].map((evento) => (
                          <li key={evento.id} className="border-l-2 border-slate-300 pl-3 text-sm">
                            <p className="font-semibold text-slate-800">
                              {SITUACAO_LABEL[evento.situacaoNova as SituacaoAvaria] ??
                                evento.situacaoNova}
                              {" · "}
                              {evento.autor.nome}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatarDataHora(evento.criadoEm)}
                            </p>
                            {evento.justificativa && (
                              <p className="mt-1 whitespace-pre-wrap text-slate-700">
                                {evento.justificativa}
                              </p>
                            )}
                            {evento.manutencao && (
                              <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                                <Wrench className="h-3 w-3" /> Manutenção{" "}
                                {evento.manutencao.status.toLowerCase()}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || carregando}
                onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-slate-500">
                Página {pagina} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagina >= totalPages || carregando}
                onClick={() => setPagina((atual) => Math.min(totalPages, atual + 1))}
              >
                Próxima
              </Button>
            </div>
          )}
        </section>
      )}

      <Modal
        isOpen={Boolean(acao)}
        onClose={fecharAnalise}
        title={acao?.decisao === "LIBERAR" ? "Liberar veículo" : "Encaminhar para manutenção"}
        description={
          acao?.decisao === "LIBERAR"
            ? "Confirme que a avaria foi avaliada e o veículo está apto para voltar à operação."
            : "Será criada uma manutenção corretiva vinculada a esta avaria."
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={fecharAnalise} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void salvarAnalise()} isLoading={salvando}>
              Confirmar decisão
            </Button>
          </>
        }
      >
        {acao && (
          <div className="space-y-4">
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {acao.avaria.veiculo.placa} · viagem {acao.avaria.solicitacao.protocolo}
            </p>
            <Textarea
              label="Justificativa da avaliação"
              required
              maxLength={500}
              rows={4}
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
              disabled={salvando}
              error={erroAcao || undefined}
              placeholder="Descreva a avaliação e o motivo da decisão."
            />
            {acao.decisao === "ENCAMINHAR_MANUTENCAO" && (
              <p className="text-xs text-slate-500">
                O veículo permanecerá bloqueado até a conclusão das manutenções abertas.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
