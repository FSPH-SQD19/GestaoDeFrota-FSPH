import { useState } from "react";
import { criarChamadoSvo, extrairErroSvo } from "../../services/svo";
import { Button, Modal, Input, Textarea } from "../../components/common";
import { ErroModalSvo } from "./ErroModalSvo";
export function RegistrarChamadoModal({
  onClose,
  onConcluido,
}: {
  onClose: () => void;
  onConcluido: (mensagem: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroModal, setErroModal] = useState("");
  const fecharModal = () => {
    if (!enviando) onClose();
  };
  const [novoChamado, setNovoChamado] = useState({
    nomeFalecido: "",
    enderecoOcorrencia: "",
    relatoOcorrencia: "",
  });
  const registroValido =
    novoChamado.nomeFalecido.trim().length >= 2 &&
    novoChamado.enderecoOcorrencia.trim().length >= 3 &&
    novoChamado.relatoOcorrencia.trim().length >= 5;

  const handleRegistrarChamado = async () => {
    if (enviando) return;
    setEnviando(true);
    setErroModal("");

    try {
      const criado = await criarChamadoSvo({
        nomeFalecido: novoChamado.nomeFalecido.trim(),
        enderecoOcorrencia: novoChamado.enderecoOcorrencia.trim(),
        relatoOcorrencia: novoChamado.relatoOcorrencia.trim(),
      });
      onConcluido(
        `Chamado ${criado.numeroProtocolo ?? criado.id} registrado com sucesso e incluído na fila de triagem.`,
      );
    } catch (erro: unknown) {
      setErroModal(extrairErroSvo(erro, "Não foi possível registrar o chamado."));
    } finally {
      setEnviando(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={fecharModal} disabled={enviando}>
        Cancelar
      </Button>
      <Button onClick={handleRegistrarChamado} disabled={!registroValido || enviando}>
        {enviando ? "Registrando..." : "Salvar chamado"}
      </Button>
    </>
  );
  return (
    <Modal
      isOpen
      onClose={fecharModal}
      title="Registrar chamado SVO"
      description="Registre os dados recebidos por telefone para iniciar o atendimento na central SVO."
      size="lg"
      footer={footer}
    >
      <ErroModalSvo erroModal={erroModal} />
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome do falecido"
            value={novoChamado.nomeFalecido}
            required
            disabled={enviando}
            onChange={(e) => setNovoChamado((v) => ({ ...v, nomeFalecido: e.target.value }))}
            placeholder="Nome completo informado no atendimento"
          />
          <Input
            label="Endereço da ocorrência"
            value={novoChamado.enderecoOcorrencia}
            required
            disabled={enviando}
            onChange={(e) => setNovoChamado((v) => ({ ...v, enderecoOcorrencia: e.target.value }))}
            placeholder="Rua, número, bairro e município"
          />
        </div>
        <Textarea
          label="Relato da ocorrência"
          value={novoChamado.relatoOcorrencia}
          required
          rows={4}
          disabled={enviando}
          onChange={(e) => setNovoChamado((v) => ({ ...v, relatoOcorrencia: e.target.value }))}
          placeholder="Registre as circunstâncias do óbito, telefone de retorno e informações da ligação."
          helperText="Mínimo de 5 caracteres. O chamado será salvo com status Aguardando triagem."
        />
      </div>
    </Modal>
  );
}
