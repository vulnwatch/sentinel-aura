import { useGetPlatformVersion } from "../api/generated/platform";
import { Button } from "./button";
import { DescriptionItem, DescriptionList } from "./description-list";
import { ModalDialog } from "./modal-dialog";
import { PartRead } from "./read-view";
import { WebLink } from "./web-link";

// About Sentinel, which the account menu opens (docs/screen-map.md, Sidebar;
// docs/design-system.md, Account Menu): the versions that a user states when
// they report a problem.

// The version of the UI, the version of package.json, which the build sets
// (vite.config.ts; docs/deployment.md, Release Process, Versions).
declare const SENTINEL_AURA_VERSION: string;

// The repositories whose releases the versions link to.
type Repository = "sentinel-aura" | "sentinel";

// The GitHub Release of a version of a repository, at the tag v<version>: an
// address of another site that the UI composes, with the version encoded in
// its last path segment (docs/behaviors.md, Links to Other Sites, Composed
// addresses; docs/conventions.md, Links from the API).
export function releaseAddress(
  repository: Repository,
  version: string,
): string {
  return `https://github.com/vulnwatch/${repository}/releases/tag/v${encodeURIComponent(version)}`;
}

interface VersionLinkProps {
  repository: Repository;
  version: string;
}

// A version, as a link to its release, on a line of its own.
function VersionLink({ repository, version }: VersionLinkProps) {
  return (
    <WebLink address={releaseAddress(repository, version)} tall>
      {version}
    </WebLink>
  );
}

// The version of Sentinel, from Get Platform Version, which the dialog reads
// each time it opens, since a host can run any later release that the UI
// supports, and two reads can return different versions while it is upgraded
// (Sentinel docs/features/platform/platform-version.md, Get Platform
// Version): the query goes when the dialog closes, and the version is not
// read again while it is open. While it loads, the loading indicator takes its
// place, and a failed read shows there, as that of a part, with Try again when
// the failure offers it (docs/behaviors.md, Where Errors Appear).
function SentinelVersion() {
  const read = useGetPlatformVersion({
    query: { gcTime: 0, refetchOnWindowFocus: false },
  });
  return (
    <PartRead read={read} inValue>
      {({ data }) => (
        <VersionLink repository="sentinel" version={data.version} />
      )}
    </PartRead>
  );
}

interface AboutDialogProps {
  // Closes the dialog, as Escape does.
  onClose: () => void;
}

// The dialog, at most 400 px wide, "About Sentinel": what the versions are
// for, then the version of Sentinel Aura and the version of Sentinel, as a
// description list whose terms take the width of the longest one, each
// version a link to its release; and Close. It takes the focus itself as it
// opens, so that its content is read first, and returns it to the element
// that opened it as it closes (docs/behaviors.md, Accessibility, Dialogs).
// It shows while it is in the page.
export function AboutDialog({ onClose }: AboutDialogProps) {
  return (
    <ModalDialog
      isOpen
      onClose={onClose}
      width="confirmation"
      title="About Sentinel"
      buttons={
        <Button size="large" onPress={onClose}>
          Close
        </Button>
      }
    >
      <p className="text-fg-muted">
        Include these versions when you report a problem.
      </p>
      <div className="mt-3">
        <DescriptionList fittedTerms>
          <DescriptionItem term="Sentinel Aura">
            <VersionLink
              repository="sentinel-aura"
              version={SENTINEL_AURA_VERSION}
            />
          </DescriptionItem>
          <DescriptionItem term="Sentinel">
            <SentinelVersion />
          </DescriptionItem>
        </DescriptionList>
      </div>
    </ModalDialog>
  );
}
