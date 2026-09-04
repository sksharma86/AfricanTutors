import { notFound } from "next/navigation";

import {
  FilmCardFinal,
  FilmCardHomework,
  FilmCardLine,
  FilmCardNotSimple,
  FilmCardPresence,
  FilmCardSimple,
  FilmMachine,
} from "@/components/film/film-cards";
import { FilmBooking } from "@/components/film/film-booking";
import { FilmFinance } from "@/components/film/film-finance";
import { FilmCustomers, FilmGuides } from "@/components/film/film-ops";
import { FilmSessionChrome } from "@/components/film/film-session-chrome";
import { GuideCompletedHeader } from "@/components/dashboard/guide-completed-header";
import { GuideHomeBoard } from "@/components/dashboard/guide-home-board";
import { GuideOpenCoverageCard } from "@/components/dashboard/guide-open-coverage-card";
import { GuidePage } from "@/components/dashboard/guide-page";
import { GuideSessionReport } from "@/components/dashboard/guide-session-report";
import { GuideSurface } from "@/components/dashboard/guide-surface";
import { ManagementIncidentHistory } from "@/components/dashboard/management-incident-history";
import { ManagementOverview } from "@/components/dashboard/management-overview";
import { ManagementPage } from "@/components/dashboard/management-page";
import { ManagementStudyHalls } from "@/components/dashboard/management-study-halls";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
import { ParentCompletedHeader, ParentSessionRecap } from "@/components/dashboard/parent-session-recap";
import { ParentHomeBoard } from "@/components/dashboard/parent-home-board";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { RecordingViewerFrame } from "@/components/dashboard/recording-viewer-frame";
import { assertFilmCapture } from "@/lib/film/guard";
import { guideHomeVisualFixture, guideVisualReviewNow } from "@/lib/guide-home-visual-fixture.mjs";
import { managementHomeVisualFixture, managementIncidentHistoryFixture, managementVisualReviewNow } from "@/lib/management-visual-fixture.mjs";
import { parentHomeVisualFixture } from "@/lib/parent-home-visual-fixture.mjs";
import type { GuideAvailabilityBlock, GuideExceptionRow } from "@/lib/guide-portal-data";
import type { GuideBooking, GuideEarning } from "@/lib/guide-portal-types";

export const dynamic = "force-dynamic";

const SURFACES = new Set([
  "card-homework",
  "card-ai-explain",
  "card-ai-answer",
  "card-ai-generate",
  "card-ai-work",
  "card-presence",
  "card-simple",
  "card-not-simple",
  "card-final",
  "machine",
  "parent",
  "parent-completed",
  "parent-recording",
  "parent-book",
  "guide",
  "guide-required",
  "guide-report",
  "guide-coverage",
  "management",
  "management-attention",
  "management-search",
  "management-restored",
  "management-incidents",
  "management-guides",
  "management-customers",
  "management-finance",
  "management-study-halls",
  "session",
  "session-call",
]);

