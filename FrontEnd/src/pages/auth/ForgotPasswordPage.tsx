import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/common";
import rotaSymbol from "../../assets/branding/rota/rota-symbol-color.svg";

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-[#F6F7F9] p-6 font-sans">
    <div className="flex w-full max-w-[400px] flex-col rounded-xl border border-slate-200 bg-white p-7 sm:p-9 shadow-xs text-left">
      <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2 shrink-0">
          <img src={rotaSymbol} alt="Rota FSPH" className="h-full w-full object-contain" />
        </div>
        <div>
          <span className="text-sm font-bold text-slate-900">ROTA · FSPH</span>
          <span className="block text-xs text-slate-500">Gestão de Frota e SVO</span>
        </div>
      </div>

      <h1 className="mb-2 text-lg font-bold tracking-tight text-slate-900">Recuperação de senha</h1>
      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        A recuperação automática de senha ainda não está disponível. Entre em contato com o suporte
        da FSPH para redefinir seu acesso.
      </p>
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full justify-center"
        onClick={onBackToLogin}
        leftIcon={<ArrowLeft className="h-4 w-4" />}
      >
        Voltar para o login
      </Button>
    </div>
  </div>
);
