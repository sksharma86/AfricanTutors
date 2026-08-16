import { BrandMark } from "@/components/brand/brand-mark";

export function MissionVisual() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-gold-50 p-10 text-center sm:p-14">
      <BrandMark size={88} />
      <p className="mt-6 font-display text-xl font-semibold text-ink-900 sm:text-2xl">
        Academic talent has no borders.
      </p>
      <p className="mt-2 max-w-xs text-sm leading-6 text-ink-500">
        African Tutors was built around that idea &mdash; and a better way to connect it with
        the families who need it.
      </p>
    </div>
  );
}
