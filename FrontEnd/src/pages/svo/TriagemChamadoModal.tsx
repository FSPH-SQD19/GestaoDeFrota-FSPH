import { useState } from "react";
import { triarChamadoSvo, extrairErroSvo, type ChamadoSvo } from "../../services/svo";
import { Button, Modal, Textarea } from "../../components/common";
import { ErroModalSvo } from "./ErroModalSvo";
import { Detail } from "./DetalheSvo";
export function TriagemChamadoModal({
  selecionado,
  onClose,
  onConcluido,
}: {
  selecionado: ChamadoSvo;
  onClose: () => void;
  onConcluido: (mensagem: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroModal, setErroModal] = useState("");
  const fecharModal = () => {
    if (!enviando) onClose();
  };
  const [justificativa, setJustificativa] = useState(selecionado.justificativaTriagem ?? "");
  const handleConcluirTriagem = async (decisao: "APROVAR" | "RECUSAR") => {
    if (enviando) return;
    if (decisao === "RECUSAR" && justificativa.trim().length < 3) {
      setErroModal("Informe uma justificativa com pelo menos 3 caracteres para recusar o chamado.");
      return;
    }

    setEnviando(true);
    setErroModal("");

    try {
      const textoJustificativa = justificativa.trim();
      const atualizado = await triarChamadoSvo(selecionado.id, {
        decisao,
        ...(textoJustificativa ? { justificativa: textoJustificativa } : {}),
      });
      const protocolo = atualizado.numeroProtocolo ?? selecionado.numeroProtocolo ?? selecionado.id;
      onConcluido(
        decisao === "APROVAR"
          ? `Triagem aprovada para ${protocolo}. Emita a ordem de coleta para despachar a viatura.`
          : `Chamado ${protocolo} recusado na triagem com justificativa registrada.`,
      );
    } catch (erro: unknown) {
      setErroModal(extrairErroSvo(erro, "Não foi possível registrar a triagem."));
    } finally {
      setEnviando(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={fecharModal} disabled={enviando}>
        Voltar
      </Button>
      <Button
        variant="danger"
        onClick={() => handleConcluirTriagem("RECUSAR")}
        disabled={enviando || justificativa.trim().length < 3}
      >
        {enviando ? "Salvando..." : "Recusar chamado"}
      </Button>
      <Button onClick={() => handleConcluirTriagem("APROVAR")} disabled={enviando}>
        {enviando ? "Salvando..." : "Aprovar triagem"}
      </Button>
    </>
  );
  return (
    <Modal
      isOpen
      onClose={fecharModal}
      title="Triagem do chamado"
      description="Avalie o relato da ocorrência e registre a decisão de triagem."
      size="lg"
      footer={footer}
    >
      <ErroModalSvo erroModal={erroModal} />
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Protocolo" value={selecionado.numeroProtocolo ?? selecionado.id} />
          <Detail label="Nome do falecido" value={selecionado.nomeFalecido || "Não informado"} />
          <Detail
            label="Endereço da ocorrência"
            value={selecionado.enderecoOcorrencia || "Não informado"}
          />
          <Detail
            label="Atendente responsável"
            value={selecionado.atendente?.nome || "Registrado na central"}
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
        <Textarea
          label="Justificativa / parecer da triagem"
          value={justificativa}
          rows={4}
          disabled={enviando}
          onChange={(e) => setJustificativa(e.target.value)}
          placeholder="Registre os critérios clínicos e operacionais avaliados na triagem..."
          helperText="Obrigatória em caso de recusa (mínimo de 3 caracteres)."
        />
      </div>
    </Modal>
  );
}
