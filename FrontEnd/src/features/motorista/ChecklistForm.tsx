import { ITENS, LABELS, type Checklist } from "./types";
export default function ChecklistForm({
  value,
  onChange,
  prefix,
}: {
  value: Checklist;
  onChange: (v: Checklist) => void;
  prefix: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">Checklist {prefix}</legend>
      {ITENS.map((k) => (
        <div key={k} className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 text-sm">
            {LABELS[k]}
            <select
              aria-label={`${LABELS[k]} ${prefix}`}
              className="rounded-lg border p-2"
              value={value.itens[k].estado}
              onChange={(e) =>
                onChange({
                  ...value,
                  itens: {
                    ...value.itens,
                    [k]: { ...value.itens[k], estado: e.target.value as "CONFORME" | "PROBLEMA" },
                  },
                })
              }
            >
              <option value="CONFORME">Conforme</option>
              <option value="PROBLEMA">Com problema</option>
            </select>
          </label>
          {value.itens[k].estado === "PROBLEMA" && (
            <input
              required
              maxLength={1000}
              aria-label={`Observação ${LABELS[k]} ${prefix}`}
              placeholder="Descreva o problema"
              className="rounded-lg border p-2 text-sm"
              value={value.itens[k].observacao}
              onChange={(e) =>
                onChange({
                  ...value,
                  itens: { ...value.itens, [k]: { ...value.itens[k], observacao: e.target.value } },
                })
              }
            />
          )}
        </div>
      ))}
    </fieldset>
  );
}
