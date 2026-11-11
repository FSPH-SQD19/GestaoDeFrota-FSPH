import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, MapPin, RefreshCw, Timer } from "lucide-react";
import { Badge, Button, Card } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { chamadoAbertoParaSla, formatarDuracaoSla, minutosDesde } from "../../lib/svoSla";
import {
  avancarEtapaColetaSvo,
  extrairErroSvo,
  obterMinhasColetasSvo,
  type MinhaColetaSvo,
} from "../../services/svo";
import {
  classificarChamado,
  proximaEtapaColeta,
  STATUS_CHAMADO_LABEL,
  STATUS_CHAMADO_VARIANT,
} from "./svoApresentacao";
import { useAgora } from "./useAgora";

const INTERVALO_POLLING_COLETAS_SVO_MS = 15_000;

function chamadoDaOrdem(ordem: MinhaColetaSvo) {
  return {
    id: ordem.chamado.id,
    numeroProtocolo: ordem.chamado.numeroProtocolo,
    atendenteId: null,
    nomeFalecido: ordem.chamado.nomeFalecido,
    enderecoOcorrencia: ordem.chamado.enderecoOcorrencia,
    relatoOcorrencia: null,
    statusTriagem: ordem.chamado.statusTriagem,
    criadoEm: ordem.chamado.criadoEm,
    ordemColeta: ordem,
  };
}

export function MinhasColetasSvoPage() {
  const { sessionKey } = useAuth();
  const agora = useAgora();
  const [revisao, setRevisao] = useState(0);
  const [resultado, setResultado] = useState<{
    sessionKey: string | null;
    revisao: number;
    coletas: MinhaColetaSvo[] | null;
    erro: string;
  } | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [erroAcao, setErroAcao] = useState("");
  const atual = resultado?.sessionKey === sessionKey ? resultado : null;
  const coletas = atual?.coletas ?? [];
  const erro = atual?.erro ?? "";
  const carregando = resultado?.sessionKey !== sessionKey;
  const aguardando = carregando || resultado?.revisao !== revisao;

  useEffect(() => {
    let ativa = true;
    const carregar = (silencioso: boolean) => {
      void obterMinhasColetasSvo()
        .then((resposta) => {
          if (ativa) setResultado({ sessionKey, revisao, coletas: resposta, erro: "" });
        })
        .catch((error: unknown) => {
          if (!ativa || silencioso) return;
          setResultado({
            sessionKey,
            revisao,
            coletas: null,
            erro: extrairErroSvo(error, "Não foi possível carregar suas coletas SVO."),
          });
        });
    };
    carregar(false);
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") carregar(true);
    }, INTERVALO_POLLING_COLETAS_SVO_MS);
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") carregar(true);
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      ativa = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [sessionKey, revisao]);

  const avancar = async (ordem: MinhaColetaSvo) => {
    if (processandoId) return;
    const proxima = proximaEtapaColeta(ordem.status);
    if (!proxima) return;
    setProcessandoId(ordem.id);
    setAviso("");
    setErroAcao("");
    try {
      await avancarEtapaColetaSvo(ordem.id, proxima.status);
      const protocolo = ordem.chamado.numeroProtocolo ?? ordem.chamado.id;
      setAviso(
        proxima.status === "ENTREGUE_SVO"
          ? `Coleta ${protocolo} entregue no SVO.`
          : `Etapa da coleta ${protocolo} registrada.`,
      );
      setRevisao((valor) => valor + 1);
    } catch (error: unknown) {
      setErroAcao(extrairErroSvo(error, "Não foi possível atualizar a etapa da coleta."));
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
      <header className="space-y-1">
        <p className="text-sm font-medium text-slate-500">Área do motorista</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Coletas SVO
        </h1>
        <p className="text-sm text-slate-600">
          Acompanhe as ordens atribuídas a você e registre saída, chegada e entrega.
        </p>
      </header>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setAviso("");
            setErroAcao("");
            setRevisao((valor) => valor + 1);
          }}
          disabled={aguardando}
          leftIcon={<RefreshCw className={`h-4 w-4 ${aguardando ? "animate-spin" : ""}`} />}
        >
          Atualizar
        </Button>
      </div>

      {aviso && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {aviso}
        </p>
      )}

      {carregando ? (
        <Card role="status" className="py-8 text-center text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando suas coletas SVO...
          </span>
        </Card>
      ) : erro && coletas.length === 0 ? (
        <Card className="space-y-3 p-5 text-center">
          <p role="alert" className="text-sm text-rose-700">
            {erro}
          </p>
          <Button type="button" variant="outline" onClick={() => setRevisao((valor) => valor + 1)}>
            Tentar novamente
          </Button>
        </Card>
      ) : coletas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          Nenhuma coleta SVO ativa atribuída a você.
        </Card>
      ) : (
        <section aria-label="Coletas SVO ativas" className="space-y-3">
          {erroAcao && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erroAcao}
            </p>
          )}
          {coletas.map((ordem) => {
            const chamado = chamadoDaOrdem(ordem);
            const statusOp = classificarChamado(chamado);
            const proxima = proximaEtapaColeta(ordem.status);
            const minutosAbertos = chamadoAbertoParaSla(chamado)
              ? minutosDesde(ordem.chamado.criadoEm, agora)
              : null;
            const protocolo = ordem.chamado.numeroProtocolo ?? ordem.chamado.id;
            const processando = processandoId === ordem.id;
            return (
              <Card key={ordem.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold tracking-wide text-slate-700">
                      {protocolo}
                    </p>
                    <h2 className="mt-1 text-base font-bold text-slate-950">
                      {ordem.chamado.nomeFalecido || "Identificação não informada"}
                    </h2>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={STATUS_CHAMADO_VARIANT[statusOp]} dot size="sm">
                      {STATUS_CHAMADO_LABEL[statusOp]}
                    </Badge>
                    {minutosAbertos != null && (
                      <Badge variant="warning" size="sm">
                        <Timer className="mr-1 inline h-3 w-3" />
                        SLA {formatarDuracaoSla(minutosAbertos)}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="inline-flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {ordem.chamado.enderecoOcorrencia || "Endereço não informado"}
                </p>
                <p className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
                  {ordem.veiculo
                    ? `${ordem.veiculo.placa} · ${ordem.veiculo.modelo}`
                    : "Viatura não informada"}
                </p>
                {proxima && (
                  <Button
                    type="button"
                    className="min-h-11 w-full"
                    disabled={!!processandoId}
                    onClick={() => void avancar(ordem)}
                  >
                    {processando ? "Registrando..." : proxima.label}
                  </Button>
                )}
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
