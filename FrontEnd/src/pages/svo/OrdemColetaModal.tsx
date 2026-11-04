import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  criarOrdemColetaSvo,
  extrairErroSvo,
  type ChamadoSvo,
  type EscalaSvo,
  type MotoristaSvo,
  type ViaturaSvo,
} from "../../services/svo";
import { motoristaElegivelParaViatura, viaturaElegivel, nomeMotorista } from "./svoApresentacao";
import { Button, Modal, Input, Select } from "../../components/common";
import { ErroModalSvo } from "./ErroModalSvo";
import { Detail } from "./DetalheSvo";
export function OrdemColetaModal({
  selecionado,
  viaturas,
  motoristas,
  escalasAtuais,
  erroRecursos,
  onClose,
  onConcluido,
}: {
  selecionado: ChamadoSvo;
  viaturas: ViaturaSvo[];
  motoristas: MotoristaSvo[];
  escalasAtuais: EscalaSvo[];
  erroRecursos: string;
  onClose: () => void;
  onConcluido: (mensagem: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroModal, setErroModal] = useState("");
  const fecharModal = () => {
    if (!enviando) onClose();
  };
  const viaturasElegiveis = viaturas.filter(viaturaElegivel);
  const selecionarMotoristaPadraoParaViatura = (
    idViatura: string,
    listaMotoristas: MotoristaSvo[],
  ) => {
    const viatura = viaturas.find((v) => v.id === idViatura);
    if (viatura?.motoristaAtual?.id) {
      const motoristaAtual = listaMotoristas.find(
        (motorista) =>
          motorista.id === viatura.motoristaAtual?.id &&
          motoristaElegivelParaViatura(motorista, viatura),
      );
      if (motoristaAtual) return motoristaAtual.id;
    }
    const disponivel = listaMotoristas.find((motorista) => motorista.status === "DISPONIVEL");
    return disponivel?.id ?? "";
  };

  const [alocacao, setAlocacao] = useState(() => {
    const escalaElegivel = escalasAtuais.find((escala) => {
      const viatura = viaturasElegiveis.find((item) => item.id === escala.veiculo.id);
      const motorista = motoristas.find((item) => item.id === escala.motorista.id);
      return !!viatura && !!motorista && motoristaElegivelParaViatura(motorista, viatura);
    });
    const primeiraElegivel =
      viaturasElegiveis.find((viatura) => viatura.id === escalaElegivel?.veiculo.id) ??
      viaturasElegiveis[0];
    const idViaturaInicial = primeiraElegivel?.id ?? "";
    return {
      viaturaId: idViaturaInicial,
      numeroDeclaracaoObito: "",
      motoristaId:
        escalaElegivel && escalaElegivel.veiculo.id === idViaturaInicial
          ? escalaElegivel.motorista.id
          : selecionarMotoristaPadraoParaViatura(idViaturaInicial, motoristas),
    };
  });
  const { viaturaId, motoristaId, numeroDeclaracaoObito } = alocacao;
  const viaturaDaOrdem = viaturas.find((v) => v.id === viaturaId);
  const motoristasParaOrdem = motoristas.filter((motorista) =>
    motoristaElegivelParaViatura(motorista, viaturaDaOrdem),
  );

  const handleEmitirOrdem = async () => {
    if (enviando) return;
    if (!viaturaId || !motoristaId) {
      setErroModal("Selecione a viatura SVO e o motorista responsável.");
      return;
    }

    setEnviando(true);
    setErroModal("");

    try {
      const viaturaEscolhida = viaturas.find((v) => v.id === viaturaId);
      const decl = numeroDeclaracaoObito.trim();
      await criarOrdemColetaSvo(selecionado.id, {
        veiculoId: viaturaId,
        motoristaId,
        ...(decl ? { numeroDeclaracaoObito: decl } : {}),
      });
      const protocolo = selecionado.numeroProtocolo ?? selecionado.id;
      onConcluido(
        `Ordem de coleta emitida para ${protocolo}${viaturaEscolhida ? ` · ${viaturaEscolhida.modelo} (${viaturaEscolhida.placa})` : ""}.`,
      );
    } catch (erro: unknown) {
      setErroModal(extrairErroSvo(erro, "Não foi possível emitir a ordem de coleta."));
    } finally {
      setEnviando(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={fecharModal} disabled={enviando}>
        Cancelar
      </Button>
      <Button
        onClick={handleEmitirOrdem}
        disabled={
          enviando ||
          !!erroRecursos ||
          !viaturaDaOrdem ||
          !motoristasParaOrdem.some((motorista) => motorista.id === motoristaId)
        }
      >
        {enviando ? "Emitindo..." : "Emitir ordem de coleta"}
      </Button>
    </>
  );
  return (
    <Modal
      isOpen
      onClose={fecharModal}
      title="Emitir ordem de coleta"
      description="Aloque uma viatura exclusiva do SVO e um condutor habilitado respeitando o limite de capacidade."
      size="lg"
      footer={footer}
    >
      <ErroModalSvo erroModal={erroModal} />
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            Triagem aprovada
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            {selecionado.numeroProtocolo ?? selecionado.id} ·{" "}
            {selecionado.nomeFalecido || "Falecido"} ·{" "}
            {selecionado.enderecoOcorrencia || "Local não informado"}
          </p>
          {selecionado.justificativaTriagem && (
            <p className="mt-2 text-xs leading-relaxed text-emerald-900">
              Parecer: {selecionado.justificativaTriagem}
            </p>
          )}
        </div>

        {viaturasElegiveis.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Não há viatura exclusiva do SVO disponível com vagas livres no momento.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Viatura SVO"
              value={viaturaId}
              required
              disabled={enviando}
              onChange={(e) => {
                const novoId = e.target.value;
                setAlocacao((atual) => ({
                  ...atual,
                  viaturaId: novoId,
                  motoristaId: selecionarMotoristaPadraoParaViatura(novoId, motoristas),
                }));
              }}
              placeholder="Selecione uma viatura"
              options={viaturasElegiveis.map((v) => ({
                value: v.id,
                label: `${v.modelo} · ${v.placa} (${v.capacidadeMaxima - v.ocupacaoAtual} vaga(s) livre(s))`,
              }))}
            />
            <Select
              label="Motorista habilitado"
              value={motoristaId}
              required
              disabled={enviando || motoristasParaOrdem.length === 0}
              onChange={(e) => setAlocacao((atual) => ({ ...atual, motoristaId: e.target.value }))}
              placeholder="Selecione um motorista"
              options={motoristasParaOrdem.map((m) => ({
                value: m.id,
                label: nomeMotorista(m),
              }))}
            />
            <div className="sm:col-span-2">
              <Input
                label="Número da Declaração de Óbito (opcional)"
                value={numeroDeclaracaoObito}
                disabled={enviando}
                onChange={(e) =>
                  setAlocacao((atual) => ({ ...atual, numeroDeclaracaoObito: e.target.value }))
                }
                placeholder="Ex.: DO-2026-009841"
              />
            </div>
          </div>
        )}

        {viaturaDaOrdem && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail
              label="Placa / Modelo"
              value={`${viaturaDaOrdem.placa} · ${viaturaDaOrdem.modelo}`}
            />
            <Detail
              label="Vagas reservadas após emissão"
              value={`${viaturaDaOrdem.ocupacaoAtual + 1}/${viaturaDaOrdem.capacidadeMaxima} vagas`}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
