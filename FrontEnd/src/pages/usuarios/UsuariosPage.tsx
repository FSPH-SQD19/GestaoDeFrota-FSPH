import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundX,
} from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select, Table } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";
import {
  atualizarUsuarioApi,
  criarUsuarioApi,
  inativarUsuarioApi,
  listarUsuariosApi,
  obterUsuarioApi,
  type AtualizarUsuarioInput,
  type CriarUsuarioInput,
  type UsuarioAdministrado,
} from "../../services/usuariosService";
import { redefinirSenhaUsuarioApi } from "../../services/perfilService";
import type { PerfilAutenticadoResponse } from "../../types/usuario";

const PERFIS = ["ADMIN", "GESTOR", "MOTORISTA", "SVO", "SOLICITANTE"] as const;
type PerfilUsuario = (typeof PERFIS)[number];
const PERFIS_GESTAO_USUARIOS = ["ADMIN", "GESTOR", "SVO", "SOLICITANTE"] as const;
const isPerfilUsuario = (value: string): value is PerfilUsuario =>
  PERFIS.some((perfil) => perfil === value);
const normalizarPerfil = (value: string): PerfilUsuario | null => {
  if (value === "ATENDENTE_SVO") return "SVO";
  return isPerfilUsuario(value) ? value : null;
};
type AcaoModal =
  | { tipo: "formulario"; usuario: UsuarioAdministrado | null }
  | { tipo: "detalhes"; usuario: UsuarioAdministrado }
  | { tipo: "status"; usuario: UsuarioAdministrado }
  | { tipo: "senha"; usuario: UsuarioAdministrado };

const PERFIL_LABEL: Record<PerfilUsuario, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  MOTORISTA: "Motorista",
  SVO: "Atendente SVO",
  SOLICITANTE: "Solicitante",
};
const rotuloPerfil = (value: string) => {
  const perfil = normalizarPerfil(value);
  return perfil ? PERFIL_LABEL[perfil] : value;
};

const PAGE_SIZE = 20;
const FORMULARIO_VAZIO = {
  nome: "",
  email: "",
  senha: "",
  telefone: "",
  setor: "",
  perfis: [] as PerfilUsuario[],
};

const mensagemErro = (erro: unknown, fallback: string) =>
  erro instanceof Error ? erro.message : fallback;

const formatarData = (data: string) => {
  const parsed = new Date(data);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(parsed);
};

