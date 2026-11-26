import { useEffect, useRef } from "react";
import { useGetBugzillaNeedinfoCount } from "../../api/generated/bugzilla";
import { CountLink } from "../../components/count-link";
import { WebAddress } from "../../components/web-link";
import { lastReadFailed } from "./shared";

// The Bugzilla needinfo count of the attention summary of the Ticket list
// (src/routes/tickets/attention-summary.tsx).

interface BugzillaNeedinfoCountProps {
  // Whether the screen reads its list.
  listFetching: boolean;
}

// The number of open SUSE Bugzilla bugs on which a needinfo flag asks the
// security team for information, from Get Bugzilla Needinfo Count (Sentinel
// docs/features/integrations/bugzilla-needinfo-count.md), as a count that
// links to the Bugzilla search of the response, on another site
// (docs/screens/ticket-list.md, Content). Its read is its own, so that a
// slow Bugzilla delays neither the other counts nor the rows. It is read
// again as the other counts are: when the tab returns to the foreground once
// it has a number, and, while its read has failed, with each read of the
// list, and stays not available meanwhile (docs/behaviors.md, Loading; Where
// Errors Appear). Until a read returns the address of the search, the count
// is not a link; a later failure keeps the address of the last read that
// succeeded, which is the same for every response of a release. Whether the
// read of Bugzilla was authenticated is not shown.
export function BugzillaNeedinfoCount({
  listFetching,
}: BugzillaNeedinfoCountProps) {
  const read = useGetBugzillaNeedinfoCount();
  const failed = lastReadFailed(read);
  const { refetch } = read;
  const wasFetching = useRef(listFetching);
  useEffect(() => {
    const started = listFetching && !wasFetching.current;
    wasFetching.current = listFetching;
    if (started && failed) {
      void refetch({ cancelRefetch: false });
    }
  }, [listFetching, failed, refetch]);
  return (
    <CountLink
      label="Bugzilla needinfo"
      value={read.data?.data.count}
      failed={failed}
      href={WebAddress.of(read.data?.data.url)}
    />
  );
}
