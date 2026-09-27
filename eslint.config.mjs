import fs from "node:fs";
import path from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Confini tra moduli (ADR-0001): un modulo può importare da un altro modulo
// SOLO il suo `index.ts` (API server) o `domain/index.ts` (API pura).
const modulesDir = path.resolve("src/modules");
const moduleNames = fs.existsSync(modulesDir)
  ? fs
      .readdirSync(modulesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  : [];

const moduleZones = moduleNames.map((name) => ({
  target: `./src/modules/${name}`,
  from: "./src/modules",
  except: [
    `./${name}`,
    ...moduleNames
      .filter((other) => other !== name)
      .flatMap((other) => [`./${other}/index.ts`, `./${other}/domain/index.ts`]),
  ],
  message:
    "Confine tra moduli (ADR-0001): importa solo `@/modules/<nome>` o `@/modules/<nome>/domain`.",
}));

// Le route (src/app) e il worker usano i moduli solo tramite le loro API pubbliche.
const publicApiZones = ["./src/app", "./src/worker"].map((target) => ({
  target,
  from: "./src/modules",
  except: moduleNames.flatMap((name) => [`./${name}/index.ts`, `./${name}/domain/index.ts`]),
  message: "Usa solo l'API pubblica del modulo (`index.ts` o `domain/index.ts`).",
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": ["error", { zones: [...moduleZones, ...publicApiZones] }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.ts"],
    ignores: ["**/*.test.ts"], // i test possono leggere file di fixture
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "react-dom",
                "pg",
                "drizzle-orm",
                "drizzle-orm/*",
                "pino",
                "node:*",
              ],
              message:
                "Il `domain/` è puro (ADR-0001): niente framework, DB, logger o API di Node.",
            },
            {
              group: [
                "@/lib",
                "@/lib/*",
                "../server",
                "../server/*",
                "../ui",
                "../ui/*",
                "@/modules/*/server",
                "@/modules/*/server/*",
              ],
              message:
                "Il `domain/` è puro (ADR-0001): niente `@/lib` (DB, crypto, logger, env), `server/` o `ui/`.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts", "*.config.{ts,mjs}"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "db/migrations/**",
  ]),
]);

export default eslintConfig;
