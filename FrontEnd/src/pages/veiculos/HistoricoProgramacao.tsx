import {
  type AlteracaoProgramacao,
  formatarDataHora,
  formatarPeriodo,
} from "../../services/manutencoesService";

const acoes = { PROGRAMAR: "Programada", REAGENDAR: "Reagendada", CANCELAR: "Cancelada" };

export function HistoricoProgramacao({ historico }: { historico: AlteracaoProgramacao[] }) {
  if (!historico.length) return null;
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer">Histórico de alterações</summary>
      <ul className="mt-2 space-y-2">
        {historico.map((item) => (
          <li key={item.id}>
            <p>
              {acoes[item.acao]} por {item.autor} em {formatarDataHora(item.criadoEm)}
            </p>
            {item.acao === "REAGENDAR" && item.dados?.anterior && (
              <p>
                Período anterior ·{" "}
                {formatarPeriodo(
                  item.dados.anterior.inicioPrevisto,
                  item.dados.anterior.fimPrevisto,
                )}
              </p>
            )}
            {item.dados?.atual && (
              <p>
                Período registrado ·{" "}
                {formatarPeriodo(item.dados.atual.inicioPrevisto, item.dados.atual.fimPrevisto)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
