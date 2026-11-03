import { AlertCircle } from "lucide-react";
export function ErroModalSvo({ erroModal }: { erroModal: string }) {
  if (!erroModal) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{erroModal}</span>
    </div>
  );
}
