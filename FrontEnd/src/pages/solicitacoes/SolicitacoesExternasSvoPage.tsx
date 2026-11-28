import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Check, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Badge, Button, Card, Modal, Textarea } from "../../components/common";

import {
  aprovarSolicitacaoExternaSvo,
  listarSolicitacoesExternasSvoGestor,
  recusarSolicitacaoExternaSvo,
  type SolicitacaoExternaSvo,
  type StatusSolicitacaoExternaSvo,
} from "../../services/solicitacoesExternasSvoService";

const STATUS_LABEL: Record<StatusSolicitacaoExternaSvo, string> = {
  AGUARDANDO_TRIAGEM: "Aguardando triagem",
  DEVOLVIDA_PARA_COMPLEMENTACAO: "Aguardar complementação",
  AGUARDANDO_GESTOR: "Aguardando decisão do gestor",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
};

const STATUS_VARIANT: Record<
  StatusSolicitacaoExternaSvo,
  "success" | "info" | "warning" | "danger"
> = {
  AGUARDANDO_TRIAGEM: "warning",
  DEVOLVIDA_PARA_COMPLEMENTACAO: "info",
  AGUARDANDO_GESTOR: "warning",
  APROVADA: "success",
  RECUSADA: "danger",
};

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatarData(iso: string | null | undefined) {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : dataHoraFmt.format(data);
}

