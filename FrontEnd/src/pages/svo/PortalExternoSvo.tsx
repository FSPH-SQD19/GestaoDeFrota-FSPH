import { useEffect, useRef, useState, type FormEvent } from "react";
import { NotificacoesDropdown } from "../../components/layout/NotificacoesDropdown";
import { useAuth } from "../../contexts/auth";
import { respostaDeErro } from "../../lib/api";
import { api, resetCsrf } from "../../services/api";
import { startBrowserSession } from "../../services/browserSession";
import { dispararAtualizacaoNotificacoes } from "../../services/notificacoesService";

const base = "/api/v1/svo/solicitacoes-externas";
const campo = "block w-full rounded-lg border border-slate-300 bg-white p-2";
const botao = "rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50";
type Resumo = {
  id: string;
  protocolo: string;
  situacao: string;
  mensagem: string;
  permiteComplementar: boolean;
  atualizadoEm: string;
};
type Evento = { situacao: string; ocorridoEm: string };

function Campo({
  nome,
  rotulo,
  tipo = "text",
  min,
  max,
}: {
  nome: string;
  rotulo: string;
  tipo?: string;
  min?: number;
  max: number;
}) {
  return (
    <label className="block space-y-1">
      {rotulo}
      <input name={nome} type={tipo} required minLength={min} maxLength={max} className={campo} />
    </label>
  );
}

export function CadastroExternoSvo() {
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await api.post(
        "/api/v1/auth/cadastro-externo",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      resetCsrf();
      startBrowserSession();
      window.location.replace("/portal-svo");
    } catch (error) {
      setErro(respostaDeErro(error, "Não foi possível criar sua conta."));
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 p-5 sm:p-10">
      <h1 className="text-2xl font-semibold">Cadastro no portal SVO</h1>
      <form onSubmit={cadastrar} className="space-y-4">
        <Campo nome="nome" rotulo="Nome completo" min={2} max={150} />
        <Campo nome="email" rotulo="E-mail" tipo="email" max={150} />
        <Campo nome="telefone" rotulo="Telefone com DDD" tipo="tel" max={20} />
        <Campo nome="senha" rotulo="Senha" tipo="password" min={8} max={72} />
        {erro && (
          <p role="alert" className="text-red-700">
            {erro}
          </p>
        )}
        <button className={botao} disabled={enviando}>
          Criar conta
        </button>
      </form>
      <a href="/portal-svo" className="underline">
        Voltar para o login
      </a>
    </main>
  );
}

function Historico({ id }: { id: string }) {
  const [eventos, setEventos] = useState<Evento[]>();
  const [erro, setErro] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void api
      .get<{ historico: Evento[] }>(`${base}/${id}`, { signal: controller.signal })
      .then(({ data }) => setEventos(data.historico))
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setErro(respostaDeErro(error, "Não foi possível ler o histórico."));
      });
    return () => controller.abort();
  }, [id]);
  if (erro) return <p role="alert">{erro}</p>;
  if (!eventos) return <p role="status">Carregando histórico…</p>;
  return (
    <ol className="space-y-1 text-sm">
      {eventos.map((evento, indice) => (
        <li key={indice}>
          {evento.situacao} ·{" "}
          <time dateTime={evento.ocorridoEm}>
            {new Date(evento.ocorridoEm).toLocaleString("pt-BR")}
          </time>
        </li>
      ))}
    </ol>
  );
}

