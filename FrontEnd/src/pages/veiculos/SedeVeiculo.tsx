import { useEffect, useState } from "react";
import { Button, Input, Select } from "../../components/common";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../contexts/auth";
export interface Sede {
  id: string;
  nome: string;
  ativo: boolean;
}
export function SedeVeiculo({
  veiculo,
  onAtualizado,
  somenteGestao,
}: {
  veiculo: {
    id: string;
    sedeId?: string | null;
    foraDeSede?: boolean;
    sedeAtualizadaEm?: string | null;
    status: string;
  };
  onAtualizado: () => void;
  somenteGestao?: boolean;
}) {
  const { user } = useAuth();
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [valor, setValor] = useState(veiculo.foraDeSede ? "FORA_DE_SEDE" : (veiculo.sedeId ?? ""));
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const carregar = async () => {
    const r = await apiRequest<{ data: Sede[] }>("/sedes", {});
    setSedes(r.data);
  };
  useEffect(() => {
    let ativo = true;
    void apiRequest<{ data: Sede[] }>("/sedes", {})
      .then((r) => {
        if (ativo) setSedes(r.data);
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      });
    return () => {
      ativo = false;
    };
  }, []);
  const executar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro("");
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="space-y-4">
      {!somenteGestao && (
        <>
          {" "}
          <p>Status operacional: {veiculo.status}</p>
          <p>
            Última atualização da sede:{" "}
            {veiculo.sedeAtualizadaEm
              ? new Date(veiculo.sedeAtualizadaEm).toLocaleString("pt-BR")
              : "Sem registro"}
          </p>
          <Select
            label="Sede atual"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            options={[
              { value: "", label: "Sede não informada" },
              { value: "FORA_DE_SEDE", label: "Fora de sede" },
              ...sedes
                .filter((s) => s.ativo || s.id === veiculo.sedeId)
                .map((s) => ({ value: s.id, label: s.nome + (s.ativo ? "" : " (inativa)") })),
            ]}
          />
          <Button
            disabled={ocupado}
            onClick={() =>
              void executar(async () => {
                await apiRequest(`/veiculos/${veiculo.id}`, {
                  method: "PATCH",
                  data: {
                    sedeId: valor && valor !== "FORA_DE_SEDE" ? valor : null,
                    foraDeSede: valor === "FORA_DE_SEDE",
                  },
                });
                onAtualizado();
              })
            }
          >
            Salvar sede
          </Button>
        </>
      )}
      {user?.roles.includes("ADMIN") && (
        <fieldset disabled={ocupado} className="space-y-3">
          <legend>Gerenciar sedes</legend>
          <Input
            label="Nome da nova sede"
            value={nome}
            maxLength={150}
            onChange={(e) => setNome(e.target.value)}
          />
          <Button
            disabled={nome.trim().length < 2}
            onClick={() =>
              void executar(async () => {
                await apiRequest("/sedes", { method: "POST", data: { nome } });
                setNome("");
                await carregar();
                onAtualizado();
              })
            }
          >
            Cadastrar sede
          </Button>
          {sedes.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2">
              <span>
                {s.nome}
                {!s.ativo && " (inativa)"}
              </span>
              <Button
                onClick={() =>
                  void executar(async () => {
                    await apiRequest(`/sedes/${s.id}`, {
                      method: "PATCH",
                      data: { ativo: !s.ativo },
                    });
                    await carregar();
                    onAtualizado();
                  })
                }
              >
                {s.ativo ? "Inativar" : "Reativar"}
              </Button>
            </div>
          ))}
        </fieldset>
      )}
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}

export function GerenciarSedes({ onAtualizado }: { onAtualizado: () => void }) {
  return <SedeVeiculo veiculo={{ id: "", status: "" }} somenteGestao onAtualizado={onAtualizado} />;
}
