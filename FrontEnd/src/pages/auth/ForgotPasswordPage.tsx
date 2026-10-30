import React from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "../../components/common";
import rotaSymbol from "../../assets/branding/rota/rota-symbol-color.svg";

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F9FA] p-6 font-sans">
    <div className="flex w-full max-w-[440px] flex-col items-center rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/50 sm:p-10">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2.5 shadow-md shadow-blue-500/10">
        <img src={rotaSymbol} alt="Rota FSPH" className="h-full w-full object-contain" />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">Recuperação de senha</h1>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <Mail className="h-5 w-5" />
      </div>
      <p className="mb-8 max-w-xs text-sm text-slate-600">
        A recuperação automática de senha ainda não está disponível. Entre em contato com o suporte
        da FSPH para redefinir seu acesso.
      </p>
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full justify-center rounded-2xl bg-slate-900 py-3.5 text-white hover:bg-black"
        onClick={onBackToLogin}
        leftIcon={<ArrowLeft className="h-4 w-4" />}
      >
        Voltar para o login
      </Button>
    </div>
  </div>
);
