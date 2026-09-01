// src/components/shared/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between">
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-[#6b7280]">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
}