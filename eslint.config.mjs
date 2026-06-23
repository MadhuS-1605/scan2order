import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The React-Compiler-era react-hooks rules (shipped as ERRORS by the latest
    // eslint-config-next) flag patterns that are correct at runtime here:
    // server-component `new Date()`, localStorage-hydration effects, and hoisted
    // helpers. Keep them as warnings — still surfaced in lint output — rather than
    // failing CI on working, pre-existing code. Revisit if adopting React Compiler.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
