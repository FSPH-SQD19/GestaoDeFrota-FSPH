import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  Search,
} from "lucide-react";
import { Badge, Button, Card, Input } from "../../components/common";
import { cn } from "../../lib/utils";
import {
  FILTROS,
  classificarChamado,
  STATUS_CHAMADO_LABEL,
  STATUS_CHAMADO_VARIANT,
} from "./svoApresentacao";
import type { ChamadoSvo } from "../../services/svo";
import type { useSvoDados } from "./useSvoDados";
type Props = Pick<
  ReturnType<typeof useSvoDados>,
  | "chamados"
  | "busca"
  | "etapa"
  | "page"
  | "totalPages"
  | "totalRegistros"
  | "carregando"
  | "handleBuscaChange"
  | "handleFiltroChange"
  | "limparFiltros"
  | "mudarPagina"
> & {
  processandoAcaoId: string | null;
  abrirTriagem: (chamado: ChamadoSvo) => void;
  abrirEmissaoOrdem: (chamado: ChamadoSvo) => void;
  abrirDetalhes: (chamado: ChamadoSvo) => void;
  handleConcluirColeta: (chamado: ChamadoSvo) => void;
};
export function FilaChamadosSvo({
  chamados,
  busca,
  etapa,
  page,
  totalPages,
  totalRegistros,
  carregando,
  handleBuscaChange,
  handleFiltroChange,
  limparFiltros,
  mudarPagina,
  processandoAcaoId,
  abrirTriagem,
  abrirEmissaoOrdem,
  abrirDetalhes,
  handleConcluirColeta,
}: Props) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Fila de chamados</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {totalRegistros}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Acompanhe o atendimento, a triagem e a execução das ordens de coleta.
          </p>
        </div>
        <label className="relative w-full sm:max-w-[250px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Buscar chamado"
            value={busca}
            onChange={(e) => handleBuscaChange(e.target.value)}
            placeholder="Protocolo, nome ou endereço"
            className="pl-9"
          />
        </label>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-3">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => handleFiltroChange(f.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 pb-3 text-xs font-semibold transition-colors",
              etapa === f.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-slate-100">
        {carregando && chamados.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Carregando chamados do SVO...
          </div>
        ) : (
          chamados.map((c) => {
            const statusOp = classificarChamado(c);
            const protocolo = c.numeroProtocolo ?? c.id;
            const processandoEste = processandoAcaoId === c.id;

            return (
              <article key={c.id} className="p-4 transition-colors hover:bg-slate-50/70 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold tracking-wide text-slate-700">
                        {protocolo}
                      </span>
                      <Badge size="sm" variant={STATUS_CHAMADO_VARIANT[statusOp]} dot>
                        {STATUS_CHAMADO_LABEL[statusOp]}
                      </Badge>
                      {c.ordemColeta?.veiculo && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                          {c.ordemColeta.veiculo.placa}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-800">
                      {c.nomeFalecido || "Identificação não informada"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.enderecoOcorrencia || "Endereço não informado"}
                      </span>
                      {c.ordemColeta?.numeroDeclaracaoObito && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          DO: {c.ordemColeta.numeroDeclaracaoObito}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {statusOp === "EM_ANALISE" && (
                      <Button size="sm" onClick={() => abrirTriagem(c)}>
                        Iniciar triagem
                      </Button>
                    )}
                    {statusOp === "AGUARDANDO_ORDEM" && (
                      <Button size="sm" onClick={() => abrirEmissaoOrdem(c)}>
                        Emitir ordem
                      </Button>
                    )}
                    {statusOp === "EM_OPERACAO" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConcluirColeta(c)}
                        disabled={processandoEste}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        {processandoEste ? "Concluindo..." : "Concluir coleta"}
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => abrirDetalhes(c)}
                      aria-label={`Ver detalhes ${protocolo}`}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}

        {!carregando && chamados.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            Nenhum chamado encontrado para os filtros selecionados.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalRegistros}{" "}
          {totalRegistros === 1 ? "chamado" : "chamados"})
        </span>
        <div className="flex items-center gap-2">
          {(busca || etapa !== "TODOS") && (
            <button
              type="button"
              onClick={limparFiltros}
              className="mr-2 font-semibold text-slate-700 hover:text-blue-700"
            >
              Limpar filtros <ArrowUpRight className="inline h-3.5 w-3.5" />
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || carregando}
            onClick={() => mudarPagina(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages || carregando}
            onClick={() => mudarPagina(page + 1)}
          >
            Próxima <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
