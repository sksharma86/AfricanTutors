export function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-ink-500">{description}</p>
    </div>
  );
}
