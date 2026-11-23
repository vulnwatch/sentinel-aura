import { useState } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import {
  ResultAnnouncement,
  useChangedSinceOpened,
} from "./result-announcement";

// The announcement of what a list shows after a change of the state that its
// screen keeps in its URL, and not as the screen opens (docs/behaviors.md,
// Accessibility, Focus after a navigation), on a fictional list whose page
// the buttons change.

const WORDS = "3 Tickets";

function FictionalList() {
  const [state, setState] = useState("");
  const changed = useChangedSinceOpened(state);
  return (
    <>
      {["", "?page=2", "?page=3"].map((page) => (
        <Button
          key={page}
          onPress={() => {
            setState(page);
          }}
        >
          {page === "" ? "First page" : `Page ${page.slice(-1)}`}
        </Button>
      ))}
      <p>{changed ? "Changed" : "Unchanged"}</p>
      <ResultAnnouncement state={state}>
        {changed ? WORDS : ""}
      </ResultAnnouncement>
    </>
  );
}

test("counts no change while the state is the one with which the screen opened, and announces nothing", async () => {
  const screen = await render(<FictionalList />);

  await expect
    .element(screen.getByText("Unchanged", { exact: true }))
    .toBeVisible();
  expect(screen.getByRole("status").element().textContent).toBe("");
});

test("counts another state as a change, which lasts once the state returns to the one with which the screen opened", async () => {
  const screen = await render(<FictionalList />);

  await screen.getByRole("button", { name: "Page 2" }).click();
  await expect
    .element(screen.getByText("Changed", { exact: true }))
    .toBeVisible();
  await screen.getByRole("button", { name: "First page" }).click();

  await expect
    .element(screen.getByText("Changed", { exact: true }))
    .toBeVisible();
  await expect.element(screen.getByRole("status")).toHaveTextContent(WORDS);
});

test("holds its text in a status region that takes no room on the screen", async () => {
  const screen = await render(<FictionalList />);

  await screen.getByRole("button", { name: "Page 2" }).click();

  const region = screen.getByRole("status");
  await expect.element(region).toHaveTextContent(WORDS);
  expect(region.element().getBoundingClientRect().width).toBeLessThanOrEqual(1);
});

test("gives the same words a node of their own in each state, so that they are announced again", async () => {
  const screen = await render(<FictionalList />);
  await screen.getByRole("button", { name: "Page 2" }).click();
  const words = screen.getByText(WORDS, { exact: true });
  await expect.element(words).toBeInTheDocument();
  const before = words.element();

  await screen.getByRole("button", { name: "Page 3" }).click();

  await expect
    .poll(() => screen.getByText(WORDS, { exact: true }).element())
    .not.toBe(before);
  expect(before.isConnected).toBe(false);
});
