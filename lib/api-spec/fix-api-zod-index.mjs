import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dir, "../api-zod/src/index.ts");

if (existsSync(indexPath)) {
  const original = readFileSync(indexPath, "utf8");
  let fixed = original
    .split("\n")
    .filter((line) => !line.includes("api.schemas"))
    .join("\n");

  const apiPath = resolve(__dir, "../api-zod/src/generated/api.ts");
  const typesIndexPath = resolve(__dir, "../api-zod/src/generated/types/index.ts");
  if (existsSync(apiPath) && existsSync(typesIndexPath)) {
    const apiContent = readFileSync(apiPath, "utf8");
    const typesContent = readFileSync(typesIndexPath, "utf8");
    const apiExports = new Set();
    for (const m of apiContent.matchAll(/export (?:const|function|type|interface|class|enum) (\w+)/g)) {
      apiExports.add(m[1]);
    }
    const typesExports = new Set();
    for (const m of typesContent.matchAll(/export \* from "\.\/(\w+)"/g)) {
      const typeFile = resolve(__dir, `../api-zod/src/generated/types/${m[1]}.ts`);
      if (existsSync(typeFile)) {
        const tc = readFileSync(typeFile, "utf8");
        for (const tm of tc.matchAll(/export (?:type |interface |enum |const |function )?(\w+)/g)) {
          typesExports.add(tm[1]);
        }
      }
    }
    const dupes = [...apiExports].filter((e) => typesExports.has(e));
    if (dupes.length > 0) {
      const remaining = [...typesExports].filter((e) => !apiExports.has(e)).map((e) => String(e));
      if (remaining.length > 0) {
        fixed = `export * from "./generated/api";\nexport type { ${remaining.join(", ")} } from "./generated/types";\n`;
      } else {
        fixed = `export * from "./generated/api";\n`;
      }
      console.log(`Fixed api-zod index.ts: resolved ${dupes.length} duplicate exports`);
    }
  }

  if (fixed !== original) {
    writeFileSync(indexPath, fixed, "utf8");
    console.log("Fixed api-zod index.ts");
  }
}
