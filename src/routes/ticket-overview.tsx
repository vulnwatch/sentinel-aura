import { createRoute, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { DetailColumns, showAnchorTarget } from "../components/detail-screen";
import type { Read } from "../components/read-view";
import { sameSearch } from "../search-params";
import { ticketRoute, useShownTicket } from "./ticket";
import { useAssignee } from "./ticket-overview/assignee";
import { useCoordinatedReleaseDate } from "./ticket-overview/coordinated-release-date";
import { CvePart } from "./ticket-overview/cve";
import { CvssPart, useCvssAssessments } from "./ticket-overview/cvss";
import { Details, useDuplicates } from "./ticket-overview/details";
import {
  HIDDEN_SHOWN,
  PackagesPart,
  useYourWork,
} from "./ticket-overview/packages";
import {
  ParticipantsSection,
  useParticipantReads,
} from "./ticket-overview/participants";
import { SourcesSection, useCveSources } from "./ticket-overview/sources";

// Overview, the first tab of the Ticket screen (docs/screens/ticket.md): the
// CVE, the CVSS assessments, and the package tree of the Ticket in the main
// column, and its details, the sources of its CVE, and its participants in
// the side column, in two columns where the main content is wide enough, and
// otherwise in one, the details first and the sources and the participants
// last (docs/design-system.md, Detail Screens).
//
// Each part is a module of src/routes/ticket-overview/ (docs/conventions.md,
// Directory Structure and Naming).

// The keys that scroll the page, with which a user scrolls it by the keyboard.
const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
]);

// A read of the tab, which has settled once it has its data or its error, or
// when it is not sent, such as the duplicates of a duplicate.
type TabRead = Pick<Read<unknown>, "status" | "isFetching">;

function settled(read: TabRead): boolean {
  return read.status !== "pending" || !read.isFetching;
}

// Shows the target of the anchor of the URL once every read of the tab has
// settled, unless the user has scrolled meanwhile, so that a read that
// arrives later does not move the target out of view; the window scrolls it
// below what stays at the top of the window (src/components/fixed-top.ts),
// also in the side column, which can show it only toward the end of the page
// (showAnchorTarget). An anchor whose target the Ticket lacks, such as a part
// that it does not have, shows the top of the screen (docs/design-system.md,
// Main Content).
function useAnchorTarget(reads: readonly TabRead[]) {
  const ready = reads.every(settled);
  const hash = useRouterState({ select: (state) => state.location.hash });
  const scrolled = useRef(false);
  const shown = useRef(false);
  useEffect(() => {
    const onScrollIntent = () => {
      scrolled.current = true;
    };
    const onKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) {
        scrolled.current = true;
      }
    };
    window.addEventListener("wheel", onScrollIntent, { passive: true });
    window.addEventListener("touchmove", onScrollIntent, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onScrollIntent);
      window.removeEventListener("touchmove", onScrollIntent);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    if (!ready || shown.current) {
      return;
    }
    shown.current = true;
    if (hash === "" || scrolled.current) {
      return;
    }
    const target = document.getElementById(hash);
    if (target === null) {
      window.scrollTo(0, 0);
    } else {
      showAnchorTarget(target);
    }
  }, [ready, hash]);
}

function TicketOverview() {
  const { ticket, now, twoColumns } = useShownTicket();
  const { hidden } = ticketOverviewRoute.useSearch();
  const duplicates = useDuplicates(ticket);
  const yourWork = useYourWork(ticket);
  const cvss = useCvssAssessments(ticket);
  const sources = useCveSources(ticket);
  const participants = useParticipantReads(ticket);
  const assignee = useAssignee(ticket, twoColumns);
  const release = useCoordinatedReleaseDate(ticket);
  // The reads of the tab, which useReadAgain reads again too
  // (src/routes/ticket-overview/shared.tsx).
  useAnchorTarget([
    duplicates,
    yourWork.read,
    cvss,
    sources,
    participants.actors,
    participants.grants,
  ]);
  return (
    <>
      <DetailColumns
        twoColumns={twoColumns}
        leadingSections={
          <Details
            ticket={ticket}
            now={now}
            duplicates={duplicates}
            assignee={assignee}
            release={release}
          />
        }
        trailingSections={
          <>
            {ticket.cve !== null && (
              <SourcesSection
                ticketId={ticket.ticket_id}
                cveId={ticket.cve.cve_id}
                read={sources}
              />
            )}
            <ParticipantsSection ticket={ticket} reads={participants} />
          </>
        }
        parts={
          <>
            <CvePart cve={ticket.cve} />
            {ticket.cve !== null && <CvssPart read={cvss} ticket={ticket} />}
            <PackagesPart
              ticket={ticket}
              now={now}
              yourWork={yourWork}
              showHidden={hidden === HIDDEN_SHOWN}
            />
          </>
        }
      />
      {assignee.region}
      {release.region}
      {release.dialog}
    </>
  );
}

// The search parameters that Overview accepts: hidden, while the package
// tree shows its hidden records. A value that it does not accept counts as
// absent (docs/behaviors.md, Invalid Search Parameters).
const ticketOverviewSearch = z.object({
  hidden: z.literal(HIDDEN_SHOWN).optional().catch(undefined),
});

// Overview, at the path of the Ticket. A URL with a search parameter that it
// does not accept, or with a value that it does not accept, leads to the URL
// without it, in place of the URL in the browser history, keeping its anchor
// (docs/behaviors.md, Invalid Search Parameters; docs/screen-map.md, Browser
// History).
export const ticketOverviewRoute = createRoute({
  getParentRoute: () => ticketRoute,
  path: "/",
  validateSearch: ticketOverviewSearch,
  beforeLoad: ({ location, params }) => {
    // The router's search of the route also passes on every parameter of the
    // URL that the schema does not declare, so the schema reads the URL
    // itself.
    const accepted = ticketOverviewSearch.parse(location.search);
    if (!sameSearch(location.search, accepted)) {
      throw redirect({
        to: "/tickets/$ticketId",
        params,
        search: accepted,
        hash: location.hash,
        replace: true,
      });
    }
  },
  component: TicketOverview,
});
