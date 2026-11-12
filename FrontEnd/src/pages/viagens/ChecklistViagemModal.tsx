import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  MapPin,
  Trash2,
} from "lucide-react";
import { Badge, Button, Input, Modal, Textarea } from "../../components/common";
import { concluirViagemApi, iniciarViagemApi } from "../../services/solicitacoesService";
import type {
  ExecucaoViagemResposta,
  ModoChecklistViagem,
  SolicitacaoViagem,
} from "../../types/solicitacao";
import {
  interpretarOdometro,
  ITENS_CHECKLIST_RETORNO,
  ITENS_CHECKLIST_SAIDA,
  normalizarNumero,
  validarChecklistRetorno,
  validarChecklistSaida,
  type ChaveItemRetorno,
  type ChaveItemSaida,
} from "./checklistViagemRules";
import { comprimirFotoChecklist, tamanhoAproximadoKb } from "./imagemChecklist";

const formatadorKm = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export type ViagemChecklistAlvo = Pick<
  SolicitacaoViagem,
  "id" | "protocolo" | "origem" | "destino" | "veiculoAlocado" | "execucao"
>;

export interface ChecklistViagemModalProps {
  isOpen?: boolean;
  modo: ModoChecklistViagem;
  viagem: ViagemChecklistAlvo;
  /** Odômetro atual conhecido do veículo caso não venha em `viagem.veiculoAlocado.odometroAtual`. */
  odometroAtualVeiculo?: number | string | null;
  onClose: () => void;
  onConcluido: (mensagem: string, resposta: ExecucaoViagemResposta) => void;
}

const ESTADO_INICIAL_SAIDA: Record<ChaveItemSaida, boolean> = {
  pneus: true,
  freiosLuzes: true,
  combustivel: true,
  documentos: true,
  limpeza: true,
};

const ESTADO_INICIAL_RETORNO: Record<ChaveItemRetorno, boolean> = {
  pneusLataria: true,
  estacionadoLocalCorreto: true,
  limpezaInterna: true,
  documentosChaveDevolvidos: true,
};

export const ChecklistViagemModal: React.FC<ChecklistViagemModalProps> = ({
  isOpen = true,
  modo,
  viagem,
  odometroAtualVeiculo,
  onClose,
  onConcluido,
}) => {
  if (!isOpen) return null;

  return (
    <ConteudoChecklistViagemModal
      key={`${viagem.id}:${modo}`}
      modo={modo}
      viagem={viagem}
      odometroAtualVeiculo={odometroAtualVeiculo}
      onClose={onClose}
      onConcluido={onConcluido}
    />
  );
};

interface ConteudoProps {
  modo: ModoChecklistViagem;
  viagem: ViagemChecklistAlvo;
  odometroAtualVeiculo?: number | string | null;
  onClose: () => void;
  onConcluido: (mensagem: string, resposta: ExecucaoViagemResposta) => void;
}

