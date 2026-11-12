import { useEffect, useState } from "react";

// Atualiza sem interromper a leitura; ao retornar ao app, consulta imediatamente.
export function useAtualizacaoAutomatica(intervaloMs = 15_000) {
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible") setRevisao((valor) => valor + 1);
    };
    const id = window.setInterval(atualizar, intervaloMs);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [intervaloMs]);
  return revisao;
}
