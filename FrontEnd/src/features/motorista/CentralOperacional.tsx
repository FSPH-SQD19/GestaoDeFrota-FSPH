import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { api } from "../../services/api";
import { Button } from "../../components/common/Button";
import { mensagemErro } from "./offline";
import { estadoPosicao } from "./geo";
import type { Coordenadas, Ponto } from "./types";
const Mapa = lazy(() => import("./Mapa"));
type Pos = {
  saidaId: string;
  coordenadas: Coordenadas | null;
  capturadaEm: string | null;
  precisao: number | null;
  tipo: string;
  placa: string;
  nome: string;
};
type Item = {
  id: string;
  tipo: "ADMINISTRATIVA" | "SVO";
  nome: string;
  primeiro: Coordenadas | null;
  segundo: Coordenadas | null;
  sequencia: number;
};
type Local = { id: string; nome: string; coordenadas: Coordenadas; tipo: string };
export default function CentralOperacional() {
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [erro, setErro] = useState(""),
    [positions, setPositions] = useState<Pos[]>([]),
    [itens, setItens] = useState<Item[]>([]),
    [locais, setLocais] = useState<Local[]>([]),
    [selected, setSelected] = useState<Item | null>(null),
    [slot, setSlot] = useState<"primeiro" | "segundo">("primeiro"),
    [busy, setBusy] = useState(false),
    [percurso, setPercurso] = useState<Ponto[]>([]),
    [nomeLocal, setNomeLocal] = useState(""),
    [historico, setHistorico] = useState<
      Array<{ id: string; tipo: string; inicio: string; status: string }>
    >([]);
  const load = useCallback(async () => {
    const [p, g, l, h] = await Promise.all([
      api.get<Pos[]>("/api/v1/rastreamento/posicoes"),
      api.get<{
        administrativas: Array<{
          id: string;
          protocolo: string;
          origemCoordenadas: Coordenadas;
          destinoCoordenadas: Coordenadas;
        }>;
        ordens: Array<{
          id: string;
          sequencia: number;
          baseCoordenadas: Coordenadas;
          coordenadas: Coordenadas | null;
          chamado: { enderecoOcorrencia: string };
        }>;
      }>("/api/v1/geografia/tarefas"),
      api.get<Local[]>("/api/v1/locais"),
      api.get<Array<{ id: string; tipo: string; inicio: string; status: string }>>(
        "/api/v1/rastreamento/saidas",
      ),
    ]);
    setPositions(p.data);
    setLocais(l.data);
    setHistorico(h.data);
    setItens([
      ...g.data.administrativas.map((t) => ({
        id: t.id,
        tipo: "ADMINISTRATIVA" as const,
        nome: t.protocolo,
        primeiro: t.origemCoordenadas.length === 2 ? t.origemCoordenadas : null,
        segundo: t.destinoCoordenadas.length === 2 ? t.destinoCoordenadas : null,
        sequencia: 0,
      })),
      ...g.data.ordens.map((t) => ({
        id: t.id,
        tipo: "SVO" as const,
        nome: t.chamado.enderecoOcorrencia,
        primeiro: t.coordenadas,
        segundo: t.baseCoordenadas.length === 2 ? t.baseCoordenadas : null,
        sequencia: t.sequencia,
      })),
    ]);
  }, []);
  useEffect(() => {
    let active = true;
    void api
      .get<{ enabled: boolean }>("/api/v1/motorista/config")
      .then(({ data }) => {
        if (active) setEnabled(data.enabled);
      })
      .catch((e) => {
        if (active) setErro(mensagemErro(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const run = () => {
      if (document.visibilityState === "visible")
        void load().catch((e) => {
          if (active) setErro(mensagemErro(e));
        });
    };
    run();
    const timer = setInterval(run, 5000);
    document.addEventListener("visibilitychange", run);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled, load]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setErro("");
    try {
      await work();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setBusy(false);
    }
  }
  const pontos: Ponto[] = selected
    ? [
        {
          id: "primeiro",
          nome: selected.tipo === "SVO" ? "Ocorrência" : "Origem",
          coordenadas: selected.primeiro,
        },
        {
          id: "segundo",
          nome: selected.tipo === "SVO" ? "Base" : "Destino",
          coordenadas: selected.segundo,
        },
      ]
    : percurso.length
      ? [
          { ...percurso[0], nome: "Início do percurso" },
          ...(percurso.length > 1
            ? [{ ...percurso[percurso.length - 1], nome: "Última posição do percurso" }]
            : []),
        ]
      : positions.map((p) => ({
          id: p.saidaId,
          nome: `${p.placa} · ${p.nome} · ${p.capturadaEm ? estadoPosicao(p.capturadaEm) : "Aguardando posição"}`,
          coordenadas: p.coordenadas,
        }));
  const input = "w-full rounded-xl border border-slate-300 bg-white p-3 text-sm";
  return (
    <section className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-blue-700">Central ROTA</p>
        <h1 className="text-2xl font-bold">Mapa e operação</h1>
        <p className="text-sm text-slate-500">
          Pontos confirmados, acompanhamento e histórico de percursos.
        </p>
      </header>
      {erro && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">
          {erro}
        </p>
      )}
      {enabled === false ? (
        <p>Módulo aguardando ativação.</p>
      ) : (
        enabled && (
          <>
            <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
              <Suspense fallback={<p>Carregando mapa...</p>}>
                <Mapa
                  pontos={pontos}
                  focus={percurso.length === 1 ? (percurso[0].coordenadas ?? undefined) : undefined}
                  rota={
                    percurso.length > 1
                      ? {
                          geometry: {
                            type: "LineString",
                            coordinates: percurso.map((p) => p.coordenadas!),
                          },
                          destino: percurso[percurso.length - 1],
                          distancia: 0,
                          duracao: 0,
                          instrucoes: [],
                          calculadaEm: "",
                        }
                      : undefined
                  }
                  onPick={
                    selected ? (p) => setSelected((s) => (s ? { ...s, [slot]: p } : s)) : undefined
                  }
                />
              </Suspense>
              <div className="space-y-3">
                {!positions.length && (
                  <p className="rounded-xl bg-white p-5">
                    Nenhum veículo com saída e posição recebida.
                  </p>
                )}
                {positions.map((p) => (
                  <article key={p.saidaId} className="rounded-xl border bg-white p-4">
                    <h2 className="font-semibold">
                      {p.placa} · {p.nome}
                    </h2>
                    <p className="text-sm">
                      {p.tipo} ·{" "}
                      {p.capturadaEm ? estadoPosicao(p.capturadaEm) : "Aguardando posição"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.capturadaEm
                        ? new Date(p.capturadaEm).toLocaleString("pt-BR")
                        : "Sem amostra recebida"}{" "}
                      · precisão {p.precisao === null ? "—" : Math.round(p.precisao)} m
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void action(async () => {
                          const { data } = await api.get<Array<{ coordenadas: Coordenadas }>>(
                            `/api/v1/rastreamento/saidas/${p.saidaId}/percurso`,
                          );
                          setSelected(null);
                          if (!data.length)
                            setErro(
                              "Nenhuma posição disponível para esta saída. A retenção é de 90 dias.",
                            );
                          setPercurso(
                            data.map((p, k) => ({
                              id: String(k),
                              nome: "Percurso",
                              coordenadas: p.coordenadas,
                            })),
                          );
                        })
                      }
                    >
                      Ver percurso
                    </Button>
                  </article>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5 space-y-4">
              <h2 className="text-lg font-semibold">Confirmar origem e destinos</h2>
              <label className="block text-sm">
                Viagem ou ordem
                <select
                  className={input}
                  value={selected?.id ?? ""}
                  onChange={(e) => {
                    setSelected(itens.find((t) => t.id === e.target.value) ?? null);
                    setPercurso([]);
                  }}
                >
                  <option value="">Selecione uma tarefa</option>
                  {itens.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tipo} · {t.nome}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      if (!selected.primeiro || !selected.segundo)
                        throw new Error("Confirme os dois pontos no mapa.");
                      await api.patch(
                        `/api/v1/geografia/${selected.id}`,
                        selected.tipo === "SVO"
                          ? {
                              tipo: "SVO",
                              ocorrencia: selected.primeiro,
                              base: selected.segundo,
                              sequencia: selected.sequencia,
                            }
                          : {
                              tipo: "ADMINISTRATIVA",
                              origem: selected.primeiro,
                              destino: selected.segundo,
                            },
                      );
                      setSelected(null);
                      await load();
                    });
                  }}
                >
                  <p className="text-sm">
                    Escolha o ponto e toque no mapa, informe as coordenadas ou reutilize um local.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={slot === "primeiro" ? "primary" : "outline"}
                      onClick={() => setSlot("primeiro")}
                    >
                      {selected.tipo === "SVO" ? "Ocorrência" : "Origem"}
                    </Button>
                    <Button
                      type="button"
                      variant={slot === "segundo" ? "primary" : "outline"}
                      onClick={() => setSlot("segundo")}
                    >
                      {selected.tipo === "SVO" ? "Base de retorno" : "Destino"}
                    </Button>
                  </div>
                  <label className="block text-sm">
                    Local cadastrado
                    <select
                      className={input}
                      value=""
                      onChange={(e) => {
                        const local = locais.find((l) => l.id === e.target.value);
                        if (local)
                          setSelected((s) => (s ? { ...s, [slot]: local.coordenadas } : s));
                      }}
                    >
                      <option value="">Usar local no ponto selecionado</option>
                      {locais.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(["primeiro", "segundo"] as const).map((key, k) => (
                    <fieldset key={key} className="grid gap-2 sm:grid-cols-2">
                      <legend className="text-sm font-semibold">
                        {selected.tipo === "SVO"
                          ? k === 0
                            ? "Ocorrência"
                            : "Base de retorno"
                          : k === 0
                            ? "Origem"
                            : "Destino"}
                      </legend>
                      {[0, 1].map((index) => (
                        <label key={index} className="text-sm">
                          {index === 0 ? "Longitude" : "Latitude"}
                          <input
                            className={input}
                            required
                            type="number"
                            step="any"
                            min={index === 0 ? -180 : -90}
                            max={index === 0 ? 180 : 90}
                            value={selected[key]?.[index] ?? ""}
                            onChange={(e) =>
                              setSelected((s) => {
                                if (!s) return s;
                                const point: Coordenadas = [...(s[key] ?? [0, 0])];
                                point[index] = Number(e.target.value);
                                return { ...s, [key]: point };
                              })
                            }
                          />
                        </label>
                      ))}
                    </fieldset>
                  ))}
                  {selected.tipo === "SVO" && (
                    <label className="block text-sm">
                      Sequência de coleta
                      <input
                        required
                        className={input}
                        type="number"
                        min="0"
                        max="1000"
                        value={selected.sequencia}
                        onChange={(e) =>
                          setSelected((s) => (s ? { ...s, sequencia: Number(e.target.value) } : s))
                        }
                      />
                    </label>
                  )}
                  <Button type="submit" isLoading={busy}>
                    Confirmar pontos
                  </Button>
                  <div className="border-t pt-4 space-y-2">
                    <label className="block text-sm">
                      Salvar ponto selecionado como local
                      <input
                        className={input}
                        maxLength={150}
                        value={nomeLocal}
                        placeholder="Nome do local"
                        onChange={(e) => setNomeLocal(e.target.value)}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selected[slot] || nomeLocal.trim().length < 2 || busy}
                      onClick={() =>
                        void action(async () => {
                          await api.post("/api/v1/locais", {
                            nome: nomeLocal,
                            coordenadas: selected[slot],
                            tipo:
                              selected.tipo === "SVO" && slot === "segundo"
                                ? "BASE"
                                : slot === "primeiro"
                                  ? "ORIGEM"
                                  : "DESTINO",
                          });
                          setNomeLocal("");
                          await load();
                        })
                      }
                    >
                      Salvar local
                    </Button>
                  </div>
                </form>
              )}
            </div>
            <div className="rounded-2xl bg-white p-5 space-y-3">
              <h2 className="font-semibold">Histórico de saídas</h2>
              <label className="block text-sm">
                Consultar percurso
                <select
                  className={input}
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id)
                      void action(async () => {
                        const { data } = await api.get<Array<{ coordenadas: Coordenadas }>>(
                          `/api/v1/rastreamento/saidas/${id}/percurso`,
                        );
                        setSelected(null);
                        if (!data.length)
                          setErro(
                            "Nenhuma posição disponível para esta saída. A retenção é de 90 dias.",
                          );
                        setPercurso(
                          data.map((p, k) => ({
                            id: String(k),
                            nome: "Percurso",
                            coordenadas: p.coordenadas,
                          })),
                        );
                      });
                  }}
                >
                  <option value="">Selecione uma saída</option>
                  {historico.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.tipo} · {new Date(s.inicio).toLocaleString("pt-BR")} · {s.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )
      )}
    </section>
  );
}
