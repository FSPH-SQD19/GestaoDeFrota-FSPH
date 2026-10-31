import React, { useEffect, useState } from "react";
import { Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, Card } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";
import type { PerfilAutenticadoResponse } from "../../types/usuario";

const PERFIL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  MOTORISTA: "Motorista",
  SVO: "Atendente SVO",
  ATENDENTE_SVO: "Atendente SVO",
  SOLICITANTE: "Solicitante",
};

export const UsuariosPage: React.FC = () => {
  const { user, sessionKey } = useAuth();
  const [hoje] = useState(() => new Date());
  const [tentativa, setTentativa] = useState(0);
  const [resposta, setResposta] = useState<{
    sessionKey: string | null;
    tentativa: number;
    perfil: PerfilAutenticadoResponse["usuario"] | null;
    erro: string;
  } | null>(null);
  const administrador = user?.roles.includes("ADMIN") ?? false;
  const atual =
    resposta?.sessionKey === sessionKey && resposta?.tentativa === tentativa ? resposta : null;
  useEffect(() => {
    if (!administrador) return;
    let ativo = true;
    void apiRequest<PerfilAutenticadoResponse>("/auth/perfil", {})
      .then(({ usuario }) => {
        if (ativo) setResposta({ sessionKey, tentativa, perfil: usuario, erro: "" });
      })
      .catch((error: unknown) => {
        if (ativo)
          setResposta({
            sessionKey,
            tentativa,
            perfil: null,
            erro: error instanceof Error ? error.message : "Não foi possível consultar seu acesso.",
          });
      });
    return () => {
      ativo = false;
    };
  }, [administrador, sessionKey, tentativa]);

  if (!administrador || (atual?.perfil && !atual.perfil.perfis.includes("ADMIN"))) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
      >
        Acesso restrito a administradores.
      </p>
    );
  }
  const data = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(hoje);
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 sm:text-sm">
            {data.charAt(0).toUpperCase() + data.slice(1)}
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Usuários
          </h1>
        </div>
        <Button
          disabled
          leftIcon={<Plus className="h-4 w-4" />}
          aria-describedby="cadastro-indisponivel"
        >
          Novo usuário
        </Button>
      </div>
      <Card className="space-y-3 p-6">
        <h2 className="text-base font-bold text-slate-900">Gestão de usuários indisponível</h2>
        <p id="cadastro-indisponivel" className="text-sm text-slate-600">
          A listagem e o cadastro de usuários ainda não estão disponíveis no sistema. Entre em
          contato com o administrador responsável para solicitar alterações de acesso.
        </p>
      </Card>
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ShieldCheck className="h-5 w-5" />
            Seu acesso
          </h2>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => setTentativa((valor) => valor + 1)}
            disabled={!atual}
          >
            Verificar acesso
          </Button>
        </div>
        {!atual ? (
          <p role="status" className="text-sm text-slate-500">
            Consultando seu acesso...
          </p>
        ) : atual.erro ? (
          <p role="alert" className="text-sm text-rose-700">
            {atual.erro}
          </p>
        ) : atual.perfil ? (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-slate-500">Identificador</dt>
              <dd className="break-all font-medium text-slate-900">{atual.perfil.userId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Perfis da sessão</dt>
              <dd className="font-medium text-slate-900">
                {atual.perfil.perfis.map((perfil) => PERFIL_LABEL[perfil] ?? perfil).join(", ")}
              </dd>
            </div>
          </dl>
        ) : null}
      </Card>
    </div>
  );
};
