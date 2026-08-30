export function ParentBrandStrip() {
  return (
    <section className="mt-10 border-t border-[#1c1915]/[0.06] pt-7">
      <p className="text-[13px] font-medium tracking-[-0.01em] text-[var(--pp-ink)]">A better homework routine.</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-[13px] font-semibold text-[var(--pp-ink)]">Focused time</dt>
          <dd className="mt-1 text-sm leading-6 text-[var(--pp-muted)]">Live accountability</dd>
        </div>
        <div>
          <dt className="text-[13px] font-semibold text-[var(--pp-ink)]">More consistency</dt>
          <dd className="mt-1 text-sm leading-6 text-[var(--pp-muted)]">A dependable Study Hall rhythm</dd>
        </div>
        <div>
          <dt className="text-[13px] font-semibold text-[var(--pp-ink)]">Less parent friction</dt>
          <dd className="mt-1 text-sm leading-6 text-[var(--pp-muted)]">
            Someone else is there to keep homework time moving
          </dd>
        </div>
      </dl>
    </section>
  );
}
