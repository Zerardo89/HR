import fs from "node:fs";
import path from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Confini tra moduli (ADR-0001): un modulo può importare da un altro modulo
// SOLO il suo `index.ts` (API server), `domain/index.ts` (API pura) o `jobs.ts` (API per il worker, WP-020:
// niente componenti né Next.js, perché il worker gira fuori dal rendering).
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
      .flatMap((other) => [
        `./${other}/index.ts`,
        `./${other}/domain/index.ts`,
        `./${other}/jobs.ts`,
      ]),
  ],
  message:
    "Confine tra moduli (ADR-0001): importa solo `@/modules/<nome>`, `@/modules/<nome>/domain` o `@/modules/<nome>/jobs`.",
}));

// Le route (src/app) usano i moduli solo tramite le loro API pubbliche; il worker solo tramite `jobs.ts`
// (gli `index.ts` portano con sé componenti React e Next.js, che fuori dal rendering non si caricano).
const publicApiZones = [
  {
    target: "./src/app",
    from: "./src/modules",
    except: moduleNames.flatMap((name) => [`./${name}/index.ts`, `./${name}/domain/index.ts`]),
    message: "Usa solo l'API pubblica del modulo (`index.ts` o `domain/index.ts`).",
  },
  {
    target: "./src/worker",
    from: "./src/modules",
    except: moduleNames.flatMap((name) => [`./${name}/jobs.ts`, `./${name}/domain/index.ts`]),
    message: "Il worker usa solo `@/modules/<nome>/jobs` o `@/modules/<nome>/domain`.",
  },
];

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
    // 03-ARCHITETTURA §4: solo `modules/privacy` (e `lib/crypto`) decifrano dati personali; gli altri
    // moduli ricevono dati già autorizzati. Vale anche per il codice scritto dai modelli locali.
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
    ignores: ["src/modules/privacy/**", "src/lib/crypto/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/crypto",
              importNames: ["decryptPii"],
              message:
                "Solo `modules/privacy` decifra dati personali (03-ARCHITETTURA §4, ADR-0004): usa la sua API.",
            },
          ],
        },
      ],
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
