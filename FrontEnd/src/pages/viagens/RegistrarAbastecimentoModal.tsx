import React, { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Modal } from "../../components/common";
import { registrarAbastecimentoMotoristaApi } from "../../services/abastecimentosService";
import type { AbastecimentoMotorista } from "../../types/abastecimento";
import type { SolicitacaoViagem } from "../../types/solicitacao";
import { normalizarNumero } from "./checklistViagemRules";

const formatadorKm = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export type ViagemAbastecimentoAlvo = Pick<
  SolicitacaoViagem,
  "id" | "protocolo" | "destino" | "veiculoAlocadoId" | "veiculoAlocado" | "execucao"
>;

export interface RegistrarAbastecimentoModalProps {
  isOpen?: boolean;
  viagem?: ViagemAbastecimentoAlvo | null;
  onClose: () => void;
  onConcluido: (mensagem: string, abastecimento: AbastecimentoMotorista) => void;
}

function interpretarDecimal(texto: string): {
  valor: number | null;
  maisDeDuasCasas: boolean;
} {
  const limpo = texto.trim().replace(/\s+/g, "").replace(",", ".");
  if (!limpo) return { valor: null, maisDeDuasCasas: false };
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) {
    return { valor: Number.NaN, maisDeDuasCasas: false };
  }
  const [, casas = ""] = limpo.split(".");
  return {
    valor: Number(limpo),
    maisDeDuasCasas: casas.length > 2,
  };
}

export const RegistrarAbastecimentoModal: React.FC<RegistrarAbastecimentoModalProps> = ({
  isOpen = true,
  viagem,
  onClose,
  onConcluido,
}) => {
  if (!isOpen) return null;

  return (
    <ConteudoRegistrarAbastecimentoModal
      key={viagem?.id ?? "avulso"}
      viagem={viagem}
      onClose={onClose}
      onConcluido={onConcluido}
    />
  );
};

interface ConteudoProps {
  viagem?: ViagemAbastecimentoAlvo | null;
  onClose: () => void;
  onConcluido: (mensagem: string, abastecimento: AbastecimentoMotorista) => void;
}

