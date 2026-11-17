import { useState } from "react";
import { Button } from "../../components/common/Button";
import ChecklistForm from "./ChecklistForm";
import type { Comando, Ponto } from "./types";
export default function CorrigirComando({
  comando,
  onSave,
  onCancel,
  fornecedores,
  pontos,
}: {
  fornecedores: Array<{ id: string; razaoSocial: string }>;
  pontos: Ponto[];
  comando: Comando;
  onSave: (c: Comando) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(comando),
    [busy, setBusy] = useState(false);
  const input = "w-full rounded-lg border bg-white p-2";
  return (
    <form
      className="space-y-3 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void onSave(value).finally(() => setBusy(false));
      }}
    >
      <h3 className="font-semibold">Corrigir lançamento</h3>
      {value.tipo === "ABASTECIMENTO" && (
        <>
          {(["odometro", "litros", "valorTotal"] as const).map((key) => (
            <label key={key} className="block">
              {{ odometro: "Odômetro", litros: "Litros", valorTotal: "Valor total (R$)" }[key]}
              <input
                required
                className={input}
                type="number"
                min={key === "odometro" ? 0 : 0.01}
                step="0.01"
                value={value[key]}
                onChange={(e) => setValue({ ...value, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <label className="block">
            Fornecedor opcional
            <select
              className={input}
              value={value.fornecedorId ?? ""}
              onChange={(e) => setValue({ ...value, fornecedorId: e.target.value || undefined })}
            >
              <option value="">Não informado</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.razaoSocial}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {value.tipo === "ENCERRAR" && (
        <>
          <label className="block">
            Odômetro final
            <input
              required
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={value.kmFinal}
              onChange={(e) => setValue({ ...value, kmFinal: Number(e.target.value) })}
            />
          </label>
          <ChecklistForm
            prefix="de retorno corrigido"
            value={value.checklist}
            onChange={(checklist) => setValue({ ...value, checklist })}
          />
          <label className="block">
            Ocorrências
            <textarea
              maxLength={4000}
              className={input}
              value={value.ocorrencias}
              onChange={(e) => setValue({ ...value, ocorrencias: e.target.value })}
            />
          </label>
        </>
      )}
      {value.tipo === "VISITA" && (
        <label className="block">
          Coleta
          <select
            required
            className={input}
            value={value.ordemId}
            onChange={(e) => setValue({ ...value, ordemId: e.target.value })}
          >
            {pontos
              .filter((p) => p.id !== "base")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
          </select>
        </label>
      )}
      <Button type="submit" isLoading={busy}>
        Salvar correção
      </Button>
      <Button variant="outline" type="button" onClick={onCancel}>
        Cancelar correção
      </Button>
    </form>
  );
}
