import { useEffect, useState } from "react";
import { apiRequest, respostaDeErro } from "../../lib/api";
import { Button, Input, Select } from "../../components/common";
import { intervalosLivres, type Ocupacao } from "./agendaIntervalos";

type Agenda = {
  inicio: string;
  fim: string;
  veiculos: { id: string; placa: string; modelo: string }[];
  motoristas: { id: string; nome: string }[];
  ocupacoes: Ocupacao[];
};

const fuso = "America/Sao_Paulo";
const dataLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: fuso });
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: fuso,
});
const formatarIntervalo = (inicio: string, fim: string) =>
  dataHora.formatRange(new Date(inicio), new Date(fim));

export function AgendaPage() {
  const [periodo, setPeriodo] = useState(() => {
    const hoje = new Date();
    return {
      inicio: dataLocal.format(hoje),
      fim: dataLocal.format(new Date(hoje.getTime() + 6 * 86_400_000)),
    };
  });
  const [veiculoId, setVeiculoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [erro, setErro] = useState("");
  const [atualizar, setAtualizar] = useState(0);
  const periodoValido = Boolean(periodo.inicio && periodo.fim && periodo.inicio <= periodo.fim);

  useEffect(() => {
    if (!periodoValido) return;
    let ativa = true;
    let carregando = false;

    async function carregar() {
      if (carregando) return;
      carregando = true;
      try {
        const dados = await apiRequest<Agenda>(`/agenda?${new URLSearchParams(periodo)}`);
        if (!ativa) return;
        setAgenda(dados);
        setVeiculoId((id) => (dados.veiculos.some((veiculo) => veiculo.id === id) ? id : ""));
        setMotoristaId((id) =>
          dados.motoristas.some((motorista) => motorista.id === id) ? id : "",
        );
        setErro("");
      } catch (error) {
        if (ativa) setErro(respostaDeErro(error, "Não foi possível consultar a agenda."));
      } finally {
        carregando = false;
      }
    }

    void carregar();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, 30_000);
    window.addEventListener("focus", carregar);
    return () => {
      ativa = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", carregar);
    };
  }, [periodo, periodoValido, atualizar]);

  function alterarPeriodo(campo: "inicio" | "fim", valor: string) {
    if (periodo[campo] === valor) return;
    setAgenda(null);
    setErro("");
    setPeriodo((atual) => ({ ...atual, [campo]: valor }));
  }

  const veiculos = (agenda?.veiculos ?? []).map(({ id, placa, modelo }) => ({
    id,
    nome: `${placa} · ${modelo}`,
  }));
  const motoristas = agenda?.motoristas ?? [];
  const nomesVeiculos = new Map(veiculos.map(({ id, nome }) => [id, nome]));
  const nomesMotoristas = new Map(motoristas.map(({ id, nome }) => [id, nome]));
  const recursos = [
    ...veiculos
      .filter(({ id }) => (veiculoId ? id === veiculoId : !motoristaId))
      .map((recurso) => ({ ...recurso, campo: "veiculoId" as const })),
    ...motoristas
      .filter(({ id }) => (motoristaId ? id === motoristaId : !veiculoId))
      .map((recurso) => ({ ...recurso, campo: "motoristaId" as const })),
  ];

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Agenda da frota administrativa</h1>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
        <Input
          label="De"
          type="date"
          value={periodo.inicio}
          onChange={(e) => alterarPeriodo("inicio", e.target.value)}
        />
        <Input
          label="Até"
          type="date"
          value={periodo.fim}
          onChange={(e) => alterarPeriodo("fim", e.target.value)}
        />
        <Select label="Veículo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
          <option value="">Todos</option>
          {veiculos.map(({ id, nome }) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </Select>
        <Select
          label="Motorista"
          value={motoristaId}
          onChange={(e) => setMotoristaId(e.target.value)}
        >
          <option value="">Todos</option>
          {motoristas.map(({ id, nome }) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </Select>
        <Button disabled={!periodoValido} onClick={() => setAtualizar((valor) => valor + 1)}>
          Atualizar
        </Button>
      </div>
      {!periodoValido && (
        <p role="alert">Informe um período com data final igual ou posterior à inicial.</p>
      )}
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      {periodoValido && !agenda && !erro && <p role="status">Carregando agenda…</p>}
      {agenda && !erro && (
        <>
          <p className="text-sm text-slate-600">
            Horário de Brasília. Os intervalos livres indicam ausência de reservas ou manutenção
            registrada na agenda.
          </p>
          {recursos.length === 0 && <p>Nenhum recurso encontrado.</p>}
          {recursos.map(({ id, nome, campo }) => {
            const ocupacoes = agenda.ocupacoes.filter((ocupacao) => ocupacao[campo] === id);
            const livres = intervalosLivres(agenda.inicio, agenda.fim, ocupacoes);
            return (
              <article
                key={`${campo}-${id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <h2 className="mb-3 font-semibold">{nome}</h2>
                <ul className="space-y-2 text-sm">
                  {[...ocupacoes, ...livres]
                    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
                    .map((item) => (
                      <li
                        key={item.id}
                        className={`rounded-lg px-3 py-2 ${item.tipo === "LIVRE" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}
                      >
                        <strong>
                          {item.tipo === "LIVRE"
                            ? "Livre"
                            : item.tipo === "MANUTENCAO"
                              ? "Manutenção"
                              : item.status === "APROVADA"
                                ? "Aprovada"
                                : "Em trânsito"}
                        </strong>
                        {" · "}
                        {formatarIntervalo(item.inicio, item.fim)}
                        {item.tipo === "MANUTENCAO" && item.motivo && <div>{item.motivo}</div>}
                        {item.tipo === "VIAGEM" && (
                          <div>
                            {[
                              item.protocolo,
                              nomesVeiculos.get(item.veiculoId ?? ""),
                              nomesMotoristas.get(item.motoristaId ?? ""),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </article>
            );
          })}
        </>
      )}
    </section>
  );
}
