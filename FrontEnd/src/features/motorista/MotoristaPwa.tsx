import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CarFront,
  Check,
  Clock3,
  CornerUpRight,
  Fuel,
  History,
  LocateFixed,
  LogOut,
  MapPin,
  RefreshCw,
  Route,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../contexts/auth";
import { useDiarioMotorista, type Inicio } from "./useDiarioMotorista";
import { PrimaryButton, PrepararViagem, AbastecimentoForm, RetornoForm } from "./DriverForms";
import DriverDialog from "./DriverDialog";
import CorrigirComando from "./CorrigirComando";
import ListaViagensMotorista from "./ListaViagensMotorista";
import { viagensDoMotorista, horarioViagem } from "./viagensMotorista";
import type { Coordenadas, Ponto, Veiculo } from "./types";
import logo from "../../assets/branding/rota/rota-symbol-color.svg";
import "./driver.css";
const Mapa = lazy(() => import("./Mapa"));
type Modal = "inicio" | "combustivel" | "retorno" | "percurso" | "pendencias" | "viagens" | null;
export default function MotoristaPwa({ onOpenManagement }: { onOpenManagement?: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !globalThis.ResizeObserver) return;
    const observer = new ResizeObserver(() => {
      (panel.closest(".driver-app") as HTMLElement)?.style.setProperty(
        "--driver-panel-height",
        `${panel.getBoundingClientRect().height}px`,
      );
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    document.body.classList.add("driver-mode");
    return () => document.body.classList.remove("driver-mode");
  }, []);
  const d = useDiarioMotorista(),
    { logout } = useAuth();
  const [view, setView] = useState("viagens"),
    [modal, setModal] = useState<Modal>(null),
    [inicio, setInicio] = useState<Inicio | null>(null),
    [viagemSelecionada, setViagemSelecionada] = useState<string | null>(null),
    [editando, setEditando] = useState<string | null>(null),
    [recenter, setRecenter] = useState(0),
    [previewPosition, setPreviewPosition] = useState<Coordenadas>(),
    [locationError, setLocationError] = useState("");
  const { state, current, online, busy, encerrando } = d;
  const tasks = viagensDoMotorista(state.tarefas);
  const first = tasks.find((t) => t.id === viagemSelecionada) ?? tasks[0];
  const foiVisitada = (id: string) =>
    !!current?.ordens.find((o) => o.ordemId === id)?.visitadaEm ||
    state.comandos.some(
      (c) => c.saidaId === current?.id && c.comando.tipo === "VISITA" && c.comando.ordemId === id,
    );
  const proximaColeta =
    current?.tipo === "SVO"
      ? current.pontos.find((p) => p.id !== "base" && !foiVisitada(p.id))
      : undefined;
  const destino = current
    ? (proximaColeta ??
      current.pontos.find((p) => p.id === (current.tipo === "SVO" ? "base" : "destino")))
    : undefined;
  const totalColetas = current?.ordens.length ?? 0,
    coletadas = current?.ordens.filter((o) => foiVisitada(o.ordemId)).length ?? 0;
  const points: Ponto[] =
    current?.pontos ??
    (first?.coordenadas?.length === 2
      ? [{ id: first.id, nome: first.destino, coordenadas: first.coordenadas as Coordenadas }]
      : []);
  const pending = state.comandos.length + state.posicoes.length;
  const posicao = d.gps.posicao?.coordenadas ?? previewPosition;
  const rota = current ? state.rota : undefined;
  function preparar(tipo: Inicio["tipo"], id: string, veiculo: Veiculo) {
    setInicio({ id: crypto.randomUUID(), tipo, tarefaId: id, veiculo });
    setModal("inicio");
  }
  function localizar() {
    setRecenter((n) => n + 1);
    if (posicao) return;
    if (!navigator.geolocation) {
      setLocationError("Localização não disponível neste aparelho.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPreviewPosition([p.coords.longitude, p.coords.latitude]);
        setLocationError("");
        setRecenter((n) => n + 1);
      },
      () => setLocationError("Permita o acesso à localização nas configurações do navegador."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }
  const modalTitle =
    modal === "viagens"
      ? "Todas as viagens"
      : modal === "inicio"
        ? "Preparar saída"
        : modal === "combustivel"
          ? "Registrar abastecimento"
          : modal === "retorno"
            ? "Retorno e encerramento"
            : modal === "percurso"
              ? "Seu percurso"
              : "Lançamentos pendentes";
  const titulo = current
    ? (destino?.nome ?? "Viagem em andamento")
    : (first?.destino ?? "Nenhuma viagem atribuída");
  const erro = d.erro || locationError;
  return (
    <main className="driver-app" aria-label="Área do motorista">
      <h1 className="sr-only">Minhas Viagens</h1>
      <Suspense
        fallback={
          <div className="driver-map-fallback" role="status">
            Carregando mapa...
          </div>
        }
      >
        <Mapa
          fullscreen
          pontos={points}
          posicao={posicao}
          rota={rota}
          recenterToken={recenter}
          focus={!current ? (points[0]?.coordenadas ?? undefined) : undefined}
        />
      </Suspense>
      <header className="driver-topbar">
        <div className="driver-brand">
          <img src={logo} alt="" />
          <strong>
            ROTA<small>FSPH</small>
          </strong>
        </div>
        <button className="driver-avatar" aria-label="Abrir conta" onClick={() => setView("conta")}>
          <UserRound size={21} />
        </button>
      </header>
      <div className="driver-status" role="status">
        <span className={`driver-status-dot ${!online ? "is-offline" : ""}`} />
        {!online
          ? "Sem internet · registros salvos no aparelho"
          : current
            ? d.gps.posicao
              ? d.gps.posicao.precisao <= 100
                ? "Localização ativa"
                : "GPS com baixa precisão"
              : "Aguardando localização"
            : "Conectado"}
      </div>
      {current && rota && view === "viagens" && (
        <div className="driver-turn">
          <CornerUpRight size={28} />
          <div>
            <strong>{rota.instrucoes[0]?.texto ?? "Siga o percurso no mapa"}</strong>
            <p>{rota.destino.nome}</p>
          </div>
        </div>
      )}
      {!modal && erro && (
        <div className="driver-notice">
          <p className="driver-alert" role="alert">
            {erro}
          </p>
        </div>
      )}
      <section
        ref={panelRef}
        className="driver-panel"
        data-view={view}
        aria-label={
          view === "viagens"
            ? "Sua viagem"
            : view === "historico"
              ? "Histórico de viagens"
              : "Sua conta"
        }
      >
        <div className="driver-map-tools">
          <button
            className="driver-locate"
            aria-label="Centralizar minha localização"
            onClick={localizar}
          >
            <LocateFixed size={22} />
          </button>
        </div>
        <div className="driver-grip" />
        <div className="driver-panel-body">
          {d.enabled === false ? (
            <div className="driver-empty">
              <ShieldCheck size={26} />
              <h2 className="driver-section-title">Aguardando liberação</h2>
              <p>A equipe ainda não ativou o acesso às viagens.</p>
              <button className="driver-text-button" onClick={() => void d.action(d.refresh)}>
                <RefreshCw size={16} />
                Atualizar
              </button>
            </div>
          ) : view === "viagens" ? (
            <>
              {current ? (
                <>
                  <p className="driver-panel-label">
                    {encerrando
                      ? "Retorno salvo · aguardando envio"
                      : current.tipo === "SVO"
                        ? `Coleta ${Math.min(coletadas + 1, totalColetas)} de ${totalColetas} · ${coletadas === totalColetas ? "Retorno à base" : "Em andamento"}`
                        : "Viagem administrativa em andamento"}
                  </p>
                  {rota && (
                    <p className="driver-panel-label">
                      <strong>
                        {Math.ceil(rota.duracao / 60)} min ·{" "}
                        {(rota.distancia / 1000).toFixed(1).replace(".", ",")} km
                      </strong>{" "}
                      · estimativa{!online ? " salva" : ""}
                    </p>
                  )}
                  <h2 className="driver-destination">{titulo}</h2>
                  <p className="driver-origin">
                    {proximaColeta
                      ? "Siga a sequência de coletas definida pela central."
                      : current.tipo === "SVO"
                        ? "Todas as coletas registradas. Retorne à base."
                        : `Saída às ${new Date(current.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ${Number(current.kmInicial).toLocaleString("pt-BR")} km iniciais`}
                  </p>
                  {d.gps.erro && (
                    <p className="driver-alert" role="status">
                      {d.gps.erro}
                    </p>
                  )}
                  <div className="driver-utilities">
                    <button
                      className="driver-secondary"
                      disabled={encerrando}
                      onClick={() => setModal("combustivel")}
                    >
                      <Fuel size={19} />
                      Abastecer
                    </button>
                    <button className="driver-secondary" onClick={() => setModal("percurso")}>
                      <Route size={19} />
                      Ver percurso
                    </button>
                  </div>
                  <PrimaryButton
                    busy={busy}
                    disabled={encerrando}
                    onClick={() =>
                      proximaColeta
                        ? void d.action(() =>
                            d.enfileirar({
                              id: crypto.randomUUID(),
                              tipo: "VISITA",
                              ordemId: proximaColeta.id,
                            }),
                          )
                        : setModal("retorno")
                    }
                  >
                    {encerrando
                      ? "Aguardando sincronização"
                      : proximaColeta
                        ? "Registrar coleta"
                        : "Finalizar viagem"}
                  </PrimaryButton>
                </>
              ) : d.enabled === null || !state.tarefas ? (
                <div className="driver-empty">
                  <h2 className="driver-section-title">Buscando suas viagens...</h2>
                  <p>Conectando com a central.</p>
                </div>
              ) : first ? (
                <>
                  <p className="driver-panel-label">
                    {viagemSelecionada === first.id ? "Viagem selecionada" : "Próxima viagem"} ·{" "}
                    {first.tipo === "SVO" ? "SVO" : first.categoria}
                  </p>
                  <h2 className="driver-destination">{first.destino}</h2>
                  <p className="driver-origin">
                    {first.origem ? `Saída: ${first.origem}` : "Origem informada pela central"}
                  </p>
                  {horarioViagem(first.horario) && (
                    <p className="driver-hint">
                      Saída prevista: {horarioViagem(first.horario)}
                      {first.passageiros
                        ? ` · ${first.passageiros} passageiro${first.passageiros !== 1 ? "s" : ""}`
                        : ""}
                    </p>
                  )}
                  {first.veiculo ? (
                    <div className="driver-vehicle">
                      <CarFront size={28} />
                      <div>
                        <strong>{first.veiculo.modelo}</strong>
                        <span>{first.veiculo.placa}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="driver-alert">Aguardando veículo da central.</p>
                  )}
                  <p className="driver-hint">Confira o veículo antes de sair.</p>
                  <PrimaryButton
                    disabled={!online || !!state.comandos.length || !first.veiculo}
                    onClick={() => first.veiculo && preparar(first.tipo, first.id, first.veiculo)}
                  >
                    Preparar saída
                  </PrimaryButton>
                  <button
                    type="button"
                    className="driver-text-button driver-all-trips"
                    onClick={() => setModal("viagens")}
                  >
                    <CarFront size={17} />
                    Ver todas as viagens ({tasks.length})<ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <div className="driver-empty">
                  <div className="driver-empty-icon">
                    <CarFront size={24} />
                  </div>
                  <h2 className="driver-destination">Nenhuma viagem atribuída</h2>
                  <p>Quando a central atribuir uma viagem, ela aparecerá aqui.</p>
                  <button
                    className="driver-secondary"
                    disabled={busy || !online}
                    onClick={() => void d.action(d.refresh)}
                  >
                    <RefreshCw size={17} />
                    Atualizar viagens
                  </button>
                </div>
              )}
              {(state.comandos.length > 0 || (!online && pending > 0)) && (
                <button className="driver-sync" onClick={() => setModal("pendencias")}>
                  <RefreshCw size={14} />
                  {state.comandos.length} lançamento{state.comandos.length !== 1 ? "s" : ""}{" "}
                  pendente{state.comandos.length !== 1 ? "s" : ""}
                  {state.posicoes.length ? ` · ${state.posicoes.length} posições` : ""}
                  <ArrowRight size={14} />
                </button>
              )}
            </>
          ) : view === "historico" ? (
            <>
              <h2 className="driver-section-title">Histórico</h2>
              <p className="driver-hint">Suas últimas viagens concluídas.</p>
              {state.tarefas?.historico.length ? (
                state.tarefas.historico.map((s) => (
                  <article className="driver-history-row" key={s.id}>
                    <strong>{s.tipo === "SVO" ? "Coletas SVO" : "Viagem administrativa"}</strong>
                    <p>
                      {new Date(s.inicio).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p>
                      {s.kmInicial} → {s.kmFinal} km · Concluída
                    </p>
                    <span>
                      {(Number(s.kmFinal) - Number(s.kmInicial)).toLocaleString("pt-BR")} km
                      percorridos
                    </span>
                  </article>
                ))
              ) : (
                <div className="driver-empty">
                  <div className="driver-empty-icon">
                    <History size={23} />
                  </div>
                  <p>Nenhuma saída concluída. Suas viagens finalizadas aparecerão aqui.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="driver-section-title">Sua conta</h2>
              <div className="driver-account">
                <strong>{d.user.nome}</strong>
                <p>{d.user.email}</p>
                <p>Motorista · FSPH</p>
              </div>
              <button className="driver-task-row" onClick={() => setModal("pendencias")}>
                <div>
                  <strong>Envios pendentes</strong>
                  <span>
                    {pending
                      ? `${pending} registros aguardando sincronização`
                      : "Todos os registros foram enviados"}
                  </span>
                </div>
                <RefreshCw size={20} />
              </button>
              {onOpenManagement && (
                <button className="driver-task-row" onClick={onOpenManagement}>
                  <strong>Abrir gestão</strong>
                  <ArrowRight size={20} />
                </button>
              )}
              <button
                className="driver-task-row"
                onClick={() => void d.action(logout)}
                disabled={busy}
              >
                <strong>Encerrar sessão</strong>
                <LogOut size={20} />
              </button>
            </>
          )}
        </div>
        <nav className="driver-nav" aria-label="Navegação do motorista">
          {[
            { key: "viagens", label: "Viagens", icon: CarFront },
            { key: "historico", label: "Histórico", icon: Clock3 },
            { key: "conta", label: "Conta", icon: UserRound },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              aria-current={view === key ? "page" : undefined}
              onClick={() => setView(key)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </section>
      {modal && (
        <DriverDialog
          title={modalTitle}
          onClose={() => {
            setModal(null);
            setEditando(null);
          }}
          busy={busy}
        >
          {erro && (
            <p className="driver-alert" role="alert">
              {erro}
            </p>
          )}
          {modal === "viagens" && (
            <ListaViagensMotorista
              viagens={tasks}
              selecionada={first?.id}
              onSelect={(id) => {
                setViagemSelecionada(id);
                setModal(null);
                setRecenter((n) => n + 1);
              }}
            />
          )}
          {modal === "inicio" && inicio && (
            <PrepararViagem
              inicio={inicio}
              busy={busy}
              onStart={(km, checklist) =>
                d.action(async () => {
                  await d.iniciar(inicio, km, checklist);
                  setModal(null);
                  setView("viagens");
                })
              }
            />
          )}
          {modal === "combustivel" && current && (
            <AbastecimentoForm
              kmMinimo={Number(current.kmInicial)}
              fornecedores={d.fornecedores}
              busy={busy}
              onSave={(c) =>
                d.action(async () => {
                  await d.enfileirar(c);
                  setModal(null);
                })
              }
            />
          )}
          {modal === "retorno" && current && (
            <RetornoForm
              kmMinimo={Number(current.kmInicial)}
              busy={busy}
              onSave={(c) =>
                d.action(async () => {
                  await d.enfileirar(c);
                  setModal(null);
                })
              }
            />
          )}
          {modal === "percurso" && (
            <>
              <p className="driver-hint">
                {rota
                  ? `Calculada às ${new Date(rota.calculadaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Estimativa sem trânsito ao vivo.`
                  : "A rota aparecerá quando a localização e o serviço de rotas estiverem disponíveis."}
              </p>
              {current?.tipo === "ADMINISTRATIVA" && (
                <div className="driver-list">
                  {current.pontos.map((p) => (
                    <div className="driver-task-row" key={p.id}>
                      <div>
                        <strong>{p.nome}</strong>
                        <span>{p.id === "origem" ? "Origem da viagem" : "Destino da viagem"}</span>
                      </div>
                      <MapPin size={18} />
                    </div>
                  ))}
                </div>
              )}
              {current?.tipo === "SVO" && (
                <div className="driver-list">
                  {current.pontos.map((p) => (
                    <div className="driver-task-row" key={p.id}>
                      <div>
                        <strong>{p.nome}</strong>
                        <span>
                          {p.id === "base"
                            ? "Retorno à base"
                            : foiVisitada(p.id)
                              ? "Coleta registrada"
                              : "Próxima parada"}
                        </span>
                      </div>
                      {foiVisitada(p.id) ? <Check size={18} /> : <MapPin size={18} />}
                    </div>
                  ))}
                </div>
              )}
              {rota && (
                <ol className="driver-route-list">
                  {rota.instrucoes.map((i, k) => (
                    <li key={k}>
                      {i.texto}
                      <small>{Math.round(i.distancia)} m</small>
                    </li>
                  ))}
                </ol>
              )}
              <button
                className="driver-secondary"
                disabled={!online || !d.gps.posicao || encerrando}
                onClick={() => void d.calcular(true)}
              >
                <RefreshCw size={17} />
                Recalcular rota
              </button>
            </>
          )}
          {modal === "pendencias" && (
            <>
              <p className="driver-hint">
                {online
                  ? "Os registros são enviados automaticamente. Você pode tentar novamente abaixo."
                  : "Seus registros estão salvos neste aparelho. O envio continua quando a conexão voltar."}
              </p>
              {!pending && <p className="driver-empty">Tudo sincronizado.</p>}
              {state.posicoes.length > 0 && (
                <p className="driver-hint">{state.posicoes.length} posições aguardando envio.</p>
              )}
              {state.comandos.map((p) => (
                <div className="driver-history-row" key={p.comando.id}>
                  <strong>
                    {
                      { VISITA: "Coleta", ABASTECIMENTO: "Abastecimento", ENCERRAR: "Retorno" }[
                        p.comando.tipo
                      ]
                    }
                  </strong>
                  <p>{p.erro ?? "Aguardando sincronização"}</p>
                  {p.erro && (
                    <button
                      className="driver-text-button"
                      onClick={() => setEditando(p.comando.id)}
                    >
                      Corrigir lançamento
                    </button>
                  )}
                  {editando === p.comando.id && (
                    <CorrigirComando
                      fornecedores={d.fornecedores}
                      pontos={current?.pontos ?? []}
                      comando={p.comando}
                      onCancel={() => setEditando(null)}
                      onSave={(c) =>
                        d.action(async () => {
                          await d.corrigir(p.comando.id, c);
                          setEditando(null);
                        })
                      }
                    />
                  )}
                </div>
              ))}
              <button
                className="driver-secondary"
                disabled={busy || !online || !pending}
                onClick={() => void d.action(d.refresh)}
              >
                <RefreshCw size={17} />
                Sincronizar agora
              </button>
            </>
          )}
        </DriverDialog>
      )}
    </main>
  );
}
