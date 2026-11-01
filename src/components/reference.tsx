interface ReferenceProps {
  requestId: string;
}

// The reference of an error: "Reference:" and the identifier of its request,
// in monospace, which the user can select and copy to report it
// (docs/behaviors.md, Default Presentation by Status; docs/design-system.md,
// Font; Messages).
export function Reference({ requestId }: ReferenceProps) {
  return (
    <p>
      Reference:{" "}
      <span className="font-mono select-all wrap-anywhere">{requestId}</span>
    </p>
  );
}