const ConteudoChecklistViagemModal: React.FC<ConteudoProps> = ({
  modo,
  viagem,
  odometroAtualVeiculo,
  onClose,
  onConcluido,
}) => {
  const isSaida = modo === "SAIDA";
  const formId = `form-checklist-viagem-${viagem.id}-${modo}`;

  const odometroMinimo =
    normalizarNumero(odometroAtualVeiculo) ??
    normalizarNumero(viagem.veiculoAlocado?.odometroAtual);
  const kmInicialRegistrado = normalizarNumero(viagem.execucao?.kmInicial);
  const referenciaMinima = isSaida
    ? odometroMinimo
    : kmInicialRegistrado !== null && odometroMinimo !== null
      ? Math.max(kmInicialRegistrado, odometroMinimo)
      : (kmInicialRegistrado ?? odometroMinimo);

  const [odometroTexto, setOdometroTexto] = useState(() =>
    isSaida && odometroMinimo !== null ? String(odometroMinimo) : "",
  );
  const [fotoOdometro, setFotoOdometro] = useState<string | null>(null);
  const [erroFotoOdometro, setErroFotoOdometro] = useState<string | null>(null);
  const [processandoFotoOdometro, setProcessandoFotoOdometro] = useState(false);

  const [itensSaida, setItensSaida] =
    useState<Record<ChaveItemSaida, boolean>>(ESTADO_INICIAL_SAIDA);
  const [itensRetorno, setItensRetorno] =
    useState<Record<ChaveItemRetorno, boolean>>(ESTADO_INICIAL_RETORNO);
  const [observacoes, setObservacoes] = useState("");
  const [semOcorrencias, setSemOcorrencias] = useState(true);
  const [ocorrencias, setOcorrencias] = useState("");
  const [fotoAvaria, setFotoAvaria] = useState<string | null>(null);
  const [erroFotoAvaria, setErroFotoAvaria] = useState<string | null>(null);
  const [processandoFotoAvaria, setProcessandoFotoAvaria] = useState(false);

  const [erroOdometro, setErroOdometro] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const salvando = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const bloqueado = enviando || processandoFotoOdometro || processandoFotoAvaria;

  const fechar = () => {
    if (!salvando.current && !processandoFotoOdometro && !processandoFotoAvaria) {
      onClose();
    }
  };

  const totalProblemas = isSaida
    ? ITENS_CHECKLIST_SAIDA.filter(({ chave }) => !itensSaida[chave]).length
    : ITENS_CHECKLIST_RETORNO.filter(({ chave }) => !itensRetorno[chave]).length;

  const temProblemaItens = totalProblemas > 0;
  const exibirBlocoOcorrenciaRetorno = !isSaida && (temProblemaItens || !semOcorrencias);

  const leituraAtual = interpretarOdometro(odometroTexto).valor;
  const distanciaPercorrida =
    !isSaida &&
    kmInicialRegistrado !== null &&
    leituraAtual !== null &&
    leituraAtual >= kmInicialRegistrado
      ? Math.round((leituraAtual - kmInicialRegistrado) * 100) / 100
      : null;

  function restaurarTodosOk() {
    if (bloqueado) return;
    setErroGeral(null);
    if (isSaida) {
      setItensSaida(ESTADO_INICIAL_SAIDA);
    } else {
      setItensRetorno(ESTADO_INICIAL_RETORNO);
    }
  }

  async function capturarFotoOdometro(arquivo: File) {
    setErroFotoOdometro(null);
    setProcessandoFotoOdometro(true);
    try {
      const comprimida = await comprimirFotoChecklist(arquivo);
      if (montado.current) setFotoOdometro(comprimida);
    } catch (error: unknown) {
      if (montado.current) {
        setErroFotoOdometro(
          error instanceof Error ? error.message : "Não foi possível processar a foto do odômetro.",
        );
      }
    } finally {
      if (montado.current) setProcessandoFotoOdometro(false);
    }
  }

  async function capturarFotoAvaria(arquivo: File) {
    setErroFotoAvaria(null);
    setProcessandoFotoAvaria(true);
    try {
      const comprimida = await comprimirFotoChecklist(arquivo);
      if (montado.current) setFotoAvaria(comprimida);
    } catch (error: unknown) {
      if (montado.current) {
        setErroFotoAvaria(
          error instanceof Error ? error.message : "Não foi possível processar a foto da avaria.",
        );
      }
    } finally {
      if (montado.current) setProcessandoFotoAvaria(false);
    }
  }

  async function submeter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando.current || bloqueado) return;

    setErroOdometro(null);
    setErroFotoOdometro(null);
    setErroGeral(null);

    if (isSaida) {
      const validacao = validarChecklistSaida({
        odometroTexto,
        odometroMinimo,
        fotoOdometro,
        itens: itensSaida,
        observacoes,
        fotoAvaria,
      });
      if (!validacao.dados) {
        setErroOdometro(validacao.erroOdometro);
        setErroFotoOdometro(validacao.erroFotoOdometro);
        setErroGeral(validacao.erroGeral);
        return;
      }

      salvando.current = true;
      setEnviando(true);
      try {
        const resposta = await iniciarViagemApi(viagem.id, validacao.dados);
        if (!montado.current) return;
        salvando.current = false;
        setEnviando(false);
        onConcluido(`Viagem ${viagem.protocolo} iniciada com sucesso.`, resposta);
      } catch (error: unknown) {
        if (!montado.current) return;
        salvando.current = false;
        setEnviando(false);
        setErroGeral(
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível iniciar a viagem.",
        );
      }
      return;
    }

    const validacao = validarChecklistRetorno({
      odometroTexto,
      kmInicial: kmInicialRegistrado,
      odometroMinimo,
      fotoOdometro,
      itens: itensRetorno,
      semOcorrencias,
      ocorrencias,
      fotoAvaria,
    });
    if (!validacao.dados) {
      setErroOdometro(validacao.erroOdometro);
      setErroFotoOdometro(validacao.erroFotoOdometro);
      setErroGeral(validacao.erroGeral);
      return;
    }

    salvando.current = true;
    setEnviando(true);
    try {
      const resposta = await concluirViagemApi(viagem.id, validacao.dados);
      if (!montado.current) return;
      salvando.current = false;
      setEnviando(false);
      onConcluido(`Viagem ${viagem.protocolo} concluída com sucesso.`, resposta);
    } catch (error: unknown) {
      if (!montado.current) return;
      salvando.current = false;
      setEnviando(false);
      setErroGeral(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível concluir a viagem.",
      );
    }
  }

  return (
    <Modal
      isOpen
      onClose={fechar}
      size="lg"
      title={isSaida ? "Checklist de Saída da Viagem" : "Checklist de Retorno da Viagem"}
      description={
        isSaida
          ? "Fotografe o painel, informe o odômetro inicial e marque apenas se houver irregularidade."
          : "Fotografe o odômetro final e marque apenas se houver pendência ou ocorrência."
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={fechar} disabled={bloqueado}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            isLoading={enviando}
            disabled={bloqueado}
          >
            {isSaida ? "Confirmar vistoria e iniciar" : "Confirmar vistoria e concluir"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submeter} noValidate className="space-y-5">
        {/* Resumo compacto da viagem (mobile-first) */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-sm font-bold text-slate-900 sm:text-base">
              {viagem.protocolo}
            </span>
            <Badge variant={isSaida ? "info" : "success"}>
              {isSaida ? "Saída do pátio" : "Encerramento de viagem"}
            </Badge>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-600 sm:text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <strong className="font-medium text-slate-800">
                {viagem.origem || "Origem não informada"}
              </strong>{" "}
              →{" "}
              <strong className="font-medium text-slate-800">
                {viagem.destino || "Destino não informado"}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200/70 pt-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5 text-slate-400" />
              {viagem.veiculoAlocado
                ? `${viagem.veiculoAlocado.placa} · ${viagem.veiculoAlocado.modelo}`
                : "Veículo alocado"}
            </span>
            {referenciaMinima !== null && (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 tabular-nums">
                <Gauge className="h-3.5 w-3.5 text-slate-400" />
                {isSaida
                  ? `Odômetro atual: ${formatadorKm.format(referenciaMinima)} km`
                  : `Km de saída: ${formatadorKm.format(referenciaMinima)} km`}
              </span>
            )}
          </div>
        </div>

        {/* Leitura + Foto comprobatória do odômetro */}
        <div className="space-y-3">
          <Input
            id={`odometro-${modo.toLowerCase()}`}
            label={isSaida ? "Odômetro inicial (km)" : "Odômetro final (km)"}
            type="text"
            inputMode="decimal"
            required
            disabled={bloqueado}
            placeholder={referenciaMinima !== null ? `Ex.: ${referenciaMinima}` : "Ex.: 42510,5"}
            leftIcon={<Gauge className="h-4 w-4" />}
            value={odometroTexto}
            onChange={(event) => {
              setOdometroTexto(event.target.value);
              if (erroOdometro) setErroOdometro(null);
            }}
            error={erroOdometro ?? undefined}
            helperText={
              referenciaMinima !== null
                ? `Mínimo aceito: ${formatadorKm.format(referenciaMinima)} km (até 2 casas decimais).`
                : "Informe a quilometragem exata exibida no painel do veículo."
            }
          />

          {distanciaPercorrida !== null && (
            <div
              role="status"
              className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-medium text-blue-800"
            >
              <span>Distância percorrida nesta viagem</span>
              <span className="font-mono font-bold tabular-nums">
                {formatadorKm.format(distanciaPercorrida)} km
              </span>
            </div>
          )}

          <CampoFotoChecklist
            id={`foto-odometro-${modo.toLowerCase()}`}
            label="Foto do painel do odômetro"
            descricao="Tire uma foto nítida mostrando a quilometragem atual para auditoria."
            obrigatoria
            foto={fotoOdometro}
            erro={erroFotoOdometro}
            processando={processandoFotoOdometro}
            desabilitado={bloqueado}
            onSelecionar={capturarFotoOdometro}
            onRemover={() => {
              setFotoOdometro(null);
              setErroFotoOdometro(null);
            }}
          />
        </div>

        {/* Itens do Checklist por Exceção */}
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-900">Itens de verificação</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Todos iniciam como OK. Toque apenas no item que tiver algum problema.
              </p>
            </div>
            {temProblemaItens ? (
              <button
                type="button"
                disabled={bloqueado}
                onClick={restaurarTodosOk}
                className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
              >
                Restaurar todos OK
              </button>
            ) : (
              <Badge variant="success">Tudo OK</Badge>
            )}
          </div>

          <div className="space-y-2">
            {isSaida
              ? ITENS_CHECKLIST_SAIDA.map((item) => {
                  const conforme = itensSaida[item.chave];
                  return (
                    <ItemChecklistBotao
                      key={item.chave}
                      titulo={item.titulo}
                      descricao={item.descricao}
                      conforme={conforme}
                      desabilitado={bloqueado}
                      onAlternar={() => {
                        setItensSaida((atual) => ({ ...atual, [item.chave]: !atual[item.chave] }));
                        if (erroGeral) setErroGeral(null);
                      }}
                    />
                  );
                })
              : ITENS_CHECKLIST_RETORNO.map((item) => {
                  const conforme = itensRetorno[item.chave];
                  return (
                    <ItemChecklistBotao
                      key={item.chave}
                      titulo={item.titulo}
                      descricao={item.descricao}
                      conforme={conforme}
                      desabilitado={bloqueado}
                      onAlternar={() => {
                        setItensRetorno((atual) => ({
                          ...atual,
                          [item.chave]: !atual[item.chave],
                        }));
                        if (erroGeral) setErroGeral(null);
                      }}
                    />
                  );
                })}
          </div>
        </div>

        {/* Saída: se apontou problema exige relato + foto opcional; senão observações opcionais */}
        {isSaida ? (
          temProblemaItens ? (
            <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/30 p-3.5">
              <Textarea
                id="observacoes-saida"
                label="Descrição do problema identificado na saída"
                required
                rows={3}
                maxLength={300}
                disabled={bloqueado}
                placeholder="Descreva a avaria ou pendência encontrada antes de sair..."
                value={observacoes}
                onChange={(event) => {
                  setObservacoes(event.target.value);
                  if (erroGeral) setErroGeral(null);
                }}
              />

              <CampoFotoChecklist
                id="foto-avaria-saida"
                label="Foto da avaria ou problema (opcional)"
                descricao="Registre uma foto do item com problema para resguardar a vistoria de saída."
                obrigatoria={false}
                foto={fotoAvaria}
                erro={erroFotoAvaria}
                processando={processandoFotoAvaria}
                desabilitado={bloqueado}
                onSelecionar={capturarFotoAvaria}
                onRemover={() => {
                  setFotoAvaria(null);
                  setErroFotoAvaria(null);
                }}
              />
            </div>
          ) : (
            <Textarea
              id="observacoes-saida"
              label="Observações de saída (opcional)"
              rows={2}
              maxLength={300}
              disabled={bloqueado}
              placeholder="Algum detalhe adicional sobre o veículo antes de iniciar..."
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
            />
          )
        ) : (
          <div className="space-y-3">
            {!temProblemaItens && (
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700">
                  Ocorrências durante o percurso
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={bloqueado}
                    aria-pressed={semOcorrencias}
                    onClick={() => {
                      setSemOcorrencias(true);
                      if (erroGeral) setErroGeral(null);
                    }}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      semOcorrencias
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Sem ocorrências
                  </button>
                  <button
                    type="button"
                    disabled={bloqueado}
                    aria-pressed={!semOcorrencias}
                    onClick={() => {
                      setSemOcorrencias(false);
                      if (erroGeral) setErroGeral(null);
                    }}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      !semOcorrencias
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Registrar ocorrência / avaria
                  </button>
                </div>
              </div>
            )}

            {exibirBlocoOcorrenciaRetorno && (
              <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/30 p-3.5">
                <Textarea
                  id="relato-ocorrencias-retorno"
                  label="Descrição da ocorrência ou avaria"
                  required
                  rows={3}
                  maxLength={500}
                  disabled={bloqueado}
                  placeholder="Descreva o problema marcado acima ou o que ocorreu durante o percurso..."
                  value={ocorrencias}
                  onChange={(event) => {
                    setOcorrencias(event.target.value);
                    if (erroGeral) setErroGeral(null);
                  }}
                />

                <CampoFotoChecklist
                  id="foto-avaria-retorno"
                  label="Foto da avaria ou ocorrência (opcional)"
                  descricao="Se houver dano visível ou luz de alerta no painel, registre uma foto."
                  obrigatoria={false}
                  foto={fotoAvaria}
                  erro={erroFotoAvaria}
                  processando={processandoFotoAvaria}
                  desabilitado={bloqueado}
                  onSelecionar={capturarFotoAvaria}
                  onRemover={() => {
                    setFotoAvaria(null);
                    setErroFotoAvaria(null);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {erroGeral && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 sm:text-sm"
          >
            {erroGeral}
          </p>
        )}
      </form>
    </Modal>
  );
};

interface ItemChecklistBotaoProps {
  titulo: string;
  descricao: string;
  conforme: boolean;
  desabilitado: boolean;
  onAlternar: () => void;
}

const ItemChecklistBotao: React.FC<ItemChecklistBotaoProps> = ({
  titulo,
  descricao,
  conforme,
  desabilitado,
  onAlternar,
}) => (
  <button
    type="button"
    disabled={desabilitado}
    aria-pressed={!conforme}
    onClick={onAlternar}
    className={`flex min-h-12 w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
      conforme
        ? "border-slate-200 bg-white hover:border-slate-300"
        : "border-amber-300 bg-amber-50/70 hover:border-amber-400"
    } ${desabilitado ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
  >
    {conforme ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
    ) : (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
    )}
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-slate-900">{titulo}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{descricao}</span>
    </span>
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
        conforme
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-300 bg-amber-100 text-amber-900"
      }`}
    >
      {conforme ? "OK" : "Com problema"}
    </span>
  </button>
);

interface CampoFotoProps {
  id: string;
  label: string;
  descricao: string;
  obrigatoria: boolean;
  foto: string | null;
  erro: string | null;
  processando: boolean;
  desabilitado: boolean;
  onSelecionar: (arquivo: File) => void;
  onRemover: () => void;
}

const CampoFotoChecklist: React.FC<CampoFotoProps> = ({
  id,
  label,
  descricao,
  obrigatoria,
  foto,
  erro,
  processando,
  desabilitado,
  onSelecionar,
  onRemover,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5 text-left">
      <label htmlFor={id} className="block select-none text-xs font-semibold text-slate-700">
        {label}
        {obrigatoria && <span className="ml-0.5 text-rose-600">*</span>}
      </label>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={desabilitado}
        className="sr-only"
        onChange={(event) => {
          const arquivo = event.target.files?.[0];
          event.target.value = "";
          if (arquivo) onSelecionar(arquivo);
        }}
      />

      {!foto ? (
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => inputRef.current?.click()}
          className={`flex min-h-14 w-full items-center gap-3 rounded-lg border border-dashed p-3.5 text-left transition-colors ${
            erro
              ? "border-rose-400 bg-rose-50/30 hover:bg-rose-50/50"
              : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/60"
          } ${desabilitado ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Camera className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              {processando ? "Comprimindo foto..." : "Abrir câmera ou enviar foto"}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">{descricao}</span>
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50/40 p-2.5">
          <img
            src={foto}
            alt={`Pré-visualização: ${label}`}
            className="h-14 w-20 shrink-0 rounded-md border border-slate-200 bg-white object-cover"
          />
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-emerald-900">
              Foto anexada ({tamanhoAproximadoKb(foto)} KB)
            </span>
            <span className="block text-xs text-slate-500">
              Pronta para envio junto ao checklist.
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={desabilitado}
              onClick={() => inputRef.current?.click()}
            >
              Trocar
            </Button>
            <button
              type="button"
              disabled={desabilitado}
              onClick={onRemover}
              aria-label={`Remover ${label}`}
              className="rounded-lg p-2 text-slate-500 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{erro}</span>
        </p>
      )}
    </div>
  );
};
