import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User as UserIcon, Key, AlertCircle } from "lucide-react";
import { useAuth } from "../../contexts/auth";
import { Input, Button } from "../../components/common";
import bgLogin from "../../assets/BG.png";
import rotaSymbol from "../../assets/branding/rota/rota-symbol-color.svg";

const loginSchema = z.object({
  usuario: z.string().trim().email("Informe um e-mail válido."),
  senha: z.string().min(6, "A senha deve possuir pelo menos 6 caracteres."),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginPageProps {
  onNavigateToForgot?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToForgot }) => {
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      usuario: "",
      senha: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setErrorMessage(null);
      await login(data);
    } catch (err) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Não foi possível entrar no sistema. Tente novamente.");
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#F6F7F9] font-sans text-slate-900">
      {/* Lado Esquerdo: Fotografia Real da Frota FSPH */}
      <div className="relative hidden md:block md:w-1/2 lg:w-7/12 min-h-screen bg-slate-900 overflow-hidden select-none">
        <img
          src={bgLogin}
          alt="Frota de Veículos FSPH"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent flex items-end p-10 lg:p-14">
          <div className="text-white max-w-md border-l-2 border-white/40 pl-4">
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-slate-300 block mb-1">
              ROTA · FSPH
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Gestão de Frota e SVO</h2>
            <p className="text-sm text-slate-300 mt-1">Fundação de Saúde Parreiras Horta</p>
          </div>
        </div>
      </div>

      {/* Lado Direito: Formulário Institucional de Acesso */}
      <div className="flex-1 min-h-screen flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-[#F6F7F9]">
        <div className="w-full max-w-[400px] bg-white rounded-xl p-7 sm:p-9 border border-slate-200 shadow-xs flex flex-col">
          {/* Identificação Institucional ROTA */}
          <div className="mb-6 flex items-center gap-3 pb-5 border-b border-slate-200">
            <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 p-2 flex items-center justify-center shrink-0">
              <img src={rotaSymbol} alt="Rota FSPH" className="w-full h-full object-contain" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold tracking-tight text-slate-900 leading-none">
                  ROTA
                </span>
                <span className="font-mono text-xs font-semibold text-slate-500">· FSPH</span>
              </div>
              <span className="block text-xs text-slate-500 mt-1">Gestão de Frota e SVO</span>
            </div>
          </div>

          <h1 className="text-lg font-bold tracking-tight text-slate-900 mb-5 text-left">
            Acessar o sistema
          </h1>

          {/* Alerta de Erro */}
          {errorMessage && (
            <div
              role="alert"
              className="w-full mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs text-left"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-4 text-left">
            <Input
              label="E-mail"
              placeholder="nome@fsph.se.gov.br"
              type="email"
              leftIcon={<UserIcon className="w-4 h-4 text-slate-400" />}
              error={errors.usuario?.message}
              {...register("usuario")}
              autoComplete="username"
            />

            <Input
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              leftIcon={<Key className="w-4 h-4 text-slate-400" />}
              error={errors.senha?.message}
              {...register("senha")}
              autoComplete="current-password"
            />

            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
              >
                Acessar
              </Button>
            </div>
          </form>

          {/* Link para recuperação de conta */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onNavigateToForgot}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Está com problemas para acessar o sistema?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
