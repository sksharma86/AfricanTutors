import { StudyHallLogo } from "@/components/brand/study-hall-logo";

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-svh items-center justify-center bg-[#0c0c0b] px-16 ${className}`}>
      <div className="max-w-5xl text-center">{children}</div>
    </div>
  );
}

export function FilmCardHomework() {
  return (
    <CardShell>
      <p className="text-[13px] font-semibold tracking-[0.28em] text-[#c98816] uppercase">Study Hall</p>
      <h1 className="mt-8 font-display text-6xl font-semibold tracking-[-0.04em] text-white sm:text-7xl">
        Homework has changed.
      </h1>
    </CardShell>
  );
}

export function FilmCardLine({ line, sub }: { line: string; sub?: string }) {
  return (
    <CardShell>
      <h1 className="font-display text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">{line}</h1>
      {sub ? <p className="mt-8 text-xl font-medium text-white/45">{sub}</p> : null}
    </CardShell>
  );
}

export function FilmCardPresence() {
  return (
    <CardShell>
      <p className="text-[13px] font-semibold tracking-[0.32em] text-[#c98816] uppercase">Then</p>
      <h1 className="mt-6 font-display text-7xl font-semibold tracking-[-0.04em] text-white">Presence.</h1>
    </CardShell>
  );
}

export function FilmCardSimple() {
  return (
    <CardShell>
      <h1 className="font-display text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
        Simple for families.
      </h1>
    </CardShell>
  );
}

export function FilmCardNotSimple() {
  return (
    <CardShell>
      <h1 className="font-display text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
        Not simple underneath.
      </h1>
    </CardShell>
  );
}

export function FilmCardFinal() {
  return (
    <CardShell>
      <style>{`
        @keyframes filmBrandIn { from { opacity: 0; } to { opacity: 1; } }
        .film-brand { opacity: 0; animation: filmBrandIn 2.4s ease 4s forwards; }
      `}</style>
      <div className="film-brand">
        <StudyHallLogo size={56} variant="dark" />
      </div>
    </CardShell>
  );
}

const SYSTEMS = [
  { name: "Supabase", note: "Accounts · Data · Permissions" },
  { name: "Stripe", note: "Payments" },
  { name: "Daily", note: "Live Study Halls · Recordings" },
  { name: "Twilio", note: "Calls · SMS" },
  { name: "Resend", note: "Email" },
  { name: "Vercel", note: "Application infrastructure" },
];

export function FilmMachine() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#0c0c0b] px-16">
      <style>{`
        @keyframes filmFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .film-sys { opacity: 0; animation: filmFadeUp 1.3s ease forwards; }
      `}</style>
      <div className="w-full max-w-5xl text-center">
        <StudyHallLogo size={48} variant="dark" />
        <p className="mt-10 font-display text-5xl font-semibold tracking-[-0.04em] text-white">
          Study Hall (at home)
        </p>
        <ul className="mt-16 grid grid-cols-3 gap-x-12 gap-y-12">
          {SYSTEMS.map((item, i) => (
            <li key={item.name} className="film-sys" style={{ animationDelay: `${0.7 + i * 0.38}s` }}>
              <p className="text-[17px] font-semibold text-white">{item.name}</p>
              <p className="mt-1.5 text-sm text-white/40">{item.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
