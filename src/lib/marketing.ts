import "server-only";

import { packageEconomics } from "@/lib/packages.mjs";
import { SESSION_OPTIONS } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Display labels for the REAL subject categories in the catalog. */
export const SUBJECT_CATEGORY_LABEL: Record<string, string> = {
  math: "Math",
  science: "Science",
  english_writing: "English & Writing",
  test_prep: "Test Prep",
  college: "College Courses",
  other: "Other",
};

const CATEGORY_ORDER = ["math", "science", "english_writing", "test_prep", "college", "other"];

export interface PublicSubjectCategory {
  category: string;
  label: string;
  subjects: string[];
}

export interface PublicPackage {
  id: string;
  name: string;
  minutes: number;
  hours: number;
  priceCents: number;
  effectiveHourlyCents: number;
  savingsCents: number;
}

// Resilient fallbacks (used only if the DB read is unavailable) so public pages
// never render blank. These mirror the authoritative catalog/products.
const FALLBACK_SUBJECTS: PublicSubjectCategory[] = [
  { category: "math", label: "Math", subjects: ["Algebra I", "Algebra II", "Geometry", "Calculus"] },
  { category: "science", label: "Science", subjects: ["Biology", "Chemistry", "Physics"] },
  { category: "english_writing", label: "English & Writing", subjects: ["English", "Essay Writing"] },
  { category: "test_prep", label: "Test Prep", subjects: ["SAT", "ACT"] },
  { category: "college", label: "College Courses", subjects: ["Economics"] },
];

const FALLBACK_PACKAGES: { id: string; name: string; minutes: number; price_cents: number }[] = [
  { id: "pkg-14", name: "14 Hour Routine", minutes: 840, price_cents: 14000 },
  { id: "pkg-28", name: "28 Hour Routine", minutes: 1680, price_cents: 25200 },
];

/** Active subjects grouped by their real category (anon-readable catalog). */
export async function getPublicSubjects(): Promise<PublicSubjectCategory[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase
    ? await supabase.from("subjects").select("name, category").eq("is_active", true).order("category").order("name")
    : { data: null };
  const rows = (data ?? []) as { name: string; category: string }[];
  if (rows.length === 0) return FALLBACK_SUBJECTS;

  const byCategory = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byCategory.get(r.category) ?? [];
    arr.push(r.name);
    byCategory.set(r.category, arr);
  }
  return Array.from(byCategory.entries())
    .map(([category, subjects]) => ({
      category,
      label: SUBJECT_CATEGORY_LABEL[category] ?? category,
      subjects,
    }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
}

/** Active prepaid packages with derived economics (anon-readable products). */
export async function getPublicPackages(): Promise<PublicPackage[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase
    ? await supabase
        .from("package_products")
        .select("id, name, minutes, price_cents")
        .eq("is_active", true)
        .order("sort_order")
    : { data: null };
  const rows = ((data ?? []) as { id: string; name: string; minutes: number; price_cents: number }[]);
  const source = rows.length > 0 ? rows : FALLBACK_PACKAGES;
  return source.map((p) => {
    const e = packageEconomics(p.minutes, p.price_cents);
    return {
      id: p.id,
      name: p.name,
      minutes: p.minutes,
      hours: e.hours,
      priceCents: p.price_cents,
      effectiveHourlyCents: e.effectiveHourlyCents,
      savingsCents: e.savingsCents,
    };
  });
}

/**
 * The pricing anchor shown in hero copy: the low end is the best prepaid package
 * rate; the high end is the standard 60-minute pay-as-you-go rate ($12/hour).
 */
export function hourlyPriceRange(packages: PublicPackage[]): { lowCents: number; highCents: number } {
  const sixty = SESSION_OPTIONS.find((o) => o.minutes === 60);
  const highCents = (sixty?.priceUsd ?? 12) * 100;
  const lowCents = packages.length
    ? Math.min(...packages.map((p) => p.effectiveHourlyCents))
    : highCents;
  return { lowCents, highCents };
}
