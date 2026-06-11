interface SectionBandProps {
  title: string;
  children?: React.ReactNode;
}

export function SectionBand({ title, children }: SectionBandProps) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-brand-purple text-white px-4 py-2 rounded-t-lg font-semibold text-sm">
        {title}
      </div>
      {children && <div className="p-4">{children}</div>}
    </div>
  );
}
