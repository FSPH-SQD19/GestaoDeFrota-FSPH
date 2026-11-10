import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "info" | "warning" | "danger" | "neutral";
  size?: "sm" | "md";
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  ...props
}) => {
  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5 rounded-md gap-1.5",
    md: "text-xs px-2.5 py-0.5 rounded-md gap-1.5",
  };

  const variantStyles = {
    success: "bg-emerald-50/80 text-emerald-800 border border-emerald-200",
    info: "bg-blue-50/80 text-blue-800 border border-blue-200",
    warning: "bg-amber-50/80 text-amber-800 border border-amber-200",
    danger: "bg-rose-50/80 text-rose-800 border border-rose-200",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  const dotStyles = {
    success: "bg-emerald-600",
    info: "bg-blue-600",
    warning: "bg-amber-500",
    danger: "bg-rose-600",
    neutral: "bg-slate-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold leading-5 select-none",
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotStyles[variant])} />}
      <span>{children}</span>
    </span>
  );
};