export const UsuariosPage: React.FC = () => {
  const { user, sessionKey } = useAuth();
  const administrador = user?.roles.includes("ADMIN") ?? false;
  const [perfilAtual, setPerfilAtual] = useState<{
    sessionKey: string | null;
    confirmado: boolean;
    erro: string;
  } | null>(null);
  const [pagina, setPagina] = useState(1);
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [revisaoPerfil, setRevisaoPerfil] = useState(0);
  const [resultado, setResultado] = useState<{
    sessionKey: string | null;
    pagina: number;
    chave: string;
    dados: UsuarioAdministrado[];
    total: number;
    totalPages: number;
    erro: string;
  } | null>(null);
  const [acaoModal, setAcaoModal] = useState<AcaoModal | null>(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [novaSenha, setNovaSenha] = useState("");
  const [erroAcao, setErroAcao] = useState("");
  const [erroDetalhe, setErroDetalhe] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!administrador) return;
    let ativo = true;
    void apiRequest<PerfilAutenticadoResponse>("/auth/perfil", {})
      .then(({ usuario }) => {
        if (ativo)
          setPerfilAtual({
            sessionKey,
            confirmado: usuario.perfis.includes("ADMIN"),
            erro: "",
          });
      })
      .catch((erro: unknown) => {
        if (ativo)
          setPerfilAtual({
            sessionKey,
            confirmado: false,
            erro: mensagemErro(erro, "Não foi possível verificar seu acesso."),
          });
      });
    return () => {
      ativo = false;
    };
  }, [administrador, revisaoPerfil, sessionKey]);

  const acessoConfirmado =
    administrador && perfilAtual?.sessionKey === sessionKey && perfilAtual.confirmado;
  const chaveConsulta = `${busca}|${perfil}|${filtroAtivo}`;
  const atual =
    resultado?.sessionKey === sessionKey &&
    resultado.pagina === pagina &&
    resultado.chave === chaveConsulta
      ? resultado
      : null;

  useEffect(() => {
    if (!acessoConfirmado) return;
    let vigente = true;
    const status = filtroAtivo === "" ? undefined : filtroAtivo === "true";
    void listarUsuariosApi({
      page: pagina,
      pageSize: PAGE_SIZE,
      ...(busca ? { busca } : {}),
      ...(isPerfilUsuario(perfil) ? { perfil } : {}),
      ...(status === undefined ? {} : { ativo: status }),
    })
      .then((resposta) => {
        if (vigente)
          if (pagina > Math.max(1, resposta.meta.totalPages)) {
            setPagina(Math.max(1, resposta.meta.totalPages));
            return;
          }
        if (vigente)
          setResultado({
            sessionKey,
            pagina,
            chave: chaveConsulta,
            dados: resposta.data,
            total: resposta.meta.total,
            totalPages: resposta.meta.totalPages,
            erro: "",
          });
      })
      .catch((erro: unknown) => {
        if (vigente)
          setResultado({
            sessionKey,
            pagina,
            chave: chaveConsulta,
            dados: [],
            total: 0,
            totalPages: 0,
            erro: mensagemErro(erro, "Não foi possível carregar os usuários."),
          });
      });
    return () => {
      vigente = false;
    };
  }, [acessoConfirmado, busca, chaveConsulta, pagina, perfil, revisao, sessionKey, filtroAtivo]);

  const usuarios = useMemo(() => atual?.dados ?? [], [atual]);
  const totalPages = Math.max(1, atual?.totalPages ?? 1);
  const carregando = acessoConfirmado && !atual;

  const abrirCadastro = () => {
    setFormulario(FORMULARIO_VAZIO);
    setErroAcao("");
    setAcaoModal({ tipo: "formulario", usuario: null });
  };

  const abrirEdicao = (usuario: UsuarioAdministrado) => {
    setFormulario({
      nome: usuario.nome,
      email: usuario.email,
      senha: "",
      telefone: usuario.telefone ?? "",
      setor: usuario.setor ?? "",
      perfis: [
        ...new Set(
          usuario.perfis
            .map(normalizarPerfil)
            .filter(
              (perfil): perfil is PerfilUsuario =>
                perfil !== null && perfil !== "MOTORISTA",
            ),
        ),
      ],
    });
    setErroAcao("");
    setAcaoModal({ tipo: "formulario", usuario });
  };

  const salvarUsuario = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (salvando || !acaoModal || acaoModal.tipo !== "formulario") return;
    setErroAcao("");
    const perfilMotorista = acaoModal.usuario?.perfis.includes("MOTORISTA") ?? false;
    const perfis = [
      ...formulario.perfis,
      ...(perfilMotorista ? (["MOTORISTA"] as const) : []),
    ];
    if (perfis.length === 0) {
      setErroAcao("Selecione ao menos um perfil para o usuário.");
      return;
    }
    if (!acaoModal.usuario && Array.from(formulario.senha).length < 8) {
      setErroAcao("A senha inicial deve possuir pelo menos 8 caracteres.");
      return;
    }
    if (!acaoModal.usuario && new TextEncoder().encode(formulario.senha).length > 72) {
      setErroAcao("A senha é muito longa. Use uma senha mais curta.");
      return;
    }
    const dados: AtualizarUsuarioInput = {
      nome: formulario.nome.trim(),
      email: formulario.email.trim().toLowerCase(),
      telefone: formulario.telefone.trim() || null,
      setor: formulario.setor.trim() || null,
      perfis,
    };
    setSalvando(true);
    try {
      if (acaoModal.usuario) await atualizarUsuarioApi(acaoModal.usuario.id, dados);
      else await criarUsuarioApi({ ...dados, senha: formulario.senha } satisfies CriarUsuarioInput);
      setMensagemSucesso(
        acaoModal.usuario ? "Usuário atualizado com sucesso." : "Usuário cadastrado com sucesso.",
      );
      setAcaoModal(null);
      setRevisao((valor) => valor + 1);
    } catch (erro) {
      setErroAcao(mensagemErro(erro, "Não foi possível salvar o usuário."));
    } finally {
      setSalvando(false);
    }
  };

  const confirmarStatus = async () => {
    if (salvando || !acaoModal || acaoModal.tipo !== "status") return;
    setSalvando(true);
    setErroAcao("");
    try {
      await inativarUsuarioApi(acaoModal.usuario.id, !acaoModal.usuario.ativo);
      setMensagemSucesso(
        acaoModal.usuario.ativo ? "Usuário inativado." : "Usuário reativado.",
      );
      setAcaoModal(null);
      setRevisao((valor) => valor + 1);
    } catch (erro) {
      setErroAcao(mensagemErro(erro, "Não foi possível atualizar o status do usuário."));
    } finally {
      setSalvando(false);
    }
  };

  const redefinirSenha = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (salvando || !acaoModal || acaoModal.tipo !== "senha") return;
    setErroAcao("");
    if (Array.from(novaSenha).length < 8) {
      setErroAcao("A nova senha deve possuir pelo menos 8 caracteres.");
      return;
    }
    if (new TextEncoder().encode(novaSenha).length > 72) {
      setErroAcao("A senha é muito longa. Use uma senha mais curta.");
      return;
    }
    setSalvando(true);
    try {
      await redefinirSenhaUsuarioApi(acaoModal.usuario.id, { novaSenha });
      setMensagemSucesso("Senha redefinida com sucesso. As sessões do usuário foram encerradas.");
      setAcaoModal(null);
      setNovaSenha("");
    } catch (erro) {
      setErroAcao(mensagemErro(erro, "Não foi possível redefinir a senha."));
    } finally {
      setSalvando(false);
    }
  };

  const abrirDetalhes = async (usuario: UsuarioAdministrado) => {
    setErroDetalhe("");
    setAcaoModal({ tipo: "detalhes", usuario });
    try {
      const atualizado = await obterUsuarioApi(usuario.id);
      setAcaoModal((atual) =>
        atual?.tipo === "detalhes" && atual.usuario.id === usuario.id
          ? { tipo: "detalhes", usuario: atualizado }
          : atual,
      );
    } catch (erro) {
      setErroDetalhe(mensagemErro(erro, "Não foi possível carregar os detalhes do usuário."));
    }
  };

  const colunas: Column<UsuarioAdministrado>[] = [
    {
      header: "Usuário",
      render: (usuario) => (
        <div className="min-w-52">
          <p className="font-semibold text-slate-900">{usuario.nome}</p>
          <p className="mt-0.5 text-xs text-slate-500">{usuario.email}</p>
        </div>
      ),
    },
    {
      header: "Setor",
      render: (usuario) => usuario.setor || <span className="text-slate-400">—</span>,
    },
    {
      header: "Perfis",
      render: (usuario) => (
        <div className="flex flex-wrap gap-1">
          {usuario.perfis.map((item) => (
            <Badge key={item} size="sm">
              {rotuloPerfil(item)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      header: "Status",
      render: (usuario) => (
        <Badge variant={usuario.ativo ? "success" : "neutral"} dot>
          {usuario.ativo ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      header: "Cadastro",
      render: (usuario) => formatarData(usuario.criadoEm),
    },
    {
      header: "Ações",
      className: "min-w-52",
      render: (usuario) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            aria-label={`Ver detalhes de ${usuario.nome}`}
            title="Ver detalhes"
            onClick={() => void abrirDetalhes(usuario)}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            aria-label={`Editar ${usuario.nome}`}
            title="Editar usuário"
            onClick={() => abrirEdicao(usuario)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            aria-label={`Redefinir senha de ${usuario.nome}`}
            title="Redefinir senha"
            onClick={() => {
              setNovaSenha("");
              setErroAcao("");
              setAcaoModal({ tipo: "senha", usuario });
            }}
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={
              usuario.ativo
                ? "rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                : "rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            }
            aria-label={`${usuario.ativo ? "Inativar" : "Reativar"} ${usuario.nome}`}
            title={usuario.ativo ? "Inativar usuário" : "Reativar usuário"}
            onClick={() => {
              setErroAcao("");
              setAcaoModal({ tipo: "status", usuario });
            }}
          >
            {usuario.ativo ? (
              <UserRoundX className="h-4 w-4" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
          </button>
        </div>
      ),
    },
  ];

  if (!administrador) {
    return (
      <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Acesso restrito a administradores.
      </p>
    );
  }

  if (!perfilAtual || perfilAtual.sessionKey !== sessionKey) {
    return (
      <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Verificando seu acesso...
      </p>
    );
  }

  if (!perfilAtual.confirmado) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
      >
        <span>{perfilAtual.erro || "Acesso restrito a administradores."}</span>
        {perfilAtual.erro && (
          <Button variant="outline" size="sm" onClick={() => setRevisaoPerfil((valor) => valor + 1)}>
            Verificar novamente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6 fade-in duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Usuários
          </h1>
          <p className="mt-1 text-sm text-slate-500">Gerencie contas, perfis e acessos ao sistema.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={abrirCadastro}>
          Novo usuário
        </Button>
      </div>

      {atual?.erro && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          <span>{atual.erro}</span>
          <Button variant="outline" size="sm" onClick={() => setRevisao((valor) => valor + 1)}>
            Tentar novamente
          </Button>
        </div>
      )}
      {mensagemSucesso && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {mensagemSucesso}
        </p>
      )}

      <Card className="space-y-4 p-4 sm:p-5">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_10rem_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setPagina(1);
            setBusca(termo.trim());
            setMensagemSucesso("");
          }}
        >
          <Input
            label="Buscar usuário"
            placeholder="Nome, e-mail ou setor"
            value={termo}
            onChange={(event) => setTermo(event.target.value)}
          />
          <Select
            label="Perfil"
            value={perfil}
            onChange={(event) => {
              setPerfil(event.target.value);
              setPagina(1);
            }}
            options={[
              { value: "", label: "Todos os perfis" },
              ...PERFIS.map((item) => ({ value: item, label: PERFIL_LABEL[item] })),
            ]}
          />
          <Select
            label="Status"
            value={filtroAtivo}
            onChange={(event) => {
              setFiltroAtivo(event.target.value);
              setPagina(1);
            }}
            options={[
              { value: "", label: "Todos" },
              { value: "true", label: "Ativos" },
              { value: "false", label: "Inativos" },
            ]}
          />
          <Button type="submit" className="self-end" leftIcon={<Search className="h-4 w-4" />}>
            Buscar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => {
              setTermo("");
              setBusca("");
              setPerfil("");
              setFiltroAtivo("");
              setPagina(1);
              setMensagemSucesso("");
              setRevisao((valor) => valor + 1);
            }}
          >
            Limpar
          </Button>
        </form>

        <Table
          columns={colunas}
          data={usuarios}
          keyExtractor={(usuario) => usuario.id}
          emptyMessage="Nenhum usuário encontrado."
          isLoading={carregando}
        />
        {atual && !atual.erro && (
          <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Página {pagina} de {totalPages} · {atual.total} usuário(s)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || carregando}
                onClick={() => setPagina((valor) => Math.max(1, valor - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= totalPages || carregando}
                onClick={() => setPagina((valor) => Math.min(totalPages, valor + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="flex items-center gap-3 p-4 text-sm text-slate-600">
        <ShieldCheck className="h-5 w-5 shrink-0 text-slate-500" />
        Alterações de perfil e status são aplicadas pela API; inativar uma conta encerra suas sessões.
      </Card>

      <Modal
        isOpen={acaoModal?.tipo === "detalhes"}
        onClose={() => setAcaoModal(null)}
        title="Detalhes do usuário"
        description="Informações atualizadas da conta."
        footer={
          <Button variant="outline" onClick={() => setAcaoModal(null)}>
            Fechar
          </Button>
        }
      >
        {acaoModal?.tipo === "detalhes" && (
          <>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Nome</dt>
                <dd className="mt-1 font-medium text-slate-900">{acaoModal.usuario.nome}</dd>
              </div>
              <div>
                <dt className="text-slate-500">E-mail</dt>
                <dd className="mt-1 break-all font-medium text-slate-900">{acaoModal.usuario.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Telefone</dt>
                <dd className="mt-1 font-medium text-slate-900">{acaoModal.usuario.telefone || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Setor</dt>
                <dd className="mt-1 font-medium text-slate-900">{acaoModal.usuario.setor || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Perfis</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {acaoModal.usuario.perfis
                    .map(rotuloPerfil)
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {acaoModal.usuario.ativo ? "Ativo" : "Inativo"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Identificador</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                  {acaoModal.usuario.id}
                </dd>
              </div>
            </dl>
            {erroDetalhe && (
              <p role="alert" className="mt-4 text-sm text-rose-700">
                {erroDetalhe}
              </p>
            )}
          </>
        )}
      </Modal>

      <Modal
        isOpen={acaoModal?.tipo === "formulario"}
        onClose={() => !salvando && setAcaoModal(null)}
        title={acaoModal?.tipo === "formulario" && acaoModal.usuario ? "Editar usuário" : "Novo usuário"}
        description="Preencha os dados e selecione ao menos um perfil de acesso."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAcaoModal(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" form="formulario-usuario" isLoading={salvando}>
              Salvar usuário
            </Button>
          </>
        }
      >
        <form id="formulario-usuario" className="space-y-4" onSubmit={salvarUsuario}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome"
              required
              minLength={2}
              maxLength={150}
              value={formulario.nome}
              onChange={(event) => setFormulario({ ...formulario, nome: event.target.value })}
            />
            <Input
              label="E-mail"
              type="email"
              required
              maxLength={150}
              value={formulario.email}
              onChange={(event) => setFormulario({ ...formulario, email: event.target.value })}
            />
            {acaoModal?.tipo === "formulario" && !acaoModal.usuario && (
              <Input
                label="Senha inicial"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={formulario.senha}
                onChange={(event) => setFormulario({ ...formulario, senha: event.target.value })}
              />
            )}
            <Input
              label="Telefone"
              type="tel"
              maxLength={20}
              placeholder="(79) 99999-9999"
              value={formulario.telefone}
              onChange={(event) => setFormulario({ ...formulario, telefone: event.target.value })}
            />
            <Input
              label="Setor"
              maxLength={100}
              value={formulario.setor}
              onChange={(event) => setFormulario({ ...formulario, setor: event.target.value })}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-800">Perfis de acesso *</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PERFIS_GESTAO_USUARIOS.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formulario.perfis.includes(item)}
                    onChange={(event) =>
                      setFormulario({
                        ...formulario,
                        perfis: event.target.checked
                          ? [...formulario.perfis, item]
                          : formulario.perfis.filter((perfilSelecionado) => perfilSelecionado !== item),
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                  />
                  {PERFIL_LABEL[item]}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              O perfil Motorista é atribuído somente ao cadastrar o motorista na Gestão de
              Motoristas.
              {acaoModal?.tipo === "formulario" &&
                acaoModal.usuario?.perfis.includes("MOTORISTA") &&
                " O acesso de motorista desta conta será mantido."}
            </p>
          </fieldset>
          {erroAcao && <p role="alert" className="text-sm text-rose-700">{erroAcao}</p>}
        </form>
      </Modal>

      <Modal
        isOpen={acaoModal?.tipo === "status"}
        onClose={() => !salvando && setAcaoModal(null)}
        title={acaoModal?.tipo === "status" && acaoModal.usuario.ativo ? "Inativar usuário" : "Reativar usuário"}
        description={
          acaoModal?.tipo === "status" && acaoModal.usuario.ativo
            ? `A conta de ${acaoModal.usuario.nome} será inativada e as sessões atuais serão encerradas.`
            : `A conta de ${acaoModal?.tipo === "status" ? acaoModal.usuario.nome : ""} poderá voltar a acessar o sistema.`
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setAcaoModal(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              variant={acaoModal?.tipo === "status" && acaoModal.usuario.ativo ? "danger" : "primary"}
              onClick={() => void confirmarStatus()}
              isLoading={salvando}
            >
              Confirmar
            </Button>
          </>
        }
      >
        {erroAcao && <p role="alert" className="text-sm text-rose-700">{erroAcao}</p>}
      </Modal>

      <Modal
        isOpen={acaoModal?.tipo === "senha"}
        onClose={() => {
          if (!salvando) {
            setAcaoModal(null);
            setNovaSenha("");
          }
        }}
        title="Redefinir senha"
        description={`Informe uma nova senha para ${acaoModal?.tipo === "senha" ? acaoModal.usuario.nome : "o usuário"}. As sessões existentes serão encerradas.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAcaoModal(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" form="formulario-senha" isLoading={salvando}>
              Redefinir senha
            </Button>
          </>
        }
      >
        <form id="formulario-senha" className="space-y-4" onSubmit={redefinirSenha}>
          <Input
            label="Nova senha"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={novaSenha}
            onChange={(event) => setNovaSenha(event.target.value)}
          />
          {erroAcao && <p role="alert" className="text-sm text-rose-700">{erroAcao}</p>}
        </form>
      </Modal>
    </div>
  );
};
