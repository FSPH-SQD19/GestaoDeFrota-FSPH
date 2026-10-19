import React from 'react'

interface FsphLogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const FsphLogo: React.FC<FsphLogoProps> = ({
  className = '',
  showText = true,
  size = 'md',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Símbolo estilizado da FSPH (Azul, Âmbar e Vermelho/Coral) */}
      <div className={`relative shrink-0 ${iconSizes[size]}`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xs"
        >
          {/* Lado Azul (Saúde / Gestão) */}
          <path
            d="M16 8C11.5817 8 8 11.5817 8 16V30C8 35.5228 12.4772 40 18 40H22C24.2091 40 26 38.2091 26 36V22C26 17.5817 22.4183 14 18 14H16V8Z"
            fill="url(#blue_grad)"
          />
          {/* Meio Âmbar/Dourado (Transição / Cuidado) */}
          <path
            d="M22 18C22 14.6863 24.6863 12 28 12C31.3137 12 34 14.6863 34 18V26C34 29.3137 31.3137 32 28 32H24V20C24 18.8954 23.1046 18 22 18Z"
            fill="url(#amber_grad)"
          />
          {/* Lado Vermelho/Coral (SVO / Emergência / Vida) */}
          <path
            d="M32 10C29.7909 10 28 11.7909 28 14V16C33.5228 16 38 20.4772 38 26V32C38 36.4183 34.4183 40 30 40H32C37.5228 40 42 35.5228 42 30V20C42 14.4772 37.5228 10 32 10Z"
            fill="url(#coral_grad)"
          />
          <defs>
            <linearGradient id="blue_grad" x1="8" y1="8" x2="26" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1E40AF" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="amber_grad" x1="22" y1="12" x2="34" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#D97706" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="coral_grad" x1="28" y1="10" x2="42" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#E11D48" />
              <stop offset="1" stopColor="#F43F5E" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <span className="font-bold tracking-tight text-slate-900 leading-none text-base">
            FSPH
          </span>
          <span className="text-[10px] text-slate-500 font-medium leading-tight">
            Fundação de Saúde Parreiras Horta
          </span>
        </div>
      )}
    </div>
  )
}
