import { useEffect, useState } from "react";
import { RemanejamentoSvo } from "./RemanejamentoSvo";
import {
  obterChamadoSvoPorId,
  type ViaturaSvo,
  type MotoristaSvo,
  type ChamadoSvo,
} from "../../services/svo";
import {
  classificarChamado,
  STATUS_CHAMADO_LABEL,
  STATUS_CHAMADO_VARIANT,
  formatarDataHoraColeta,
} from "./svoApresentacao";
import { Button, Modal, Badge } from "../../components/common";
import { Detail } from "./DetalheSvo";
import { HistoricoPublicoSvo } from "./HistoricoPublicoSvo";

export function DetalhesChamadoModal({
  selecionado,
  onClose: fecharModal,
  abrirTriagem,
  abrirEmissaoOrdem,
  viaturas = [],
  motoristas = [],
  onRemanejado,
  somenteExterno = false,
}: {
  viaturas?: ViaturaSvo[];
  motoristas?: MotoristaSvo[];
  onRemanejado?: () => void;
  selecionado: ChamadoSvo;
  onClose: () => void;
  abrirTriagem: (chamado: ChamadoSvo) => void;
  abrirEmissaoOrdem: (chamado: ChamadoSvo) => void;
  somenteExterno?: boolean;
}) {
  const [detalhe, setDetalhe] = useState<ChamadoSvo>(selecionado);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setDetalhe(selecionado);
    setCarregandoHistorico(true);

    obterChamadoSvoPorId(selecionado.id)
      .then((atualizado) => {
        if (!cancelado) setDetalhe(atualizado);
      })
      .catch(() => {
        // Mantém os dados já carregados na fila caso a consulta individual falhe
      })
      .finally(() => {
        if (!cancelado) setCarregandoHistorico(false);
      });

    return () => {
      cancelado = true;
    };
  }, [selecionado]);

  const selecionadoStatus = classificarChamado(detalhe);

  const footer = (
    <>
      <Button variant="outline" onClick={fecharModal}>
        Fechar
      </Button>
      {!somenteExterno && selecionadoStatus === "EM_ANALISE" && (
        <Button onClick={() => abrirTriagem(detalhe)}>Realizar triagem</Button>
      )}
      {!somenteExterno && selecionadoStatus === "AGUARDANDO_ORDEM" && (
        <Button onClick={() => abrirEmissaoOrdem(detalhe)}>Emitir ordem</Button>
      )}
    </>
  );

  return (
    <Modal
      isOpen
      onClose={fecharModal}
      title={somenteExterno ? "Acompanhamento da solicitação" : "Detalhes do chamado"}
      description={
        somenteExterno
          ? "Histórico público seguro das etapas da sua solicitação."
          : "Resumo completo do atendimento, triagem e despacho operacional."
      }
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-600">
            {detalhe.numeroProtocolo ?? detalhe.id}
          </span>
          {selecionadoStatus && (
            <Badge variant={STATUS_CHAMADO_VARIANT[selecionadoStatus]} dot>
              {STATUS_CHAMADO_LABEL[selecionadoStatus]}
            </Badge>
          )}
        </div>

        {somenteExterno ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail
              label="Protocolo"
              value={detalhe.numeroProtocolo ?? detalhe.id}
            />
            <Detail
              label="Data de abertura"
              value={formatarDataHoraColeta(detalhe.criadoEm)}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Nome do falecido" value={detalhe.nomeFalecido || "Não informado"} />
              <Detail
                label="Endereço da ocorrência"
                value={detalhe.enderecoOcorrencia || "Não informado"}
              />
              <Detail
                label="Atendente responsável"
                value={detalhe.atendente?.nome || "Registrado na central"}
              />
              <Detail
                label="Declaração de óbito"
                value={detalhe.ordemColeta?.numeroDeclaracaoObito || "Não informada"}
              />
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Relato da ocorrência
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {detalhe.relatoOcorrencia || "Sem relato adicional."}
              </p>
            </div>

            {detalhe.justificativaTriagem && (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Parecer da triagem
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {detalhe.justificativaTriagem}
                </p>
              </div>
            )}

            {detalhe.ordemColeta && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail
                  label="Saída"
                  value={formatarDataHoraColeta(detalhe.ordemColeta.dataHoraSaida)}
                />
                <Detail
                  label="Chegada ao local"
                  value={formatarDataHoraColeta(detalhe.ordemColeta.dataHoraChegadaLocal)}
                />
                <Detail
                  label="Entrega ao SVO"
                  value={formatarDataHoraColeta(detalhe.ordemColeta.dataHoraEntregaSvo)}
                />
                <Detail
                  label="Viatura alocada"
                  value={
                    detalhe.ordemColeta.veiculo
                      ? `${detalhe.ordemColeta.veiculo.modelo} (${detalhe.ordemColeta.veiculo.placa})`
                      : "Não informada"
                  }
                />
                <Detail
                  label="Condutor alocado"
                  value={
                    detalhe.ordemColeta.motorista?.usuario?.nome ||
                    detalhe.ordemColeta.motorista?.numeroCnh ||
                    "Não informado"
                  }
                />
              </div>
            )}

            {detalhe.ordemColeta && onRemanejado && (
              <RemanejamentoSvo
                ordem={detalhe.ordemColeta}
                viaturas={viaturas}
                motoristas={motoristas}
                onConcluido={onRemanejado}
              />
            )}
          </>
        )}

        <HistoricoPublicoSvo
          historico={detalhe.historicoPublico}
          carregando={carregandoHistorico}
        />
      </div>
    </Modal>
  );
}