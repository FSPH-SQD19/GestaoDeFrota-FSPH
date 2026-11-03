import { useEffect, useState } from "react";
import {
  obterChamadosSvo,
  obterEscalasEmAndamentoSvo,
  obterIndicadoresSvo,
  obterMotoristasSvo,
  obterViaturasSvo,
  extrairErroSvo,
  type ChamadoSvo,
  type EscalaSvo,
  type EtapaFiltroSvo,
  type IndicadoresSvo,
  type MotoristaSvo,
  type ViaturaSvo,
} from "../../services/svo";
const PAGE_SIZE = 10;
const INDICADORES_VAZIOS: IndicadoresSvo = {
  total: 0,
  emAnalise: 0,
  aguardandoOrdem: 0,
  aprovados: 0,
  recusados: 0,
  coletasEmAndamento: 0,
  viaturasDisponiveis: 0,
  totalViaturas: 0,
};

export function useSvoDados() {
  const [recursos, setRecursos] = useState({
    indicadores: INDICADORES_VAZIOS,
    viaturas: [] as ViaturaSvo[],
    motoristas: [] as MotoristaSvo[],
  });
  const { indicadores, viaturas, motoristas } = recursos;
  const [fila, setFila] = useState({
    chamados: [] as ChamadoSvo[],
    totalRegistros: 0,
    totalPages: 1,
  });
  const { chamados, totalRegistros, totalPages } = fila;
  const [escalasAtuais, setEscalasAtuais] = useState<EscalaSvo[]>([]);

  const [etapa, setEtapa] = useState<EtapaFiltroSvo>("TODOS");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [carregando, setCarregando] = useState(true);
  const [carregandoEscalas, setCarregandoEscalas] = useState(true);

  const [erroPagina, setErroPagina] = useState("");
  const [erroRecursos, setErroRecursos] = useState("");
  const [erroEscalas, setErroEscalas] = useState("");

  // Carrega chamados paginados e filtrados diretamente da API
  useEffect(() => {
    let cancelado = false;

    obterChamadosSvo({
      etapa: etapa === "TODOS" ? undefined : etapa,
      busca: busca.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((resposta) => {
        if (cancelado) return;
        setFila({
          chamados: resposta.data,
          totalRegistros: resposta.meta.total,
          totalPages: Math.max(1, resposta.meta.totalPages),
        });
        if (page > Math.max(1, resposta.meta.totalPages)) {
          setPage(Math.max(1, resposta.meta.totalPages));
        }
        setErroPagina("");
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        setErroPagina(
          extrairErroSvo(
            erro,
            "Não foi possível carregar os chamados do SVO. Verifique sua conexão e tente novamente.",
          ),
        );
      })
      .finally(() => {
        if (!cancelado) {
          setCarregando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [etapa, busca, page, reloadTick]);

  // Carrega indicadores, viaturas SVO e motoristas disponíveis
  useEffect(() => {
    let cancelado = false;

    Promise.all([obterIndicadoresSvo(), obterViaturasSvo(), obterMotoristasSvo()])
      .then(([ind, listaViaturas, listaMotoristas]) => {
        if (cancelado) return;
        setRecursos({ indicadores: ind, viaturas: listaViaturas, motoristas: listaMotoristas });
        setErroRecursos("");
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        setErroRecursos(
          extrairErroSvo(erro, "Não foi possível atualizar os indicadores e viaturas do SVO."),
        );
      });

    return () => {
      cancelado = true;
    };
  }, [reloadTick]);

  useEffect(() => {
    let cancelado = false;

    obterEscalasEmAndamentoSvo()
      .then((lista) => {
        if (cancelado) return;
        setEscalasAtuais(lista);
        setErroEscalas("");
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        setErroEscalas(extrairErroSvo(erro, "Não foi possível carregar as escalas do plantão."));
      })
      .finally(() => {
        if (!cancelado) setCarregandoEscalas(false);
      });

    return () => {
      cancelado = true;
    };
  }, [reloadTick]);

  const dispararRecarregamento = (novaPagina?: number) => {
    setCarregando(true);
    setCarregandoEscalas(true);
    if (novaPagina !== undefined) {
      setPage(novaPagina);
    }
    setReloadTick((atual) => atual + 1);
  };

  const handleFiltroChange = (novaEtapa: EtapaFiltroSvo) => {
    if (novaEtapa === etapa && page === 1) return;
    setCarregando(true);
    setEtapa(novaEtapa);
    setPage(1);
  };

  const handleBuscaChange = (valor: string) => {
    setCarregando(true);
    setBusca(valor);
    setPage(1);
  };

  const limparFiltros = () => {
    setCarregando(true);
    setBusca("");
    setEtapa("TODOS");
    setPage(1);
  };
  const mudarPagina = (pagina: number) => {
    setCarregando(true);
    setPage(Math.max(1, Math.min(totalPages, pagina)));
  };
  return {
    indicadores,
    chamados,
    escalasAtuais,
    viaturas,
    motoristas,
    etapa,
    busca,
    page,
    totalRegistros,
    totalPages,
    carregando,
    carregandoEscalas,
    erroPagina,
    erroRecursos,
    erroEscalas,
    setErroPagina,
    setErroRecursos,
    dispararRecarregamento,
    handleFiltroChange,
    handleBuscaChange,
    limparFiltros,
    mudarPagina,
  };
}
