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
        setErrorMessage("Ocorreu um erro ao tentar acessar. Verifique suas credenciais.");
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#F8FAFC] font-sans text-slate-900">
      {/* Lado Esquerdo: Fotografia Real da Frota FSPH */}
      <div className="relative hidden md:block md:w-1/2 lg:w-7/12 min-h-screen bg-slate-900 overflow-hidden select-none">
        <img
          src={bgLogin}
          alt="Frota de Veículos FSPH"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex items-end p-10 lg:p-14">
          <div className="text-white max-w-md">
            <span className="px-3 py-1 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-300 text-xs font-bold uppercase tracking-wider inline-block mb-3">
              ROTA · FSPH
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de Frota e SVO
            </h2>
            <p className="text-sm text-slate-300 mt-1 font-medium">
              Fundação de Saúde Parreiras Horta
            </p>
          </div>
        </div>
      </div>

      {/* Lado Direito: Card Limpo e Direto de Login */}
      <div className="flex-1 min-h-screen flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-[#F8FAFC]">
        <div className="w-full max-w-[420px] bg-white rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 border border-slate-200/80 flex flex-col items-center text-center">
          {/* Logo Oficial ROTA */}
          <div className="mb-6 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 p-2.5 flex items-center justify-center shadow-md shadow-blue-500/10 mb-3 ring-4 ring-blue-50/70">
              <img src={rotaSymbol} alt="Rota FSPH" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                ROTA
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                FSPH
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase mt-1">
              Gestão de Frota e SVO
            </span>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-6">
            Acessar o sistema
          </h1>

          {/* Alerta de Erro */}
          {errorMessage && (
            <div className="w-full mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs text-left animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulário Limpo */}
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

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full py-3.5 text-sm font-bold rounded-2xl shadow-md bg-slate-900 hover:bg-black text-white"
                isLoading={isSubmitting}
              >
                Acessar
              </Button>
            </div>
          </form>

          {/* Link para recuperação de conta */}
          <div className="mt-8 pt-4">
            <button
              type="button"
              onClick={onNavigateToForgot}
              className="text-xs text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Está com problemas para acessar o sistema?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
