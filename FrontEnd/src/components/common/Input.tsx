import React, { forwardRef, useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 select-none">
            {label}
            {props.required && <span className="text-rose-600 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={inputType}
            disabled={disabled}
            className={cn(
              "w-full px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-lg border transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              leftIcon ? "pl-9" : "pl-3",
              isPassword || rightIcon ? "pr-9" : "pr-3",
              error
                ? "border-rose-500 bg-rose-50/20 text-rose-900 focus:border-rose-600 focus:ring-rose-500/15"
                : "border-slate-300 hover:border-slate-400 focus:border-slate-900 focus:ring-slate-900/10",
              disabled && "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200",
              className,
            )}
            {...props}
          />

          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none cursor-pointer"
              aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : rightIcon ? (
            <div className="absolute right-3 flex items-center text-slate-400">{rightIcon}</div>
          ) : null}
        </div>

        {error ? (
          <p className="flex items-center gap-1.5 text-xs text-rose-700 font-medium mt-0.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
