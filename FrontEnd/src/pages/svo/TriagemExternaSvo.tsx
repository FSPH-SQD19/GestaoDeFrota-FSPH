import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../services/api";
import { respostaDeErro } from "../../lib/api";
import type {
  PaginaSolicitacoesExternasSvo,
  SolicitacaoExternaSvo,
} from "../../services/solicitacoesExternasSvoService";

const base = "/api/v1/solicitacoes-externas-svo";
const estados = ["AGUARDANDO_TRIAGEM", "AGUARDANDO_COMPLEMENTACAO"] as const;

export function TriagemExternaSvo() {
  const [estado, setEstado] = useState<(typeof estados)[number]>(estados[0]);
  const [fila, setFila] = useState<PaginaSolicitacoesExternasSvo>();
  const [pagina, setPagina] = useState(1);
  const [versao, setVersao] = useState(0);
  const [selecionada, setSelecionada] = useState<SolicitacaoExternaSvo>();
  const [decisao, setDecisao] = useState("ENCAMINHAR");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void api
      .get<PaginaSolicitacoesExternasSvo>(`${base}/triagem`, {
        params: { estado, page: pagina },
        signal: controller.signal,
      })
      .then(({ data }) => {
        const ultima = Math.max(1, data.meta.totalPages);
        if (pagina > ultima) setPagina(ultima);
        else setFila(data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setErro(respostaDeErro(error, "Não foi possível carregar a fila."));
      });
    return () => controller.abort();
  }, [estado, pagina, versao]);

  function mudarPagina(proxima: number) {
    setFila(undefined);
    setSelecionada(undefined);
    setErro("");
    setPagina(proxima);
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selecionada) return;
    const justificativa = String(
      new FormData(event.currentTarget).get("justificativa") ?? "",
    ).trim();
    setEnviando(true);
    setErro("");
    setMensagem("");
    try {
      const { data } = await api.patch<{ mensagem: string }>(`${base}/${selecionada.id}/triagem`, {
        decisao,
        justificativa: justificativa || undefined,
      });
      setMensagem(data.mensagem);
      setSelecionada(undefined);
      setFila(undefined);
      setVersao((valor) => valor + 1);
    } catch (error) {
      setErro(respostaDeErro(error, "Não foi possível registrar a triagem."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Triagem externa SVO</h1>
      <div className="flex flex-wrap items-center gap-3">
        <label>
          Fila{" "}
          <select
            value={estado}
            disabled={enviando}
            className="rounded-lg border p-2"
            onChange={(event) => {
              setEstado(event.target.value === estados[0] ? estados[0] : estados[1]);
              mudarPagina(1);
            }}
          >
            <option value={estados[0]}>Aguardando triagem</option>
            <option value={estados[1]}>Aguardando complementação</option>
          </select>
        </label>
        <button
          type="button"
          disabled={enviando}
          className="underline"
          onClick={() => {
            setErro("");
            setSelecionada(undefined);
            setVersao((valor) => valor + 1);
          }}
        >
          Atualizar fila
        </button>
      </div>
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
      {!fila && !erro && <p role="status">Carregando fila…</p>}
      {fila?.data.length === 0 && <p>Nenhuma solicitação nesta fila.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {fila?.data.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={enviando}
              aria-pressed={selecionada?.id === item.id}
              className="w-full rounded-xl border bg-white p-4 text-left"
              onClick={() => {
                setSelecionada(item);
                setDecisao(estado === estados[0] ? "ENCAMINHAR" : "RECUSAR");
                setErro("");
              }}
            >
              <strong>{item.protocolo}</strong>
              <span className="block">{item.nomeSolicitante}</span>
            </button>
          </li>
        ))}
      </ul>
      {fila && fila.meta.totalPages > 1 && (
        <div className="flex gap-4">
          <button
            type="button"
            disabled={enviando || pagina <= 1}
            onClick={() => mudarPagina(pagina - 1)}
          >
            Anterior
          </button>
          <span>
            {pagina} de {fila.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={enviando || pagina >= fila.meta.totalPages}
            onClick={() => mudarPagina(pagina + 1)}
          >
            Próxima
          </button>
        </div>
      )}
      {selecionada && (
        <article key={selecionada.id} className="space-y-3 rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">{selecionada.protocolo}</h2>
          <p>
            {selecionada.nomeSolicitante} · {selecionada.contato}
          </p>
          <p>{selecionada.enderecoOcorrencia}</p>
          <p className="whitespace-pre-wrap break-words">{selecionada.descricao}</p>
          {selecionada.historico
            ?.filter((item) => item.justificativa)
            .map((item, indice) => (
              <p key={indice} className="whitespace-pre-wrap break-words text-sm text-slate-700">
                {item.statusNovo} · {item.justificativa}
              </p>
            ))}
          <form onSubmit={salvar} className="space-y-3">
            <label className="block">
              Decisão{" "}
              <select
                value={decisao}
                onChange={(event) => setDecisao(event.target.value)}
                className="rounded-lg border p-2"
              >
                {estado === estados[0] && (
                  <>
                    <option value="ENCAMINHAR">Encaminhar ao gestor</option>
                    <option value="SOLICITAR_COMPLEMENTACAO">Pedir complementação</option>
                  </>
                )}
                <option value="RECUSAR">Recusar</option>
              </select>
            </label>
            <label className="block">
              Justificativa interna
              <textarea
                name="justificativa"
                required={decisao !== "ENCAMINHAR"}
                minLength={5}
                maxLength={500}
                className="block w-full rounded-lg border p-2"
              />
            </label>
            <button
              disabled={enviando}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            >
              Registrar triagem
            </button>
          </form>
        </article>
      )}
    </section>
  );
}
