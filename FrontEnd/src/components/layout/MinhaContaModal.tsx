import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Badge, Button, Input, Modal } from "../common";
import { alterarMinhaSenhaApi } from "../../services/perfilService";
import { ROTULOS_PERFIL, type User } from "../../types/auth";

const TAMANHO_MINIMO_NOVA_SENHA = 8;
const BYTES_MAXIMOS_BCRYPT = 72;

export interface MinhaContaModalProps {
  isOpen: boolean;
  usuario: User | null;
  onClose: () => void;
}

export const MinhaContaModal: React.FC<MinhaContaModalProps> = ({ isOpen, usuario, onClose }) => {
  if (!isOpen || !usuario) return null;

  return <ConteudoMinhaContaModal key={usuario.id} usuario={usuario} onClose={onClose} />;
};

interface ConteudoProps {
  usuario: User;
  onClose: () => void;
}

const ConteudoMinhaContaModal: React.FC<ConteudoProps> = ({ usuario, onClose }) => {
  const formId = "form-minha-conta-alterar-senha";
  const inicial = usuario.nome ? usuario.nome.charAt(0).toUpperCase() : "?";

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");

  const [erroSenhaAtual, setErroSenhaAtual] = useState<string | null>(null);
  const [erroNovaSenha, setErroNovaSenha] = useState<string | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const salvando = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const fechar = () => {
    if (!salvando.current) onClose();
  };

  async function submeter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando.current) return;

    setErroSenhaAtual(null);
    setErroNovaSenha(null);
    setErroConfirmacao(null);
    setErroGeral(null);
    setMensagemSucesso(null);

    if (!senhaAtual) {
      setErroSenhaAtual("Informe sua senha atual.");
      return;
    }

    if (!novaSenha.trim() || Array.from(novaSenha).length < TAMANHO_MINIMO_NOVA_SENHA) {
      setErroNovaSenha(
        `A nova senha deve possuir pelo menos ${TAMANHO_MINIMO_NOVA_SENHA} caracteres.`,
      );
      return;
    }

    if (new TextEncoder().encode(novaSenha).length > BYTES_MAXIMOS_BCRYPT) {
      setErroNovaSenha("A nova senha deve ter no máximo 72 bytes.");
      return;
    }

    if (novaSenha === senhaAtual) {
      setErroNovaSenha("A nova senha deve ser diferente da senha atual.");
      return;
    }

    if (confirmacaoSenha !== novaSenha) {
      setErroConfirmacao("A confirmação não coincide com a nova senha.");
      return;
    }

    salvando.current = true;
    setEnviando(true);
    try {
      const resposta = await alterarMinhaSenhaApi({ senhaAtual, novaSenha });
      if (!montado.current) return;
      salvando.current = false;
      setEnviando(false);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacaoSenha("");
      setMensagemSucesso(
        resposta.mensagem || "Senha alterada com sucesso. Outras sessões ativas foram encerradas.",
      );
    } catch (error: unknown) {
      if (!montado.current) return;
      salvando.current = false;
      setEnviando(false);
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível alterar a senha.";
      if (/senha atual/i.test(mensagem)) {
        setErroSenhaAtual(mensagem);
      } else {
        setErroGeral(mensagem);
      }
    }
  }

  return (
    <Modal
      isOpen
      onClose={fechar}
      size="md"
      title="Minha Conta"
      description="Consulte os dados do seu perfil institucional e atualize sua senha de acesso."
      footer={
        <>
          <Button type="button" variant="outline" onClick={fechar} disabled={enviando}>
            Fechar
          </Button>
          <Button type="submit" form={formId} variant="primary" isLoading={enviando}>
            Salvar nova senha
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Resumo do Perfil */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white">
              {inicial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{usuario.nome}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-600">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{usuario.email}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-2.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 mr-1">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              Perfis:
            </span>
            {usuario.roles.map((role) => (
              <Badge key={role} variant="info">
                {ROTULOS_PERFIL[role] || role}
              </Badge>
            ))}
          </div>
        </div>

        {/* Formulário de Troca de Senha */}
        <form id={formId} onSubmit={submeter} noValidate className="space-y-3.5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Alterar senha</h3>
          </div>

          <Input
            id="conta-senha-atual"
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            required
            disabled={enviando}
            placeholder="Digite sua senha atual"
            value={senhaAtual}
            onChange={(event) => {
              setSenhaAtual(event.target.value);
              if (erroSenhaAtual) setErroSenhaAtual(null);
              if (mensagemSucesso) setMensagemSucesso(null);
            }}
            error={erroSenhaAtual ?? undefined}
          />

          <Input
            id="conta-nova-senha"
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            required
            disabled={enviando}
            placeholder="Mínimo de 8 caracteres"
            helperText="Ao alterar a senha, outras sessões abertas em outros dispositivos serão encerradas."
            value={novaSenha}
            onChange={(event) => {
              setNovaSenha(event.target.value);
              if (erroNovaSenha) setErroNovaSenha(null);
              if (mensagemSucesso) setMensagemSucesso(null);
            }}
            error={erroNovaSenha ?? undefined}
          />

          <Input
            id="conta-confirmar-senha"
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            required
            disabled={enviando}
            placeholder="Repita a nova senha"
            value={confirmacaoSenha}
            onChange={(event) => {
              setConfirmacaoSenha(event.target.value);
              if (erroConfirmacao) setErroConfirmacao(null);
              if (mensagemSucesso) setMensagemSucesso(null);
            }}
            error={erroConfirmacao ?? undefined}
          />

          {erroGeral && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
            >
              {erroGeral}
            </p>
          )}

          {mensagemSucesso && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{mensagemSucesso}</span>
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
};
