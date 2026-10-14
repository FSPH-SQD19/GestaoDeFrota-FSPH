import React from 'react'
import { cn } from '../../lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'default' | 'flat' | 'outline'
}

export const Card: React.FC<CardProps> = ({
  className,
  children,
  variant = 'default',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white border border-slate-200/80 shadow-xs',
    flat: 'bg-slate-100/70 border-0',
    outline: 'bg-white border-2 border-slate-200',
  }

  return (
    <div
      className={cn('rounded-2xl p-6 transition-all duration-150', variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
}
