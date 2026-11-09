import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Le préfixe _ marque une variable volontairement ignorée (ex. rest destructuring).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      // Invariant n°8 : jamais de dangerouslySetInnerHTML.
      "react/no-danger": "error",
      // Interdit aussi la propriété hors JSX (ex. spread d'objet de props).
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='dangerouslySetInnerHTML'], JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "dangerouslySetInnerHTML est interdit (CLAUDE.md, invariant n°8).",
        },
      ],
      // Frontière serveur : @/server/* est réservé au code serveur (liste blanche ci-dessous).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server", "@/server/*"],
              message: "Les modules @/server/* ne peuvent être importés que depuis src/server, les Route Handlers (src/app/api) ou le proxy/middleware.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/server/**",
      "src/app/api/**",
      "src/app/**/route.ts",
      "src/proxy.ts",
      "src/middleware.ts",
      "tests/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
