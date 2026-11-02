import type { ReactNode } from "react";
import { SentinelMark } from "./sentinel-mark";

interface SignInColumnProps {
  // The content of the card: the screen's heading and what follows it.
  children: ReactNode;
}

// The column of the Sign In Page (docs/design-system.md, Sign In Page; Main
// Content), in which Sign in shows, and every other screen without a sidebar
// that shows while no signed-in user is known, such as the error of the
// first read of the signed-in user: the product name, which is not a link,
// because without a session the landing leads back to Sign in, above a card.
export function SignInColumn({ children }: SignInColumnProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-6 py-10">
      <div className="my-auto flex w-full max-w-100 flex-col gap-6">
        <p className="flex items-center justify-center gap-2 text-20 font-semibold">
          <SentinelMark className="size-6" />
          Sentinel
        </p>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          {children}
        </div>
      </div>
    </main>
  );
}
