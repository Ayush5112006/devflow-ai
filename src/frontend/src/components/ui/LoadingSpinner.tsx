interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  fullPage?: boolean;
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};

export function LoadingSpinner({
  size = 'md',
  label = 'Loading…',
  fullPage = false,
}: LoadingSpinnerProps) {
  const inner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`rounded-full border-surface-border border-t-brand-400 animate-spin ${sizeMap[size]}`}
        role="status"
        aria-label={label}
      />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-navy-950/50 z-50">
        {inner}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-16">{inner}</div>;
}
