export default function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-10">
      <div className="flex-1">
        <p className="text-sm text-zinc-500 mb-2">{eyebrow}</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm sm:text-base text-zinc-400 mt-2 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
