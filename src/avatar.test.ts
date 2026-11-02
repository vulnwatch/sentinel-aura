import { expect, test } from "vitest";
import { avatarGrid, avatarPicture, sha256 } from "./avatar";

// The picture of the avatar (docs/design-system.md, Avatar, Definition,
// Version 1; Test Vectors).

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// The examples of FIPS 180-2, Appendix B, of one block, two blocks, and a
// million bytes, and the empty message.
test.each([
  [
    "abc",
    "abc",
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  ],
  [
    "two blocks",
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  ],
  [
    "a million a",
    "a".repeat(1_000_000),
    "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
  ],
  [
    "the empty message",
    "",
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  ],
])("the SHA-256 digest of %s", (_, message, digest) => {
  expect(hex(sha256(utf8(message)))).toBe(digest);
});

// Every length around the boundaries of the padding, where the length of the
// message moves to a block of its own, and messages of several blocks.
test("gives the digest of Web Crypto for every length up to 200 bytes", async () => {
  for (let length = 0; length <= 200; length++) {
    const message = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) % 256);
    const expected = new Uint8Array(
      await crypto.subtle.digest("SHA-256", message),
    );
    expect(hex(sha256(message)), `${length} bytes`).toBe(hex(expected));
  }
});

// Test Vectors: the id, the first 3 bytes of the digest of its seed, the
// cells of step 3, cell 5c + r in position 5c + r, and the color.
const VECTORS = [
  ["019a2b3c-4d5e-7f00-8000-000000000001", "70b0e4", "011100001011000", 7],
  ["019a2b3c-4d5e-7f00-8000-000000000002", "a05ad9", "101000000101101", 6],
  ["019a2b3c-4d5e-7f00-8000-000000000003", "013db2", "000000010011110", 5],
  ["019a2b3c-4d5e-7f00-8000-000000000004", "d0fb93", "110100001111101", 4],
  ["019a2b3c-4d5f-7f00-8000-000000000001", "2f717f", "001011110111000", 3],
  ["019A2B3C-4D5E-7F00-8000-000000000001", "70b0e4", "011100001011000", 7],
  ["019a2b3c-4d5e-7f00-8000-0000000080d5", "00008f", "000000000011111", 4],
] as const;

test.each(VECTORS)(
  "the picture of %s",
  (id, digest, expectedCells, expectedColor) => {
    const { cells, color } = avatarPicture(id);

    expect(hex(sha256(utf8(id.toLowerCase()))).slice(0, 6)).toBe(digest);
    expect(cells.map((filled) => (filled ? "1" : "0")).join("")).toBe(
      expectedCells,
    );
    expect(color).toBe(expectedColor);
  },
);

// The grids of Test Vectors, row 0 first, # for a filled cell.
test.each([
  [
    "019a2b3c-4d5e-7f00-8000-000000000001",
    ["..#..", "#.#.#", "#...#", "##.##", "....."],
  ],
  [
    "019a2b3c-4d5e-7f00-8000-000000000002",
    ["#...#", "..#..", "#.#.#", ".....", ".###."],
  ],
  [
    "019a2b3c-4d5e-7f00-8000-000000000003",
    ["..#..", "..#..", ".###.", "..#..", "....."],
  ],
  [
    "019a2b3c-4d5e-7f00-8000-000000000004",
    ["#.#.#", "#.#.#", "..#..", "##.##", ".###."],
  ],
  [
    "019a2b3c-4d5f-7f00-8000-000000000001",
    [".###.", ".###.", "##.##", ".....", "##.##"],
  ],
  [
    "019a2b3c-4d5e-7f00-8000-0000000080d5",
    ["..#..", "..#..", "..#..", "..#..", "..#.."],
  ],
])("the grid of %s mirrors around its center column", (id, expected) => {
  const grid = avatarGrid(avatarPicture(id).cells);

  expect(
    grid.map((row) => row.map((filled) => (filled ? "#" : ".")).join("")),
  ).toEqual(expected);
});
