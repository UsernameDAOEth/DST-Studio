import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dir, "../api-zod/src/index.ts");

if (existsSync(indexPath)) {
  const original = readFileSync(indexPath, "utf8");
  const fixed = original
    .split("\n")
    .filter((line) => !line.includes("api.schemas"))
    .join("\n");
  if (fixed !== original) {
    writeFileSync(indexPath, fixed, "utf8");
    console.log("Fixed api-zod index.ts: removed phantom api.schemas export");
  }
}
