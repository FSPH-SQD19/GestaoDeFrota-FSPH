import { useState } from "react";
import { ArrowLeft, ArrowRight, CarFront, LoaderCircle, ShieldCheck } from "lucide-react";
import ChecklistForm from "./ChecklistForm";
import { novoChecklist, type Checklist, type Comando } from "./types";
import type { Inicio } from "./useDiarioMotorista";
export function PrimaryButton({
  children,
  busy = false,
  disabled = false,
  type = "button",
  onClick,
}: {
  children: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button type={type} className="driver-primary" disabled={busy || disabled} onClick={onClick}>
      <span>{children}</span>
      {busy ? <LoaderCircle size={20} className="animate-spin" /> : <ArrowRight size={20} />}
    </button>
  );
}
export function PrepararViagem({
  inicio,
  busy,
  onStart,
}: {
  inicio: Inicio;
  busy: boolean;
  onStart: (km: number, checklist: Checklist) => Promise<void>;
}) {
  const [etapa, setEtapa] = useState(1),
    [km, setKm] = useState(String(inicio.veiculo.odometroAtual)),
    [checklist, setChecklist] = useState(novoChecklist);
  const bloqueada = (["pneus", "iluminacao", "freios"] as const).some(
    (k) => checklist.itens[k].estado === "PROBLEMA",
  );
  return (
    <form
      className="driver-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (etapa === 1) setEtapa(2);
        else void onStart(Number(km), checklist);
      }}
    >
      <div className="driver-step">
        <span className={etapa === 1 ? "is-current" : ""}>1. Veículo</span>
        <span className={etapa === 2 ? "is-current" : ""}>2. Conferência</span>
      </div>
      {etapa === 1 ? (
        <>
          <div className="driver-vehicle">
            <CarFront size={30} />
            <div>
              <strong>{inicio.veiculo.modelo}</strong>
              <span>{inicio.veiculo.placa}</span>
            </div>
          </div>
          <p className="driver-hint">Confirme o veículo e informe a quilometragem do painel.</p>
          <label className="driver-field">
            Odômetro inicial (km)
            <input
              required
              inputMode="decimal"
              type="number"
              min={Number(inicio.veiculo.odometroAtual)}
              step="0.01"
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          </label>
          <p className="driver-hint">
            Último registro: {Number(inicio.veiculo.odometroAtual).toLocaleString("pt-BR")} km
          </p>
        </>
      ) : (
        <>
          <div className="driver-check-intro">
            <ShieldCheck size={22} />
            <p>
              Confira os itens antes de sair. Se encontrar um problema, descreva o que aconteceu.
            </p>
          </div>
          <ChecklistForm value={checklist} onChange={setChecklist} prefix="de saída" />
          {bloqueada && (
            <p className="driver-alert" role="alert">
              Problemas em pneus, iluminação ou freios precisam ser resolvidos antes de iniciar.
            </p>
          )}
        </>
      )}
      <div className="driver-form-footer">
        {etapa === 2 && (
          <button
            type="button"
            className="driver-text-button"
            onClick={() => setEtapa(1)}
            disabled={busy}
          >
            <ArrowLeft size={17} />
            Voltar ao veículo
          </button>
        )}
        <PrimaryButton type="submit" busy={busy} disabled={etapa === 2 && bloqueada}>
          {etapa === 1 ? "Continuar" : "Iniciar viagem"}
        </PrimaryButton>
      </div>
    </form>
  );
}
export function AbastecimentoForm({
  kmMinimo,
  fornecedores,
  busy,
  onSave,
}: {
  kmMinimo: number;
  fornecedores: Array<{ id: string; razaoSocial: string }>;
  busy: boolean;
  onSave: (comando: Comando) => Promise<void>;
}) {
  const [km, setKm] = useState(""),
    [litros, setLitros] = useState(""),
    [valor, setValor] = useState(""),
    [fornecedor, setFornecedor] = useState("");
  return (
    <form
      className="driver-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          id: crypto.randomUUID(),
          tipo: "ABASTECIMENTO",
          odometro: Number(km),
          litros: Number(litros),
          valorTotal: Number(valor),
          dataHora: new Date().toISOString(),
          ...(fornecedor ? { fornecedorId: fornecedor } : {}),
        });
      }}
    >
      <p className="driver-hint">
        Preencha os dados do abastecimento. Sem internet, o registro fica salvo para envio.
      </p>
      <label className="driver-field">
        Odômetro do abastecimento
        <input
          required
          inputMode="decimal"
          type="number"
          min={kmMinimo}
          step="0.01"
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
      </label>
      <div className="driver-form-grid">
        <label className="driver-field">
          Litros
          <input
            required
            inputMode="decimal"
            type="number"
            min="0.01"
            max="999999.99"
            step="0.01"
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
          />
        </label>
        <label className="driver-field">
          Valor total (R$)
          <input
            required
            inputMode="decimal"
            type="number"
            min="0.01"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </label>
      </div>
      <label className="driver-field">
        Fornecedor (opcional)
        <select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
          <option value="">Não informado</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>
              {f.razaoSocial}
            </option>
          ))}
        </select>
      </label>
      <PrimaryButton type="submit" busy={busy}>
        Salvar abastecimento
      </PrimaryButton>
    </form>
  );
}
export function RetornoForm({
  kmMinimo,
  busy,
  onSave,
}: {
  kmMinimo: number;
  busy: boolean;
  onSave: (comando: Comando) => Promise<void>;
}) {
  const [km, setKm] = useState(""),
    [checklist, setChecklist] = useState(novoChecklist),
    [ocorrencias, setOcorrencias] = useState("");
  return (
    <form
      className="driver-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          id: crypto.randomUUID(),
          tipo: "ENCERRAR",
          kmFinal: Number(km),
          checklist,
          ocorrencias,
          dataHora: new Date().toISOString(),
        });
      }}
    >
      <p className="driver-hint">
        Confirme o retorno antes de finalizar. Registros sem conexão serão enviados automaticamente.
      </p>
      <label className="driver-field">
        Odômetro final (km)
        <input
          required
          inputMode="decimal"
          type="number"
          min={kmMinimo}
          step="0.01"
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
      </label>
      <ChecklistForm value={checklist} onChange={setChecklist} prefix="de retorno" />
      <label className="driver-field">
        Ocorrências (opcional)
        <textarea
          maxLength={4000}
          placeholder="Como foi a viagem?"
          value={ocorrencias}
          onChange={(e) => setOcorrencias(e.target.value)}
        />
      </label>
      <PrimaryButton type="submit" busy={busy}>
        Confirmar retorno e encerrar
      </PrimaryButton>
    </form>
  );
}