export default async function FilmSurfacePage({
  params,
}: {
  params: Promise<{ surface: string }>;
}) {
  assertFilmCapture();
  const { surface } = await params;
  if (!SURFACES.has(surface)) notFound();

  const parentNow = new Date("2026-08-26T21:00:00.000Z");
  const parent = parentHomeVisualFixture(parentNow, { scene: "one-next" });
  const guideNow = guideVisualReviewNow(new Date("2026-08-26T21:00:00Z"), "America/Chicago", 16, 0);
  const guide = guideHomeVisualFixture(guideNow, {});
  const guideRequired = guideHomeVisualFixture(guideNow, { scene: "required" });
  const mgmtNow = managementVisualReviewNow(new Date("2026-08-26T23:05:00Z"), "America/Chicago", 18, 5);
  const mgmt = managementHomeVisualFixture(mgmtNow, {});
  const mgmtMissed = managementHomeVisualFixture(mgmtNow, { scene: "missed" });
  const mgmtSearch = managementHomeVisualFixture(mgmtNow, { scene: "search" });
  const mgmtRestored = managementHomeVisualFixture(mgmtNow, { scene: "restored" });
  const incidents = managementIncidentHistoryFixture(mgmtNow);

  switch (surface) {
    case "card-homework":
      return <FilmCardHomework />;
    case "card-ai-explain":
      return <FilmCardLine line="AI can explain." />;
    case "card-ai-answer":
      return <FilmCardLine line="AI can answer." />;
    case "card-ai-generate":
      return <FilmCardLine line="AI can generate." />;
    case "card-ai-work":
      return <FilmCardLine line="But someone still has to do the work." />;
    case "card-presence":
      return <FilmCardPresence />;
    case "card-simple":
      return <FilmCardSimple />;
    case "card-not-simple":
      return <FilmCardNotSimple />;
    case "card-final":
      return <FilmCardFinal />;
    case "machine":
      return <FilmMachine />;
    case "parent":
      return (
        <ParentPage compose>
          <ParentHomeBoard {...parent} />
        </ParentPage>
      );
    case "parent-completed":
      return (
        <ParentPage>
          <ParentCompletedHeader
            when="Wednesday, Aug 27 · 6:30 PM – 7:30 PM"
            childrenLine="Jordan"
            guide="Sarah"
          />
          <div className="mt-6">
            <ParentSurface>
              <ParentSessionRecap
                report={{
                  id: "fixture-report",
                  booking_id: "fixture-recent",
                  submitted_at: "2026-08-27T00:30:00.000Z",
                  focus_rating: "good_focus",
                  work_summary: "Homework stayed on track.",
                  redirection_level: "a_little",
                  guide_note: null,
                }}
                recording={{
                  id: "fixture-rec",
                  status: "completed",
                  retention_until: "2026-10-26T00:00:00.000Z",
                  deleted_at: null,
                  playable: true,
                }}
              />
            </ParentSurface>
          </div>
        </ParentPage>
      );
    case "parent-recording":
      return (
        <ParentPage>
          <RecordingViewerFrame
            backHref="/film/parent-completed"
            backLabel="← Back to Reports & Recordings"
            secondaryHref="/film/parent-completed"
            secondaryLabel="← Back to Study Hall"
            url={undefined}
            heading="Study Hall recording"
            note={<p>Available for 58 more days</p>}
          />
        </ParentPage>
      );
    case "parent-book":
      return <FilmBooking />;
    case "guide":
    case "guide-required": {
      const fx = surface === "guide-required" ? guideRequired : guide;
      return (
        <GuidePage compose>
          <GuideHomeBoard
            firstName={fx.firstName}
            bookings={fx.bookings as GuideBooking[]}
            availability={fx.availability as GuideAvailabilityBlock[]}
            exceptions={fx.exceptions as GuideExceptionRow[]}
            earnings={fx.earnings as GuideEarning[]}
            reportedBookings={fx.reportedBookings}
            reportsReady={fx.reportsReady}
            timeZone={fx.timeZone}
            nowMs={fx.nowMs}
            currency={fx.currency}
            profileStatus={fx.profileStatus}
          />
        </GuidePage>
      );
    }
    case "guide-report":
      return (
        <GuidePage>
          <GuideCompletedHeader child="Jordan" when="Wednesday, Aug 27 · 6:30 PM">
            <p className="mt-4 text-sm text-white/70">Before you finish, tell the parent how the hour went.</p>
          </GuideCompletedHeader>
          <div className="mt-4">
            <GuideSurface>
              <GuideSessionReport
                bookingId="fixture-report-booking"
                childName="Jordan"
                alreadySubmitted={false}
                variant="page"
              />
            </GuideSurface>
          </div>
        </GuidePage>
      );
    case "guide-coverage":
      return (
        <GuidePage>
          <GuideOpenCoverageCard
            bookingId="fixture-open-coverage"
            timeLabel="6:00 PM–7:00 PM CT"
            durationLabel="60 minutes"
            state="open"
            message={null}
          />
        </GuidePage>
      );
    case "management":
      return (
        <ManagementPage navItems={ADMIN_PORTAL_NAV} compose wide>
          <ManagementOverview
            bookings={mgmt.bookings as never}
            presenceByBooking={mgmt.presenceByBooking as never}
            attentionItems={mgmt.attentionItems as never}
            guidesActive={mgmt.guidesActive}
            outstandingTotals={mgmt.outstandingTotals}
            guides={mgmt.guides as never}
            reports={mgmt.reports as never}
            payments={mgmt.payments as never}
            nowMs={mgmt.nowMs}
            timeZone={mgmt.timeZone}
          />
        </ManagementPage>
      );
    case "management-attention":
      return (
        <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
          <ManagementStudyHalls
            bookings={mgmtMissed.bookings as never}
            presenceByBooking={mgmtMissed.presenceByBooking as never}
            nowMs={mgmtMissed.nowMs}
          />
        </ManagementPage>
      );
    case "management-search":
      return (
        <ManagementPage navItems={ADMIN_PORTAL_NAV} compose wide>
          <ManagementOverview
            bookings={mgmtSearch.bookings as never}
            presenceByBooking={mgmtSearch.presenceByBooking as never}
            attentionItems={mgmtSearch.attentionItems as never}
            guidesActive={mgmtSearch.guidesActive}
            outstandingTotals={mgmtSearch.outstandingTotals}
            guides={mgmtSearch.guides as never}
            reports={mgmtSearch.reports as never}
            payments={mgmtSearch.payments as never}
            nowMs={mgmtSearch.nowMs}
            timeZone={mgmtSearch.timeZone}
          />
        </ManagementPage>
      );
    case "management-restored":
      return (
        <ManagementPage navItems={ADMIN_PORTAL_NAV} compose wide>
          <ManagementOverview
            bookings={mgmtRestored.bookings as never}
            presenceByBooking={mgmtRestored.presenceByBooking as never}
            attentionItems={mgmtRestored.attentionItems as never}
            guidesActive={mgmtRestored.guidesActive}
            outstandingTotals={mgmtRestored.outstandingTotals}
            guides={mgmtRestored.guides as never}
            reports={mgmtRestored.reports as never}
            payments={mgmtRestored.payments as never}
            nowMs={mgmtRestored.nowMs}
            timeZone={mgmtRestored.timeZone}
          />
        </ManagementPage>
      );
    case "management-incidents":
      return (
        <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
          <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">
            Incident History
          </h1>
          <p className="mt-1 text-sm text-[var(--mg-muted)]">
            What went wrong, what the system did, and how it ended.
          </p>
          <div className="mt-4">
            <ManagementIncidentHistory incidents={incidents.incidents as never} nowMs={incidents.nowMs} />
          </div>
        </ManagementPage>
      );
    case "management-guides":
      return <FilmGuides />;
    case "management-customers":
      return <FilmCustomers />;
    case "management-study-halls":
      return (
        <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
          <ManagementStudyHalls
            bookings={mgmt.bookings as never}
            presenceByBooking={mgmt.presenceByBooking as never}
            nowMs={mgmt.nowMs}
          />
        </ManagementPage>
      );
    case "management-finance":
      return <FilmFinance />;
    case "session":
      return <FilmSessionChrome />;
    case "session-call":
      return <FilmSessionChrome showCallParent />;
    default:
      notFound();
  }
}
