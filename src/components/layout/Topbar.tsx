// src/components/layout/Topbar.tsx
interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between border-b border-[#e4e7ec] bg-white px-5"
      style={{ height: "52px", minHeight: "52px" }}
    >
      <div className="flex flex-col justify-center">
        <h1 className="text-[15px] font-semibold leading-tight text-[#111827]">{title}</h1>
        {subtitle && (
          <p className="text-[11px] leading-tight text-[#6b7280]">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </header>
  );
}