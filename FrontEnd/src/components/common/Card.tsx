import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "flat" | "outline";
}

export const Card: React.FC<CardProps> = ({
  className,
  children,
  variant = "default",
  ...props
}) => {
  const variantStyles = {
    default: "bg-white border border-slate-200",
    flat: "bg-slate-100/70 border border-slate-200/60",
    outline: "bg-white border border-slate-300",
  };

  return (
    <div
      className={cn(
        "rounded-xl p-5 transition-colors duration-150",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
