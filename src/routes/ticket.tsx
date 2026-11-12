import {
  createRoute,
  linkOptions,
  Outlet,
  useChildMatches,
} from "@tanstack/react-router";
import { createContext, use, useRef, type ReactNode } from "react";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../api/generated/model";
import { useGetTicket } from "../api/generated/tickets";
import { ConfidentialLabel } from "../components/confidential-mark";
import { deadline, DeadlineBadge } from "../components/deadline-badge";
import { DetailHeading, useTwoColumns } from "../components/detail-screen";
import {
  DetailTabList,
  DetailTabPanel,
  DetailTabs,
  type DetailTab,
} from "../components/detail-tabs";
import { NotFound } from "../components/not-found";
import { ExplainedPriority } from "../components/priority-explanation";
import { UpdatingBar } from "../components/loading";
import {
  dataPlace,
  PartRead,
  ScreenRead,
  type Read,
} from "../components/read-view";
import { ScreenHeading } from "../components/screen-heading";
import { Severity } from "../components/severity";
import { TicketStatus } from "../components/ticket-status";
import { rootRoute } from "./root";

// The Ticket screen (docs/screens/ticket.md): one Ticket, from Get Ticket
// (Sentinel docs/features/tickets/tickets.md, Get Ticket), with its heading
// row and its tabs, each at a path under the path of the screen. Overview, at
// the path of the screen, is its first tab (src/routes/ticket-overview.tsx),
// and Audit log its second (src/routes/ticket-audit-log.tsx).

// The canonical identity of a Ticket, SNTL-{n} with n at most the largest
// positive INTEGER of PostgreSQL (Sentinel docs/api-spec.md, Ticket
// Identifier Resolution).
const TICKET_ID = /^SNTL-[1-9][0-9]*$/;
const LARGEST_TICKET_NUMBER = 2_147_483_647;

// Whether the identifier of a path has the form that the contract declares:
// any other, such as SNTL-0042, sntl-42, or a UUID, is malformed, and the
// screen shows Not found without a request (docs/behaviors.md, Missing and
// Inaccessible Records).
export function isTicketId(value: string): boolean {
  return (
    TICKET_ID.test(value) &&
    Number(value.slice("SNTL-".length)) <= LARGEST_TICKET_NUMBER
  );
}

// What the screen gives its tabs: the identifier of the Ticket, from the
// path, and whether the main content is wide enough for two columns
// (useTwoColumns).
interface TicketScreenState {
  ticketId: string;
  twoColumns: boolean;
}

const TicketScreenContext = createContext<TicketScreenState | null>(null);

// The Ticket that the screen shows, for a tab, which shows once the Ticket
// has arrived: the read of the screen, which this hook never sends itself,
// so that the data stays in the query cache (docs/conventions.md, Data Read
// from the API), with the instant at which its data arrived, in
// milliseconds since the epoch, with which the screen compares its due dates
// (docs/behaviors.md, Deadlines); and whether the main content is wide
// enough for two columns.
export function useShownTicket(): {
  ticket: TicketDetail;
  now: number;
  twoColumns: boolean;
} {
  const screen = use(TicketScreenContext);
  const read = useGetTicket(screen?.ticketId ?? "", {
    query: { enabled: false },
  });
  if (screen === null || read.data === undefined) {
    throw new Error("A tab of the Ticket screen shows outside its screen");
  }
  return {
    ticket: read.data.data,
    now: read.dataUpdatedAt,
    twoColumns: screen.twoColumns,
  };
}

// The tabs of the screen, each at a path under the path of the Ticket.
type TabId = "overview" | "audit-log";

function tabsOf(ticketId: string): readonly DetailTab[] {
  return [
    {
      id: "overview",
      label: "Overview",
      href: linkOptions({ to: "/tickets/$ticketId", params: { ticketId } }),
    },
    {
      id: "audit-log",
      label: "Audit log",
      href: linkOptions({
        to: "/tickets/$ticketId/audit-log",
        params: { ticketId },
      }),
    },
  ];
}

interface ValueProps {
  // The name of the value, which assistive technologies read before it.
  term: string;
  children: ReactNode;
}

// A main value of the heading row, named for assistive technologies.
function Value({ term, children }: ValueProps) {
  return (
    <div className="flex items-center">
      <dt className="sr-only">{term}</dt>
      <dd className="flex items-center">{children}</dd>
    </div>
  );
}

interface MainValuesProps {
  ticket: TicketDetail;
  now: number;
  compact: boolean;
}

// The main values of the Ticket after its identifier: its CVE ID in
// fg-muted, not a link, since the address of the CVE would lead to this
// screen (docs/screen-map.md, Links Between Areas); its status, severity, and
// priority, which opens its explanation, an absent severity and priority
// named precisely, since no column header names them here
// (docs/behaviors.md, Absent Values); and its deadline badge, when it has
// one (docs/behaviors.md, Deadlines). They wrap with the heading row.
function MainValues({ ticket, now, compact }: MainValuesProps) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {ticket.cve !== null && (
        <Value term="CVE">
          <span className={`text-fg-muted ${compact ? "text-16" : "text-20"}`}>
            {ticket.cve.cve_id}
          </span>
        </Value>
      )}
      <Value term="Status">
        <TicketStatus status={ticket.status} />
      </Value>
      <Value term="Severity">
        <Severity severity={ticket.severity} absentName="Severity not set" />
      </Value>
      <Value term="Priority">
        <ExplainedPriority
          ticket={ticket}
          placement="inline"
          absentName="Not yet prioritizable"
        />
      </Value>
      {deadline(ticket, now) !== undefined && (
        <Value term="Deadline">
          <DeadlineBadge ticket={ticket} now={now} />
        </Value>
      )}
    </dl>
  );
}

