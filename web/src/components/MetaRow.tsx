export function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{children}</span>
    </div>
  );
}
