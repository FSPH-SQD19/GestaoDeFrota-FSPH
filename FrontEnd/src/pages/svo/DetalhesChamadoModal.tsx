import type { ChamadoSvo } from "../../services/svo";
import {
  classificarChamado,
  STATUS_CHAMADO_LABEL,
  STATUS_CHAMADO_VARIANT,
} from "./svoApresentacao";
import { Button, Modal, Badge } from "../../components/common";
import { Detail } from "./DetalheSvo";
export function DetalhesChamadoModal({
  selecionado,
  onClose: fecharModal,
  abrirTriagem,
  abrirEmissaoOrdem,
}: {
  selecionado: ChamadoSvo;
  onClose: () => void;
  abrirTriagem: (chamado: ChamadoSvo) => void;
  abrirEmissaoOrdem: (chamado: ChamadoSvo) => void;
}) {
  const selecionadoStatus = classificarChamado(selecionado);

  const footer = (
    <>
      <Button variant="outline" onClick={fecharModal}>
        Fechar
      </Button>
      {selecionadoStatus === "EM_ANALISE" && (
        <Button onClick={() => abrirTriagem(selecionado)}>Realizar triagem</Button>
      )}
      {selecionadoStatus === "AGUARDANDO_ORDEM" && (
        <Button onClick={() => abrirEmissaoOrdem(selecionado)}>Emitir ordem</Button>
      )}
    </>
  );
  return (
    <Modal
      isOpen
      onClose={fecharModal}
      title="Detalhes do chamado"
      description="Resumo completo do atendimento, triagem e despacho operacional."
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-600">
            {selecionado.numeroProtocolo ?? selecionado.id}
          </span>
          {selecionadoStatus && (
            <Badge variant={STATUS_CHAMADO_VARIANT[selecionadoStatus]} dot>
              {STATUS_CHAMADO_LABEL[selecionadoStatus]}
            </Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Nome do falecido" value={selecionado.nomeFalecido || "Não informado"} />
          <Detail
            label="Endereço da ocorrência"
            value={selecionado.enderecoOcorrencia || "Não informado"}
          />
          <Detail
            label="Atendente responsável"
            value={selecionado.atendente?.nome || "Registrado na central"}
          />
          <Detail
            label="Declaração de óbito"
            value={selecionado.ordemColeta?.numeroDeclaracaoObito || "Não informada"}
          />
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Relato da ocorrência
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {selecionado.relatoOcorrencia || "Sem relato adicional."}
          </p>
        </div>

        {selecionado.justificativaTriagem && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Parecer da triagem
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              {selecionado.justificativaTriagem}
            </p>
          </div>
        )}

        {selecionado.ordemColeta && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail
              label="Viatura alocada"
              value={
                selecionado.ordemColeta.veiculo
                  ? `${selecionado.ordemColeta.veiculo.modelo} (${selecionado.ordemColeta.veiculo.placa})`
                  : "Não informada"
              }
            />
            <Detail
              label="Condutor alocado"
              value={
                selecionado.ordemColeta.motorista?.usuario?.nome ||
                selecionado.ordemColeta.motorista?.numeroCnh ||
                "Não informado"
              }
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
