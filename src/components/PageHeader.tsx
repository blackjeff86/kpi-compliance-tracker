// src/components/PageHeader.tsx
interface PageHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode; // Para botões como "Gerar PDF" ou "Novo"
  }
  
  export function PageHeader({ title, description, children }: PageHeaderProps) {
    return (
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-slate-500 mt-1 font-medium">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {children}
        </div>
      </div>
    );
  }