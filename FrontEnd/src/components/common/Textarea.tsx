import React, { forwardRef } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, disabled, rows = 3, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-slate-800 select-none">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          disabled={disabled}
          rows={rows}
          className={cn(
            "w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 rounded-xl border transition-all duration-150 resize-y",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            error
              ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-200"
              : "border-slate-300 hover:border-slate-400 focus:border-slate-800 focus:ring-slate-200",
            disabled && "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200",
            className,
          )}
          {...props}
        />

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

Textarea.displayName = "Textarea";
