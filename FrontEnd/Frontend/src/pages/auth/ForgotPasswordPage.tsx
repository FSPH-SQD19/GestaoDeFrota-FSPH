import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Input, Button } from '../../components/common'
import rotaSymbol from '../../assets/branding/rota/rota-symbol-color.svg'

const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu e-mail institucional.')
    .email('Formato de e-mail inválido (ex: nome@fsph.se.gov.br).'),
})

type ForgotFormData = z.infer<typeof forgotSchema>

interface ForgotPasswordPageProps {
  onBackToLogin: () => void
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => {
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotFormData) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    setSubmittedEmail(data.email)
    setIsSuccess(true)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#F8F9FA] font-sans">
      <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center">
        {/* Logo Oficial ROTA */}
        <div className="mb-6 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 p-2 flex items-center justify-center shadow-md mb-2.5">
            <img
              src={rotaSymbol}
              alt="Rota FSPH"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 leading-none">
            ROTA
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
          Recuperação de Senha
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mb-8 max-w-xs">
          {isSuccess
            ? 'Instruções enviadas com sucesso'
            : 'Informe seu e-mail cadastrado para redefinir o acesso.'}
        </p>

        {isSuccess ? (
          <div className="space-y-6 w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 text-left leading-relaxed">
              Enviamos um link de recuperação temporário para:
              <span className="block font-semibold text-slate-900 mt-1">{submittedEmail}</span>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full justify-center bg-slate-900 hover:bg-black text-white rounded-2xl py-3.5"
              onClick={onBackToLogin}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Voltar para o login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 w-full text-left">
            <Input
              label="E-mail Institucional"
              type="email"
              placeholder="seu.email@fsph.se.gov.br"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              error={errors.email?.message}
              {...register('email')}
              helperText="Você receberá um link seguro para cadastrar uma nova senha."
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center bg-slate-900 hover:bg-black text-white rounded-2xl py-3.5"
              isLoading={isSubmitting}
            >
              Enviar link de recuperação
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onBackToLogin}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retornar para a tela de login</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
