import type { ReactNode } from "react";

// Small, presentational field primitives shared by the single-track editor
// (EditTrackModal) and the multi-track editor (BulkEditModal). Extracted verbatim
// so both editors render identical inputs — do not change their markup/behaviour
// without checking both call sites.

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{children}</label>;
}

export function FieldInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
    />
  );
}

export function FieldSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all appearance-none font-medium"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
