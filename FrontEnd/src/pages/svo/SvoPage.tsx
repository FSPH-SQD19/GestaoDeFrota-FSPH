import { useState } from "react";
import { AlertCircle, CheckCircle2, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { cn } from "../../lib/utils";
import {
  concluirColetaSvo,
  concluirDesinfeccaoSvo,
  extrairErroSvo,
  type ChamadoSvo,
  type ViaturaSvo,
} from "../../services/svo";
import { useSvoDados } from "./useSvoDados";
import { IndicadoresSvo } from "./IndicadoresSvo";
import { PlantaoSvo } from "./PlantaoSvo";
import { FilaChamadosSvo } from "./FilaChamadosSvo";
import { FrotaSvo } from "./FrotaSvo";
import { RegistrarChamadoModal } from "./RegistrarChamadoModal";
import { TriagemChamadoModal } from "./TriagemChamadoModal";
import { OrdemColetaModal } from "./OrdemColetaModal";
import { DetalhesChamadoModal } from "./DetalhesChamadoModal";
type ModalSvo = "REGISTRO" | "TRIAGEM" | "ORDEM" | "DETALHE" | null;

export function SvoPage() {
  const { user } = useAuth();
  const dados = useSvoDados();
  const {
    carregando,
    erroPagina,
    erroRecursos,
    setErroPagina,
    setErroRecursos,
    dispararRecarregamento,
  } = dados;
  const [processandoAcaoId, setProcessandoAcaoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [selecionado, setSelecionado] = useState<ChamadoSvo | null>(null);
  const [modal, setModal] = useState<ModalSvo>(null);
  const fecharModal = () => {
    setModal(null);
    setSelecionado(null);
  };
  const abrirRegistro = () => {
    setSelecionado(null);
    setModal("REGISTRO");
  };
  const abrirTriagem = (chamado: ChamadoSvo) => {
    setSelecionado(chamado);
    setModal("TRIAGEM");
  };
  const abrirEmissaoOrdem = (chamado: ChamadoSvo) => {
    setSelecionado(chamado);
    setModal("ORDEM");
  };
  const abrirDetalhes = (chamado: ChamadoSvo) => {
    setSelecionado(chamado);
    setModal("DETALHE");
  };
  const concluirFormulario = (mensagem: string) => {
    fecharModal();
    setAviso(mensagem);
    dispararRecarregamento();
  };
  const handleConcluirColeta = async (chamado: ChamadoSvo) => {
    if (processandoAcaoId) return;
    setProcessandoAcaoId(chamado.id);
    setErroPagina("");

    try {
      await concluirColetaSvo(chamado.id);
      const protocolo = chamado.numeroProtocolo ?? chamado.id;
      setAviso(
        `Coleta do chamado ${protocolo} concluída. Quando não houver outras ordens ativas na viatura, ela entra em desinfecção obrigatória.`,
      );
      dispararRecarregamento();
    } catch (erro: unknown) {
      setErroPagina(extrairErroSvo(erro, "Não foi possível concluir a ordem de coleta."));
    } finally {
      setProcessandoAcaoId(null);
    }
  };

  const handleConcluirDesinfeccao = async (viatura: ViaturaSvo) => {
    if (processandoAcaoId) return;
    setProcessandoAcaoId(viatura.id);
    setErroPagina("");

    try {
      await concluirDesinfeccaoSvo(viatura.id);
      setAviso(
        `Desinfecção confirmada: viatura ${viatura.modelo} (${viatura.placa}) liberada para novas coletas.`,
      );
      dispararRecarregamento();
    } catch (erro: unknown) {
      setErroPagina(extrairErroSvo(erro, "Não foi possível confirmar a desinfecção da viatura."));
    } finally {
      setProcessandoAcaoId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-rose-600">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Operação especializada
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Central de operações SVO
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chamados, triagem e disponibilidade das viaturas em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-right sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Acesso
            </p>
            <p className="text-xs font-bold text-slate-700">
              {user?.roles.includes("ADMIN") ? "Administrador" : "Atendente SVO"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => dispararRecarregamento()}
              disabled={carregando}
              aria-label="Atualizar dados SVO"
              leftIcon={<RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />}
            >
              Atualizar
            </Button>
            <Button onClick={abrirRegistro} leftIcon={<Plus className="h-4 w-4" />}>
              Registrar chamado
            </Button>
          </div>
        </div>
      </div>

      {aviso && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {aviso}
          </span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setAviso("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {(erroPagina || erroRecursos) && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {erroPagina || erroRecursos}
          </span>
          <button
            type="button"
            aria-label="Fechar erro"
            onClick={() => {
              setErroPagina("");
              setErroRecursos("");
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <IndicadoresSvo indicadores={dados.indicadores} totalViaturas={dados.viaturas.length} />
      <PlantaoSvo {...dados} />
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
        <FilaChamadosSvo
          {...dados}
          processandoAcaoId={processandoAcaoId}
          abrirTriagem={abrirTriagem}
          abrirEmissaoOrdem={abrirEmissaoOrdem}
          abrirDetalhes={abrirDetalhes}
          handleConcluirColeta={handleConcluirColeta}
        />
        <FrotaSvo
          viaturas={dados.viaturas}
          processandoAcaoId={processandoAcaoId}
          handleConcluirDesinfeccao={handleConcluirDesinfeccao}
        />
      </div>
      {modal === "REGISTRO" && (
        <RegistrarChamadoModal
          onClose={fecharModal}
          onConcluido={(mensagem) => {
            dados.limparFiltros();
            concluirFormulario(mensagem);
          }}
        />
      )}
      {modal === "TRIAGEM" && selecionado && (
        <TriagemChamadoModal
          key={selecionado.id}
          selecionado={selecionado}
          onClose={fecharModal}
          onConcluido={concluirFormulario}
        />
      )}
      {modal === "ORDEM" && selecionado && (
        <OrdemColetaModal
          key={selecionado.id}
          selecionado={selecionado}
          viaturas={dados.viaturas}
          motoristas={dados.motoristas}
          escalasAtuais={dados.escalasAtuais}
          erroRecursos={erroRecursos}
          onClose={fecharModal}
          onConcluido={concluirFormulario}
        />
      )}
      {modal === "DETALHE" && selecionado && (
        <DetalhesChamadoModal
          selecionado={selecionado}
          onClose={fecharModal}
          abrirTriagem={abrirTriagem}
          abrirEmissaoOrdem={abrirEmissaoOrdem}
        />
      )}
    </div>
  );
}
