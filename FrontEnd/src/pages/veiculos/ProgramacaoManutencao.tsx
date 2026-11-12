import { useEffect, useRef, useState } from "react";
import { Button, Input, Select, Textarea } from "../../components/common";
import { apiRequest, respostaDeErro } from "../../lib/api";
import {
  cancelarProgramacao,
  consultarConflitos,
  listarProgramacoes,
  salvarProgramacao,
  dataHoraDoFormulario,
  dataHoraParaApi,
  formatarPeriodo,
  type ConflitosProgramacao,
  type Programacao,
  type ProgramacaoInput,
} from "../../services/manutencoesService";
import { HistoricoProgramacao } from "./HistoricoProgramacao";

type Oficina = { id: string; razaoSocial: string; tipoServico: string; ativo: boolean };
const formularioVazio = { inicio: "", fim: "", fornecedorId: "", descricao: "" };

export function ProgramacaoManutencao({ veiculoId }: { veiculoId: string }) {
  const [formulario, setFormulario] = useState(formularioVazio);
  const [edicao, setEdicao] = useState<Programacao | null>(null);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [erroOficinas, setErroOficinas] = useState("");
  const [pagina, setPagina] = useState(1);
  const [revisao, setRevisao] = useState(0);
  const [historico, setHistorico] = useState<{
    chave: string;
    data: Programacao[];
    totalPages: number;
    erro: string;
  } | null>(null);
  const [conflitos, setConflitos] = useState<{
    chave: string;
    dados: ConflitosProgramacao | null;
    erro: string;
  } | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const salvando = useRef(false);
  const janelaValida = Boolean(
    formulario.inicio && formulario.fim && formulario.inicio < formulario.fim,
  );
  const chaveConflitos = JSON.stringify([
    veiculoId,
    formulario.inicio,
    formulario.fim,
    edicao?.id,
    revisao,
  ]);
  const chaveHistorico = JSON.stringify([veiculoId, pagina, revisao]);
  const consultaAtual = conflitos?.chave === chaveConflitos ? conflitos : null;
  const historicoAtual = historico?.chave === chaveHistorico ? historico : null;
  const temConflitos = Boolean(
    consultaAtual?.dados &&
    (consultaAtual.dados.viagens.length || consultaAtual.dados.manutencoes.length),
  );

  useEffect(() => {
    let ativo = true;
    void apiRequest<{ dados: Oficina[] }>("/fornecedores")
      .then((resposta) => {
        if (ativo) {
          setOficinas(
            resposta.dados.filter((item) => item.ativo && item.tipoServico === "OFICINA"),
          );
          setErroOficinas("");
        }
      })
      .catch((error) => {
        if (ativo) setErroOficinas(respostaDeErro(error));
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    void listarProgramacoes(veiculoId, pagina)
      .then((resposta) => {
        if (ativo)
          setHistorico({
            chave: chaveHistorico,
            data: resposta.data,
            totalPages: resposta.meta.totalPages,
            erro: "",
          });
      })
      .catch((error) => {
        if (ativo)
          setHistorico({
            chave: chaveHistorico,
            data: [],
            totalPages: 0,
            erro: respostaDeErro(error),
          });
      });
    return () => {
      ativo = false;
    };
  }, [veiculoId, pagina, chaveHistorico]);

  useEffect(() => {
    if (!janelaValida) return;
    let ativo = true;
    const timer = window.setTimeout(() => {
      const dados = {
        veiculoId,
        inicioPrevisto: dataHoraParaApi(formulario.inicio),
        fimPrevisto: dataHoraParaApi(formulario.fim),
        fornecedorId: null,
        descricao: null,
      };
      void consultarConflitos(dados, edicao?.id)
        .then((resposta) => {
          if (ativo) setConflitos({ chave: chaveConflitos, dados: resposta, erro: "" });
        })
        .catch((error) => {
          if (ativo)
            setConflitos({ chave: chaveConflitos, dados: null, erro: respostaDeErro(error) });
        });
    }, 300);
    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [veiculoId, formulario.inicio, formulario.fim, edicao?.id, janelaValida, chaveConflitos]);

  function limparFormulario() {
    setEdicao(null);
    setFormulario(formularioVazio);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando.current || !janelaValida || !consultaAtual?.dados || temConflitos) return;
    salvando.current = true;
    setEnviando(true);
    setErro("");
    setMensagem("");
    const dados: ProgramacaoInput = {
      veiculoId,
      inicioPrevisto: dataHoraParaApi(formulario.inicio),
      fimPrevisto: dataHoraParaApi(formulario.fim),
      fornecedorId: formulario.fornecedorId || null,
      descricao: formulario.descricao.trim() || null,
    };
    try {
      await salvarProgramacao(dados, edicao ?? undefined);
      setMensagem(edicao ? "Manutenção reagendada." : "Manutenção programada.");
      limparFormulario();
      setPagina(1);
    } catch (error) {
      setErro(respostaDeErro(error));
    } finally {
      setRevisao((valor) => valor + 1);
      setEnviando(false);
      salvando.current = false;
    }
  }

  async function cancelar(item: Programacao) {
    if (salvando.current) return;
    salvando.current = true;
    setEnviando(true);
    setErro("");
    setMensagem("");
    try {
      await cancelarProgramacao(item);
      if (edicao?.id === item.id) limparFormulario();
      setMensagem("Programação cancelada. O período foi liberado.");
    } catch (error) {
      setErro(respostaDeErro(error));
    } finally {
      setRevisao((valor) => valor + 1);
      setEnviando(false);
      salvando.current = false;
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={salvar} className="space-y-3">
        <h2 className="font-semibold">
          {edicao ? "Reagendar manutenção preventiva" : "Programar manutenção preventiva"}
        </h2>
        <p className="text-sm text-slate-600">Horário de Brasília.</p>
        <fieldset disabled={enviando} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="datetime-local"
              label="Início"
              required
              value={formulario.inicio}
              onChange={(event) => setFormulario({ ...formulario, inicio: event.target.value })}
            />
            <Input
              type="datetime-local"
              label="Fim"
              required
              value={formulario.fim}
              onChange={(event) => setFormulario({ ...formulario, fim: event.target.value })}
            />
          </div>
          <Select
            label="Oficina (opcional)"
            value={formulario.fornecedorId}
            onChange={(event) => setFormulario({ ...formulario, fornecedorId: event.target.value })}
          >
            <option value="">Ainda não definida</option>
            {edicao?.fornecedorId && !oficinas.some((item) => item.id === edicao.fornecedorId) && (
              <option value={edicao.fornecedorId}>
                {edicao.fornecedor?.razaoSocial ?? "Oficina anterior"}
              </option>
            )}
            {oficinas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.razaoSocial}
              </option>
            ))}
          </Select>
          {erroOficinas && <p role="alert">{erroOficinas}</p>}
          <Textarea
            label="Motivo ou observações (opcional)"
            maxLength={2000}
            value={formulario.descricao}
            onChange={(event) => setFormulario({ ...formulario, descricao: event.target.value })}
          />
          {formulario.inicio && formulario.fim && !janelaValida && (
            <p role="alert">O fim deve ser posterior ao início.</p>
          )}
          {janelaValida && !consultaAtual && <p role="status">Consultando reservas do veículo…</p>}
          {consultaAtual?.erro && <p role="alert">{consultaAtual.erro}</p>}
          {consultaAtual?.dados && (
            <div className={temConflitos ? "rounded-lg bg-amber-50 p-3" : "text-emerald-800"}>
              {temConflitos ? (
                <>
                  <p className="font-semibold">Escolha outro período para resolver os conflitos.</p>
                  <ul className="mt-2 space-y-2">
                    {consultaAtual.dados.viagens.map((item) => (
                      <li key={item.id}>
                        {item.protocolo} · {item.status === "APROVADA" ? "Aprovada" : "Em trânsito"}{" "}
                        · {formatarPeriodo(item.dataHoraPretendida, item.dataHoraRetornoPrevista)}
                      </li>
                    ))}
                    {consultaAtual.dados.manutencoes.map((item) => (
                      <li key={item.id}>
                        Manutenção preventiva ·{" "}
                        {formatarPeriodo(item.inicioPrevisto, item.fimPrevisto)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Nenhum conflito encontrado.</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={!janelaValida || !consultaAtual?.dados || temConflitos || enviando}
            >
              {enviando
                ? "Salvando…"
                : edicao
                  ? "Confirmar reagendamento"
                  : "Confirmar programação"}
            </Button>
            {edicao && (
              <Button type="button" variant="outline" onClick={limparFormulario}>
                Sair da edição
              </Button>
            )}
            {consultaAtual?.erro && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevisao((valor) => valor + 1)}
              >
                Consultar novamente
              </Button>
            )}
          </div>
        </fieldset>
      </form>
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
      <section className="space-y-3 border-t border-slate-200 pt-4">
        <h2 className="font-semibold">Histórico de programação preventiva</h2>
        {!historicoAtual && <p role="status">Carregando histórico…</p>}
        {historicoAtual?.erro && <p role="alert">{historicoAtual.erro}</p>}
        {historicoAtual && !historicoAtual.erro && !historicoAtual.data.length && (
          <p>Nenhuma programação cadastrada.</p>
        )}
        {historicoAtual?.data.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 p-3">
            <h3 className="font-semibold">
              {item.status === "PROGRAMADA" ? "Programada" : "Cancelada"} ·{" "}
              {formatarPeriodo(item.inicioPrevisto, item.fimPrevisto)}
            </h3>
            <p>{item.fornecedor?.razaoSocial ?? "Oficina ainda não definida"}</p>
            {item.descricao && <p>{item.descricao}</p>}
            <HistoricoProgramacao historico={item.historico} />
            {item.status === "PROGRAMADA" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={enviando}
                  onClick={() => {
                    setEdicao(item);
                    setErro("");
                    setMensagem("");
                    setFormulario({
                      inicio: dataHoraDoFormulario(item.inicioPrevisto),
                      fim: dataHoraDoFormulario(item.fimPrevisto),
                      fornecedorId: item.fornecedorId ?? "",
                      descricao: item.descricao ?? "",
                    });
                  }}
                >
                  Reagendar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={enviando}
                  onClick={() => void cancelar(item)}
                >
                  Cancelar programação
                </Button>
              </div>
            )}
          </article>
        ))}
        {historicoAtual && historicoAtual.totalPages > 1 && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pagina <= 1 || enviando}
              onClick={() => setPagina((valor) => valor - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {pagina} de {historicoAtual.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={pagina >= historicoAtual.totalPages || enviando}
              onClick={() => setPagina((valor) => valor + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