interface TicketFrameProps {
  ticketId: string;
  // The tab that shows.
  selected: TabId;
  // The Ticket once it has arrived.
  ticket: TicketDetail | undefined;
  now: number;
  // The place of the tab that shows.
  children: ReactNode;
}

// The heading row and the tabs, which show at once, and the panel of the tab
// that shows (docs/behaviors.md, Loading). The heading names the kind of
// screen, Ticket, until the Ticket arrives, then its identifier, without
// moving the focus (docs/behaviors.md, Accessibility, Focus after a
// navigation; docs/screen-map.md, Contract URLs). After the identifier, 4 px
// later, the lock and the label Confidential for a confidential Ticket, then
// its main values, 16 px apart; the tabs follow 12 px below the row, or right
// below it in the compact heading (docs/design-system.md, Detail Screens).
function TicketFrame({
  ticketId,
  selected,
  ticket,
  now,
  children,
}: TicketFrameProps) {
  const root = useRef<HTMLDivElement>(null);
  const twoColumns = useTwoColumns(root);
  return (
    <div ref={root}>
      <DetailTabs selected={selected}>
        <DetailHeading sticky={twoColumns === true}>
          {(compact) => (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-1">
                  <ScreenHeading compact={compact}>
                    {ticket?.ticket_id ?? "Ticket"}
                  </ScreenHeading>
                  {ticket?.is_confidential === true && <ConfidentialLabel />}
                </div>
                {ticket !== undefined && (
                  <MainValues ticket={ticket} now={now} compact={compact} />
                )}
              </div>
              <div className={compact ? "" : "mt-3"}>
                <DetailTabList
                  label="Ticket"
                  tabs={tabsOf(ticketId)}
                  compact={compact}
                />
              </div>
            </>
          )}
        </DetailHeading>
        <DetailTabPanel selected={selected}>
          {twoColumns !== undefined && (
            <TicketScreenContext value={{ ticketId, twoColumns }}>
              {children}
            </TicketScreenContext>
          )}
        </DetailTabPanel>
      </DetailTabs>
    </div>
  );
}

interface TicketUpdatesProps {
  read: Read<TicketDetailResponse>;
  children: ReactNode;
}

// The panel of a tab that shows at once, without waiting for the Ticket:
// once the Ticket shows, the warning of a new read of it that failed, at the
// top of the panel, and the mark of the Ticket that is read again after it
// failed (docs/behaviors.md, Where Errors Appear; Loading).
function TicketUpdates({ read, children }: TicketUpdatesProps) {
  const place = dataPlace(read);
  return (
    <div className="relative">
      {place.updating && <UpdatingBar />}
      <output className="block">{place.warning}</output>
      {children}
    </div>
  );
}

interface TicketReadProps {
  ticketId: string;
}

// The read of the Ticket, without which the screen shows nothing: its
// failure replaces the screen, its heading and tabs included, and a Ticket
// that does not exist or that the user cannot see shows Not found alike
// (docs/behaviors.md, Where Errors Appear; Missing and Inaccessible Records).
// Overview waits for the Ticket; Audit log, whose content does not depend on
// it, shows at once (docs/screens/ticket.md, States).
function TicketRead({ ticketId }: TicketReadProps) {
  const read = useGetTicket(ticketId);
  // The tab of the child that the outlet renders, rather than of the URL
  // that the router last resolved, which still names the tab of the screen
  // before a navigation from it, such as Audit log of another Ticket.
  const selected = useChildMatches({
    select: (matches): TabId =>
      matches.some((match) => match.routeId === "/tickets/$ticketId/audit-log")
        ? "audit-log"
        : "overview",
  });
  return (
    <ScreenRead
      read={read}
      renderFrame={(place, data) => (
        <TicketFrame
          ticketId={ticketId}
          selected={selected}
          ticket={data?.data}
          now={read.dataUpdatedAt}
        >
          {place}
        </TicketFrame>
      )}
      renderPlace={(ticket) =>
        selected === "audit-log" ? (
          <TicketUpdates read={ticket}>
            <Outlet />
          </TicketUpdates>
        ) : (
          <PartRead read={ticket}>{() => <Outlet />}</PartRead>
        )
      }
    />
  );
}

// The Ticket screen, at the path of a Ticket and of each of its tabs.
function TicketScreen() {
  const { ticketId } = ticketRoute.useParams();
  return isTicketId(ticketId) ? (
    <TicketRead ticketId={ticketId} />
  ) : (
    <NotFound />
  );
}

export const ticketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tickets/$ticketId",
  component: TicketScreen,
});
