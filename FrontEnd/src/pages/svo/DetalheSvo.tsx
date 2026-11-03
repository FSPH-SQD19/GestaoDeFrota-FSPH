export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
