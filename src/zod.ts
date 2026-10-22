import { z } from "zod";

// Zod compiles object schemas with `new Function` unless its JIT is disabled,
// and the Content Security Policy allows no evaluated code
// (docs/architecture.md, Security Headers). main.tsx imports this module
// first, before any schema is used.
z.config({ jitless: true });
