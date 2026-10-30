import React, { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Send } from "lucide-react";
import { Button, Input, Modal, Select, Textarea } from "../../components/common";
import {
  SETORES_FSPH,
  TIPO_TRANSPORTE_LABEL,
  type NovaSolicitacaoViagem,
  type TipoTransporte,
} from "../../types/solicitacao";

const FORM_ID = "nova-solicitacao-form";

const tiposTransporte = Object.keys(TIPO_TRANSPORTE_LABEL) as [TipoTransporte, ...TipoTransporte[]];

const solicitacaoSchema = z
  .object({
    setorOrigem: z.string().min(1, "Selecione o setor solicitante."),
    origem: z.string().trim().min(3, "Informe o local de partida.").max(150),
    destino: z.string().trim().min(3, "Informe o destino da viagem.").max(150),
    dataHoraPretendida: z.string().min(1, "Informe a data e hora de saída."),
    dataHoraRetornoPrevista: z.string().optional(),
    quantidadePassageiros: z
      .string()
      .regex(/^\d+$/, "Informe um número inteiro.")
      .refine((v) => Number(v) <= 15, "Máximo de 15 passageiros por viagem."),
    tipoTransporte: z.enum(tiposTransporte, { message: "Selecione o tipo de transporte." }),
    urgencia: z.enum(["NORMAL", "URGENTE"]),
    justificativa: z
      .string()
      .trim()
      .min(10, "Descreva a justificativa com pelo menos 10 caracteres.")
      .max(500, "A justificativa deve ter no máximo 500 caracteres."),
    observacoes: z.string().max(300, "Máximo de 300 caracteres.").optional(),
  })
  .superRefine((data, ctx) => {
    const saida = new Date(data.dataHoraPretendida);
    if (data.dataHoraPretendida && (Number.isNaN(saida.getTime()) || saida <= new Date())) {
      ctx.addIssue({
        code: "custom",
        path: ["dataHoraPretendida"],
        message: "A data de saída deve ser futura.",
      });
    }
    if (data.dataHoraRetornoPrevista) {
      const retorno = new Date(data.dataHoraRetornoPrevista);
      if (Number.isNaN(retorno.getTime()) || retorno <= saida) {
        ctx.addIssue({
          code: "custom",
          path: ["dataHoraRetornoPrevista"],
          message: "O retorno deve ser posterior à saída.",
        });
      }
    }
    if (
      data.tipoTransporte !== "MATERIAL_BIOLOGICO" &&
      data.tipoTransporte !== "DOCUMENTOS_INSUMOS" &&
      Number(data.quantidadePassageiros) < 1
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["quantidadePassageiros"],
        message: "Informe ao menos 1 passageiro para este tipo de transporte.",
      });
    }
  });

type SolicitacaoFormData = z.infer<typeof solicitacaoSchema>;

const defaultValues: SolicitacaoFormData = {
  setorOrigem: "",
  origem: "",
  destino: "",
  dataHoraPretendida: "",
  dataHoraRetornoPrevista: "",
  quantidadePassageiros: "1",
  tipoTransporte: "PASSAGEIROS",
  urgencia: "NORMAL",
  justificativa: "",
  observacoes: "",
};

interface NovaSolicitacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dados: NovaSolicitacaoViagem) => Promise<void> | void;
  errorMessage?: string;
}

export const NovaSolicitacaoModal: React.FC<NovaSolicitacaoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  errorMessage,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SolicitacaoFormData>({
    resolver: zodResolver(solicitacaoSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isOpen) reset(defaultValues);
  }, [isOpen, reset]);

  const urgencia = useWatch({ control, name: "urgencia" });

  const submit = async (data: SolicitacaoFormData) => {
    await onSubmit({
      setorOrigem: data.setorOrigem,
      origem: data.origem.trim(),
      destino: data.destino.trim(),
      dataHoraPretendida: new Date(data.dataHoraPretendida).toISOString(),
      dataHoraRetornoPrevista: data.dataHoraRetornoPrevista
        ? new Date(data.dataHoraRetornoPrevista).toISOString()
        : undefined,
      quantidadePassageiros: Number(data.quantidadePassageiros),
      tipoTransporte: data.tipoTransporte,
      urgencia: data.urgencia,
      justificativa: data.justificativa.trim(),
      observacoes: data.observacoes?.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Nova Solicitação de Viagem"
      description="Preencha os dados da viagem. O Gestor de Frota analisará e alocará veículo e motorista."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Enviar Solicitação
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
        {errorMessage && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            {errorMessage}
          </p>
        )}
        {/* Setor e urgência */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Setor solicitante"
            required
            placeholder="Selecione o setor"
            options={SETORES_FSPH.map((s) => ({ value: s, label: s }))}
            error={errors.setorOrigem?.message}
            {...register("setorOrigem")}
          />
          <Select
            label="Urgência"
            required
            options={[
              { value: "NORMAL", label: "Normal" },
              { value: "URGENTE", label: "Urgente" },
            ]}
            error={errors.urgencia?.message}
            {...register("urgencia")}
          />
        </div>

        {urgencia === "URGENTE" && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Solicitações urgentes têm prioridade na fila do gestor. Use apenas quando o atraso
              comprometer a assistência ou a integridade de amostras.
            </span>
          </div>
        )}

        {/* Itinerário */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Origem"
            required
            placeholder="Ex: LACEN — Rua Campo do Brito"
            error={errors.origem?.message}
            {...register("origem")}
          />
          <Input
            label="Destino"
            required
            placeholder="Ex: Hospital Regional de Itabaiana"
            error={errors.destino?.message}
            {...register("destino")}
          />
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="dataHoraPretendida"
            label="Data e hora de saída"
            type="datetime-local"
            required
            error={errors.dataHoraPretendida?.message}
            {...register("dataHoraPretendida")}
          />
          <Input
            id="dataHoraRetornoPrevista"
            label="Retorno previsto"
            type="datetime-local"
            helperText="Opcional — deixe em branco se for só ida."
            error={errors.dataHoraRetornoPrevista?.message}
            {...register("dataHoraRetornoPrevista")}
          />
        </div>

        {/* Carga */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Tipo de transporte"
            required
            options={tiposTransporte.map((t) => ({ value: t, label: TIPO_TRANSPORTE_LABEL[t] }))}
            error={errors.tipoTransporte?.message}
            {...register("tipoTransporte")}
          />
          <Input
            id="quantidadePassageiros"
            label="Nº de passageiros"
            type="number"
            min={0}
            max={15}
            required
            error={errors.quantidadePassageiros?.message}
            {...register("quantidadePassageiros")}
          />
        </div>

        <Textarea
          label="Justificativa"
          required
          rows={3}
          placeholder="Descreva o motivo da viagem..."
          error={errors.justificativa?.message}
          {...register("justificativa")}
        />

        <Textarea
          label="Observações"
          rows={2}
          placeholder="Contato no destino, cuidados com a carga, etc. (opcional)"
          error={errors.observacoes?.message}
          {...register("observacoes")}
        />
      </form>
    </Modal>
  );
};
