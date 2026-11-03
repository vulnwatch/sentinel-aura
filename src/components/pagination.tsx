import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { ButtonLink } from "./button-link";
import type { ScreenHref } from "./router-links";
import { FocusHandOff } from "./screen-heading";

const COUNT = new Intl.NumberFormat("en-US");

interface PageLinkProps {
  // The address of the page, or undefined when there is none, which disables
  // the link.
  href: ScreenHref | undefined;
  // The place of the link.
  own: RefObject<HTMLSpanElement | null>;
  // Moves the focus to the other link.
  focusOther: () => void;
  children: ReactNode;
}

// Previous or Next. When it holds the focus and its page leads to the first
// or the last page, where it is disabled, the focus moves to the other one,
// which leads back (docs/behaviors.md, Accessibility, Focus after an
// action): a disabled link takes no focus.
function PageLink({ href, own, focusOther, children }: PageLinkProps) {
  useLayoutEffect(() => {
    const element = own.current;
    return () => {
      if (element?.contains(document.activeElement)) {
        queueMicrotask(focusOther);
      }
    };
  }, [own, focusOther]);
  return (
    <span ref={own} className="contents">
      <ButtonLink size="small" href={href} isDisabled={href === undefined}>
        {children}
      </ButtonLink>
    </span>
  );
}

interface PaginationProps {
  // The page that shows, from 1.
  page: number;
  // The number of records per page.
  perPage: number;
  // The number of records of the list.
  total: number;
  // The address of the list at a page, which its URL keeps
  // (docs/screen-map.md, Browser History).
  href: (page: number) => ScreenHref;
}

// The pagination of a list, 16 px below its table, at the end of the line,
// when the list has more than one page (docs/design-system.md, Lists): the
// range, such as "1–20 of 25", in text-14 and fg-muted, then Previous and
// Next as links that look like secondary buttons 32 px high, Previous
// disabled on the first page and Next on the last. A page beyond the last
// shows none: the empty state takes its place (docs/behaviors.md, Empty
// States).
export function Pagination({ page, perPage, total, href }: PaginationProps) {
  const previous = useRef<HTMLSpanElement>(null);
  const next = useRef<HTMLSpanElement>(null);
  const focusPrevious = useCallback(() => {
    previous.current?.querySelector<HTMLElement>("a")?.focus();
  }, []);
  const focusNext = useCallback(() => {
    next.current?.querySelector<HTMLElement>("a")?.focus();
  }, []);
  const lastPage = Math.ceil(total / perPage);
  if (lastPage <= 1 || page > lastPage) {
    return null;
  }
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  const hasPrevious = page > 1;
  const hasNext = page < lastPage;
  return (
    // When it leaves the page while it holds the focus, such as when an error
    // takes the place of the rows, the focus moves to the screen's heading.
    <FocusHandOff>
      <nav
        aria-label="Pagination"
        className="mt-4 flex flex-wrap items-center justify-end gap-2"
      >
        <p className="me-2 text-14 text-fg-muted tabular-nums">
          {`${COUNT.format(first)}–${COUNT.format(last)} of ${COUNT.format(total)}`}
        </p>
        <PageLink
          key={`previous-${hasPrevious}`}
          href={hasPrevious ? href(page - 1) : undefined}
          own={previous}
          focusOther={focusNext}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Previous
        </PageLink>
        <PageLink
          key={`next-${hasNext}`}
          href={hasNext ? href(page + 1) : undefined}
          own={next}
          focusOther={focusPrevious}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </PageLink>
      </nav>
    </FocusHandOff>
  );
}
