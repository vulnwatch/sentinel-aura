// The pattern and the color of the generated avatar (docs/design-system.md,
// Avatar, Definition, Version 1): the SHA-256 digest of a user's id, and the
// cells and the index of the color in the Palette that it selects.
// src/components/avatar.tsx draws the picture.

// The constants of SHA-256: the first 32 bits of the fractional parts of the
// cube roots of the first 64 primes, and of the square roots of the first 8
// primes (FIPS 180-4, 4.2.2 and 5.3.3).
const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;
const INITIAL_HASH = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
] as const;

function rotateRight(word: number, bits: number): number {
  return (word >>> bits) | (word << (32 - bits));
}

// The SHA-256 digest of a message (FIPS 180-4, 6.2). It is computed
// synchronously, so that a generated avatar shows in the same render as the
// name that it accompanies: the digest of Web Crypto is asynchronous only.
export function sha256(message: Uint8Array): Uint8Array {
  // The message, a 1 bit, zeros, and the length of the message in bits as a
  // 64-bit big-endian number, in blocks of 64 bytes (5.1.1).
  const length = Math.ceil((message.length + 9) / 64) * 64;
  const bytes = new Uint8Array(length);
  bytes.set(message);
  bytes[message.length] = 0x80;
  const blocks = new DataView(bytes.buffer);
  blocks.setUint32(length - 8, Math.floor(message.length / 0x20000000));
  blocks.setUint32(length - 4, (message.length * 8) >>> 0);

  const hash = new DataView(new ArrayBuffer(32));
  for (const [i, word] of INITIAL_HASH.entries()) {
    hash.setUint32(4 * i, word);
  }
  const schedule = new DataView(new ArrayBuffer(4 * 64));
  for (let block = 0; block < length; block += 64) {
    for (let t = 0; t < 64; t++) {
      if (t < 16) {
        schedule.setUint32(4 * t, blocks.getUint32(block + 4 * t));
      } else {
        const w15 = schedule.getUint32(4 * (t - 15));
        const w2 = schedule.getUint32(4 * (t - 2));
        const sigma0 = rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3);
        const sigma1 = rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10);
        const w16 = schedule.getUint32(4 * (t - 16));
        const w7 = schedule.getUint32(4 * (t - 7));
        schedule.setUint32(4 * t, (w16 + sigma0 + w7 + sigma1) >>> 0);
      }
    }

    let a = hash.getUint32(0);
    let b = hash.getUint32(4);
    let c = hash.getUint32(8);
    let d = hash.getUint32(12);
    let e = hash.getUint32(16);
    let f = hash.getUint32(20);
    let g = hash.getUint32(24);
    let h = hash.getUint32(28);
    for (const [t, constant] of ROUND_CONSTANTS.entries()) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 =
        (h + sum1 + choice + constant + schedule.getUint32(4 * t)) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    for (const [i, word] of [a, b, c, d, e, f, g, h].entries()) {
      hash.setUint32(4 * i, (hash.getUint32(4 * i) + word) >>> 0);
    }
  }
  return new Uint8Array(hash.buffer);
}

// The pattern and the color that a user's id selects (Definition, Version 1,
// steps 1 to 4). src/components/avatar.tsx gives an inactive user the gray
// in place of the color, and draws the picture.
export interface AvatarPattern {
  // The cells of step 3: cell 5c + r is the cell of column c, from 0 to 2,
  // and row r, from 0 to 4, and is true when it is filled.
  cells: readonly boolean[];
  // The index of the color in the Palette, from 0 to 7.
  color: number;
}

export function avatarPattern(id: string): AvatarPattern {
  const digest = new DataView(
    sha256(new TextEncoder().encode(id.toLowerCase())).buffer,
  );
  // Bit k of the digest, the most significant bit of byte 0 first.
  const bit = (k: number) =>
    (digest.getUint8(Math.floor(k / 8)) >> (7 - (k % 8))) & 1;
  const cells = Array.from({ length: 15 }, (_, k) => bit(k) === 1);
  return {
    // Without any filled cell, the center column, cells 10 to 14, is filled.
    cells: cells.includes(true) ? cells : cells.map((_, k) => k >= 10),
    // Bits 16 to 18: the three most significant bits of byte 2.
    color: digest.getUint8(2) >> 5,
  };
}

// The rows of the grid from top to bottom, and its columns from left to right.
const LINES = [0, 1, 2, 3, 4];

// The grid of the pattern, mirrored around its center column: its rows, each
// with its columns, true for a filled cell. Column 3 repeats column 1, and
// column 4 repeats column 0.
export function avatarGrid(cells: readonly boolean[]): boolean[][] {
  return LINES.map((row) =>
    LINES.map(
      (column) => cells[5 * Math.min(column, 4 - column) + row] === true,
    ),
  );
}
