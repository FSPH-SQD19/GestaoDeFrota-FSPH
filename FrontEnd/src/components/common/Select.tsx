import React, { forwardRef } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
  leftIcon?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      options = [],
      placeholder,
      leftIcon,
      children,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-800 select-none">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}

          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={cn(
              "w-full appearance-none px-3.5 py-2.5 text-sm text-slate-900 bg-white rounded-xl border transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              leftIcon ? "pl-10" : "pl-3.5",
              "pr-10",
              error
                ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-200"
                : "border-slate-300 hover:border-slate-400 focus:border-slate-800 focus:ring-slate-200",
              disabled && "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.length > 0
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3.5 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4 stroke-[2]" />
          </div>
        </div>

        {error ? (
          <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-0.5 animate-fadeIn">
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

Select.displayName = "Select";
