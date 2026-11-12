interface CvssVectorProps {
  // The vector, such as CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H.
  value: string;
}

// A CVSS vector in monospace, which users copy character by character
// (docs/design-system.md, Font), with a place to break after each "/", so
// that it wraps between its metrics where its place is narrower than it.
export function CvssVector({ value }: CvssVectorProps) {
  const metrics = value.split("/");
  return (
    <span className="font-mono">
      {metrics.map((metric, index) => (
        // The place of a metric keys it, since a vector, which a new read
        // replaces whole, never reorders its metrics.
        <span key={index}>
          {metric}
          {index < metrics.length - 1 && (
            <>
              /<wbr />
            </>
          )}
        </span>
      ))}
    </span>
  );
}