export function PortalExternoSvo() {
  const { logout } = useAuth();
  const [lista, setLista] = useState<Resumo[]>();
  const [historico, setHistorico] = useState<string>();
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [atualizacao, setAtualizacao] = useState(0);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const chave = useRef<string | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    void api
      .get<{ data: Resumo[]; meta: { totalPages: number } }>(base, {
        params: { page: pagina },
        signal: controller.signal,
      })
      .then(({ data }) => {
        setLista(data.data);
        setTotal(data.meta.totalPages);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setErro(respostaDeErro(error, "Não foi possível carregar suas solicitações."));
      });
    return () => controller.abort();
  }, [pagina, atualizacao]);

  async function enviar(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = Object.fromEntries(new FormData(form));
    setErro("");
    setMensagem("");
    setEnviando(true);
    try {
      if (id) {
        await api.patch(`${base}/${id}/complementacao`, dados);
        setMensagem("Complementação enviada para análise.");
      } else {
        chave.current ??= crypto.randomUUID();
        const { data } = await api.post<Resumo>(base, dados, {
          headers: { "Idempotency-Key": chave.current },
        });
        chave.current = undefined;
        setMensagem(`Solicitação recebida. Protocolo ${data.protocolo}.`);
        setPagina(1);
      }
      form.reset();
      setAtualizacao((valor) => valor + 1);
      dispararAtualizacaoNotificacoes();
    } catch (error) {
      setErro(respostaDeErro(error, "Não foi possível enviar. Tente novamente."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-9">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Portal de atendimento SVO</h1>
        <div className="flex items-center gap-4">
          <NotificacoesDropdown />
          <button type="button" className="underline" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </header>
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      {mensagem && (
        <p role="status" className="text-emerald-800">
          {mensagem}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border p-4">
          <h2 className="text-lg font-semibold">Nova solicitação</h2>
          <form onSubmit={(event) => void enviar(event)} className="space-y-3">
            <Campo nome="contatoNome" rotulo="Nome do contato" min={2} max={150} />
            <Campo nome="contatoTelefone" rotulo="Telefone com DDD" tipo="tel" max={20} />
            <Campo nome="enderecoOcorrencia" rotulo="Endereço da ocorrência" min={5} max={300} />
            <label className="block space-y-1">
              Descrição da ocorrência
              <textarea
                name="relatoOcorrencia"
                required
                minLength={10}
                maxLength={1000}
                className={campo}
                aria-describedby="orientacao-svo"
              />
            </label>
            <p id="orientacao-svo" className="text-sm text-slate-600">
              Descreva a situação sem informar dados de pacientes ou terceiros.
            </p>
            <button className={botao} disabled={enviando}>
              Enviar solicitação
            </button>
          </form>
        </section>
        <section className="space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="text-lg font-semibold">Minhas solicitações</h2>
            <button
              type="button"
              className="underline"
              onClick={() => {
                setErro("");
                setAtualizacao((valor) => valor + 1);
              }}
            >
              Atualizar
            </button>
          </div>
          {!lista && !erro && <p role="status">Carregando solicitações…</p>}
          {lista?.length === 0 && <p>Nenhuma solicitação encontrada.</p>}
          {lista?.map((item) => (
            <article key={item.id} className="space-y-2 rounded-lg bg-slate-50 p-3">
              <h3 className="font-semibold">
                {item.protocolo} · {item.situacao}
              </h3>
              <p>{item.mensagem}</p>
              <button
                type="button"
                className="block text-sm underline"
                aria-expanded={historico === item.id}
                onClick={() => setHistorico(historico === item.id ? undefined : item.id)}
              >
                Histórico do protocolo
              </button>
              {historico === item.id && <Historico key={item.atualizadoEm} id={item.id} />}
              {item.permiteComplementar && (
                <form onSubmit={(event) => void enviar(event, item.id)} className="space-y-2">
                  <label className="block">
                    Informações complementares
                    <textarea
                      name="complemento"
                      required
                      minLength={5}
                      maxLength={1000}
                      className={campo}
                    />
                  </label>
                  <button className={botao} disabled={enviando}>
                    Enviar complemento
                  </button>
                </form>
              )}
            </article>
          ))}
          {total > 1 && (
            <div className="flex justify-between gap-2">
              <button type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
                Anterior
              </button>
              <span>
                {pagina} de {total}
              </span>
              <button
                type="button"
                disabled={pagina >= total}
                onClick={() => setPagina(pagina + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
