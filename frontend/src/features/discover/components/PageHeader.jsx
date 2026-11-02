const PageHeader = ({ title, subtitle, children }) => (
  <header className="mb-5 pt-6">
    <h1 className="text-2xl font-bold text-[var(--title-color)]">{title}</h1>
    {subtitle && <p className="mt-1 text-sm text-[var(--color-subtitle)]">{subtitle}</p>}
    {children}
  </header>
);

export const EmptyState = ({ icon, title, text }) => (
  <div className="flex flex-col items-center rounded-xl bg-[var(--home-card)] px-6 py-12 text-center">
    <div className="mb-3 rounded-full bg-[var(--photo-bg)] p-3 text-[var(--color-subtitle)]">
      {icon}
    </div>
    <p className="font-semibold">{title}</p>
    {text && <p className="mt-1 max-w-sm text-sm text-[var(--color-subtitle)]">{text}</p>}
  </div>
);

export default PageHeader;