const ConteudoRegistrarAbastecimentoModal: React.FC<ConteudoProps> = ({
  viagem,
  onClose,
  onConcluido,
}) => {
  const formId = `form-registrar-abastecimento-${viagem?.id ?? "motorista"}`;

  const odometroReferencia =
    normalizarNumero(viagem?.execucao?.kmInicial) ??
    normalizarNumero(viagem?.veiculoAlocado?.odometroAtual);

  const [odometroTexto, setOdometroTexto] = useState("");
  const [litrosTexto, setLitrosTexto] = useState("");
  const [valorTotalTexto, setValorTotalTexto] = useState("");
  const [postoCredenciado, setPostoCredenciado] = useState("");

  const [erroOdometro, setErroOdometro] = useState<string | null>(null);
  const [erroLitros, setErroLitros] = useState<string | null>(null);
  const [erroValorTotal, setErroValorTotal] = useState<string | null>(null);
  const [erroPosto, setErroPosto] = useState<string | null>(null);
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

  const fecharComSeguranca = () => {
    if (salvando.current || enviando) return;
    onClose();
  };

  const submeter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (salvando.current || enviando) return;

    setErroOdometro(null);
    setErroLitros(null);
    setErroValorTotal(null);
    setErroPosto(null);
    setErroGeral(null);

    const odo = interpretarDecimal(odometroTexto);
    const lit = interpretarDecimal(litrosTexto);
    const val = interpretarDecimal(valorTotalTexto);
    const postoLimpo = postoCredenciado.trim();

    let possuiErro = false;

    if (odo.valor === null || Number.isNaN(odo.valor)) {
      setErroOdometro("Informe a quilometragem exibida no odômetro.");
      possuiErro = true;
    } else if (odo.valor < 0) {
      setErroOdometro("Odômetro não pode ser negativo.");
      possuiErro = true;
    } else if (odo.maisDeDuasCasas) {
      setErroOdometro("Use no máximo 2 casas decimais.");
      possuiErro = true;
    }

    if (lit.valor === null || Number.isNaN(lit.valor)) {
      setErroLitros("Informe a quantidade abastecida em litros.");
      possuiErro = true;
    } else if (lit.valor <= 0) {
      setErroLitros("Litros deve ser maior que 0.");
      possuiErro = true;
    } else if (lit.maisDeDuasCasas) {
      setErroLitros("Use no máximo 2 casas decimais.");
      possuiErro = true;
    }

    if (val.valor === null || Number.isNaN(val.valor)) {
      setErroValorTotal("Informe o valor total do abastecimento.");
      possuiErro = true;
    } else if (val.valor <= 0) {
      setErroValorTotal("Valor Total deve ser maior que 0.");
      possuiErro = true;
    } else if (val.maisDeDuasCasas) {
      setErroValorTotal("Use no máximo 2 casas decimais.");
      possuiErro = true;
    }

    if (postoLimpo.length > 150) {
      setErroPosto("Posto credenciado deve ter no máximo 150 caracteres.");
      possuiErro = true;
    }

    if (possuiErro || odo.valor === null || lit.valor === null || val.valor === null) {
      return;
    }

    salvando.current = true;
    setEnviando(true);

    try {
      const criado = await registrarAbastecimentoMotoristaApi({
        ...(viagem?.veiculoAlocadoId ? { veiculoId: viagem.veiculoAlocadoId } : {}),
        odometro: odo.valor,
        litros: lit.valor,
        valorTotal: val.valor,
        ...(postoLimpo ? { postoCredenciado: postoLimpo } : {}),
      });
      if (!montado.current) return;
      onConcluido("Abastecimento registrado com sucesso via Cartão Prime.", criado);
    } catch (error) {
      if (!montado.current) return;
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível registrar o abastecimento. Tente novamente.";
      setErroGeral(mensagem);
    } finally {
      salvando.current = false;
      if (montado.current) {
        setEnviando(false);
      }
    }
  };

  return (
    <Modal
      isOpen
      onClose={fecharComSeguranca}
      size="md"
      title="Registrar Abastecimento (Cartão Prime)"
      description={
        viagem?.veiculoAlocado
          ? `${viagem.veiculoAlocado.placa} · ${viagem.veiculoAlocado.modelo}${
              odometroReferencia !== null
                ? ` (Último km: ${formatadorKm.format(odometroReferencia)} km)`
                : ""
            }`
          : "Preencha os dados do comprovante."
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={enviando}
            onClick={fecharComSeguranca}
            className="min-h-11"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            isLoading={enviando}
            className="min-h-11"
          >
            Confirmar abastecimento
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submeter} noValidate className="space-y-4">
        {erroGeral && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
          >
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{erroGeral}</span>
          </div>
        )}

        <Input
          id="abastecimento-odometro"
          label="Odômetro no abastecimento (km)"
          required
          type="text"
          inputMode="decimal"
          disabled={enviando}
          className="h-11 text-base"
          placeholder={
            odometroReferencia !== null ? `Ex.: ${odometroReferencia + 120}` : "Ex.: 42650"
          }
          value={odometroTexto}
          error={erroOdometro ?? undefined}
          onChange={(event) => {
            setOdometroTexto(event.target.value);
            if (erroOdometro) setErroOdometro(null);
            if (erroGeral) setErroGeral(null);
          }}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="abastecimento-litros"
            label="Litros abastecidos (L)"
            required
            type="text"
            inputMode="decimal"
            disabled={enviando}
            className="h-11 text-base"
            placeholder="Ex.: 38,5"
            value={litrosTexto}
            error={erroLitros ?? undefined}
            onChange={(event) => {
              setLitrosTexto(event.target.value);
              if (erroLitros) setErroLitros(null);
              if (erroGeral) setErroGeral(null);
            }}
          />

          <Input
            id="abastecimento-valor-total"
            label="Valor total (R$)"
            required
            type="text"
            inputMode="decimal"
            disabled={enviando}
            className="h-11 text-base"
            placeholder="Ex.: 234,85"
            value={valorTotalTexto}
            error={erroValorTotal ?? undefined}
            onChange={(event) => {
              setValorTotalTexto(event.target.value);
              if (erroValorTotal) setErroValorTotal(null);
              if (erroGeral) setErroGeral(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Input
            id="abastecimento-posto-credenciado"
            label="Posto credenciado (Rede Prime)"
            type="text"
            maxLength={150}
            disabled={enviando}
            className="h-11 text-base"
            placeholder="Nome do posto"
            value={postoCredenciado}
            error={erroPosto ?? undefined}
            onChange={(event) => {
              setPostoCredenciado(event.target.value);
              if (erroPosto) setErroPosto(null);
              if (erroGeral) setErroGeral(null);
            }}
          />
        </div>
      </form>
    </Modal>
  );
};