export function SolicitacoesExternasSvoPage() {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<SolicitacaoExternaSvo[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [consultaConcluida, setConsultaConcluida] = useState<{
    pagina: number;
    reload: number;
  } | null>(null);
  const [erro, setErro] = useState("");
  const [reload, setReload] = useState(0);
  const carregando = consultaConcluida?.pagina !== pagina || consultaConcluida.reload !== reload;
  const [selecionada, setSelecionada] = useState<SolicitacaoExternaSvo | null>(null);
  const [modo, setModo] = useState<"aprovar" | "recusar" | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroDecisao, setErroDecisao] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [chaveIdempotencia, setChaveIdempotencia] = useState("");
  const salvando = useRef(false);

  useEffect(() => {
    let ativo = true;
    void listarSolicitacoesExternasSvoGestor(pagina, 20)
      .then((resposta) => {
        if (!ativo) return;
        const totalPages = Math.max(1, resposta.meta.totalPages);
        if (pagina > totalPages) {
          setPagina(totalPages);
          return;
        }
        setDados(resposta.data);
        setMeta({ total: resposta.meta.total, totalPages });
        setErro("");
      })
      .catch((error: unknown) => {
        if (ativo)
          setErro(error instanceof Error ? error.message : "Não foi possível carregar a fila.");
      })
      .finally(() => {
        if (ativo) setConsultaConcluida({ pagina, reload });
      });
    return () => {
      ativo = false;
    };
  }, [pagina, reload]);

  const abrirDecisao = (solicitacao: SolicitacaoExternaSvo, novaModo: "aprovar" | "recusar") => {
    setSelecionada(solicitacao);
    setModo(novaModo);
    setJustificativa("");
    setErroDecisao("");
    setChaveIdempotencia(crypto.randomUUID());
  };

  const fecharDecisao = () => {
    if (salvando.current) return;
    setSelecionada(null);
    setModo(null);
    setChaveIdempotencia("");
  };

  const confirmarDecisao = async (event: FormEvent) => {
    event.preventDefault();
    if (!selecionada || !modo || salvando.current) return;
    if (modo === "recusar" && justificativa.trim().length < 3) {
      setErroDecisao("Informe uma justificativa com pelo menos 3 caracteres.");
      return;
    }
    salvando.current = true;
    setEnviando(true);
    setErroDecisao("");
    try {
      const resposta =
        modo === "aprovar"
          ? await aprovarSolicitacaoExternaSvo(selecionada.id, chaveIdempotencia)
          : await recusarSolicitacaoExternaSvo(
              selecionada.id,
              justificativa.trim(),
              chaveIdempotencia,
            );
      setSucesso(
        resposta.mensagem ||
          `Solicitação ${selecionada.protocolo} ${modo === "aprovar" ? "aprovada" : "recusada"}.`,
      );
      setSelecionada(null);
      setModo(null);
      setDados((atuais) => atuais.filter((item) => item.id !== selecionada.id));
      setMeta((atual) => ({ ...atual, total: Math.max(0, atual.total - 1) }));
      setChaveIdempotencia("");
      setReload((valor) => valor + 1);
    } catch (error) {
      setErroDecisao(
        error instanceof Error ? error.message : "Não foi possível registrar a decisão.",
      );
    } finally {
      salvando.current = false;
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Solicitações externas SVO
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Decisões finais sobre solicitações já validadas pela atendente.
          </p>
        </div>
        <Button
          variant="outline"
          leftIcon={<RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />}
          onClick={() => setReload((valor) => valor + 1)}
          disabled={carregando}
        >
          Atualizar
        </Button>
      </div>

      {sucesso && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {sucesso}
        </div>
      )}
      {erro && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertCircle className="h-4 w-4" />
          {erro}
        </div>
      )}

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Fila aguardando gestor</h2>
            <p className="text-xs text-slate-500">{meta.total} solicitação(ões)</p>
          </div>
          <Badge variant="warning" dot>
            Somente triadas
          </Badge>
        </div>
        {carregando ? (
          <p role="status" className="p-8 text-center text-sm text-slate-500">
            Carregando solicitações...
          </p>
        ) : dados.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Nenhuma solicitação aguardando decisão.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {dados.map((item) => (
              <article key={item.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {item.protocolo}
                    </span>
                    <Badge size="sm" variant={STATUS_VARIANT[item.status]}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {item.nomeSolicitante || "Solicitante externo"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.localOcorrencia || item.enderecoOcorrencia || "Local não informado"}
                  </p>
                  {item.relatoTriagem && (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Parecer da triagem
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                        {item.relatoTriagem}
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Triada em {formatarData(item.triadaEm)}
                  </p>
                  {item.chamadoSvoId && (
                    <p className="mt-1 text-xs font-mono text-slate-500">
                      Chamado SVO: {item.chamadoSvoProtocolo || item.chamadoSvoId}
                    </p>
                  )}
                  {item.historico && item.historico.length > 0 && (
                    <details className="mt-2 text-xs text-slate-600">
                      <summary className="cursor-pointer font-semibold text-slate-700">
                        Histórico ({item.historico.length})
                      </summary>
                      <ol className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
                        {item.historico.map((evento, indice) => (
                          <li key={`${evento.criadoEm ?? indice}-${evento.statusNovo}`}>
                            <span className="font-semibold text-slate-700">
                              {STATUS_LABEL[evento.statusNovo]}
                            </span>
                            {evento.statusAnterior && (
                              <span className="text-slate-400">
                                {" "}
                                · de {STATUS_LABEL[evento.statusAnterior]}
                              </span>
                            )}
                            {evento.autorNome && (
                              <span className="text-slate-500"> · {evento.autorNome}</span>
                            )}
                            {evento.criadoEm && (
                              <span className="text-slate-400">
                                {" "}
                                · {formatarData(evento.criadoEm)}
                              </span>
                            )}
                            {evento.justificativa && (
                              <span className="block text-slate-600">{evento.justificativa}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
                {item.status === "AGUARDANDO_GESTOR" && (
                  <div className="flex flex-wrap items-start gap-2">
                    <Button
                      size="sm"
                      leftIcon={<Check className="h-4 w-4" />}
                      onClick={() => abrirDecisao(item, "aprovar")}
                    >
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      leftIcon={<X className="h-4 w-4" />}
                      onClick={() => abrirDecisao(item, "recusar")}
                    >
                      Recusar
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {meta.totalPages > 1 && (
          <div className="flex justify-between border-t border-slate-200 px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((valor) => valor - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs text-slate-500">
              Página {pagina} de {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= meta.totalPages}
              onClick={() => setPagina((valor) => valor + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </Card>

      {selecionada && modo && (
        <Modal
          isOpen
          onClose={fecharDecisao}
          title={`${modo === "aprovar" ? "Aprovar" : "Recusar"} solicitação ${selecionada.protocolo}`}
          description="A decisão somente pode ser registrada após a triagem da atendente."
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={fecharDecisao} disabled={enviando}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="decisao-svo-externa"
                variant={modo === "aprovar" ? "primary" : "danger"}
                isLoading={enviando}
              >
                Confirmar {modo === "aprovar" ? "aprovação" : "recusa"}
              </Button>
            </>
          }
        >
          <form
            id="decisao-svo-externa"
            onSubmit={confirmarDecisao}
            className="space-y-4"
            noValidate
          >
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {selecionada.nomeSolicitante || "Solicitante externo"}
              </p>
              <p className="mt-1 text-slate-600">
                {selecionada.localOcorrencia ||
                  selecionada.enderecoOcorrencia ||
                  "Local não informado"}
              </p>
              {selecionada.relatoTriagem && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Parecer da triagem
                  </p>
                  <p className="mt-1 text-slate-700">{selecionada.relatoTriagem}</p>
                </div>
              )}
              {selecionada.chamadoSvoId && (
                <p className="mt-3 text-xs font-mono text-slate-500">
                  Chamado SVO: {selecionada.chamadoSvoProtocolo || selecionada.chamadoSvoId}
                </p>
              )}
            </div>
            {modo === "aprovar" ? (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                Ao aprovar, o back-end deverá criar ou reutilizar o ChamadoSvo existente. Esta tela
                não cria chamados diretamente.
              </div>
            ) : (
              <Textarea
                label="Justificativa da recusa"
                required
                value={justificativa}
                onChange={(event) => setJustificativa(event.target.value)}
                maxLength={500}
                placeholder="Informe o motivo público da recusa..."
              />
            )}
            {erroDecisao && (
              <p role="alert" className="text-sm text-rose-700">
                {erroDecisao}
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
