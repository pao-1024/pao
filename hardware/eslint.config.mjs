import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig([
  globalIgnores(["dist/**", "checks/**", ".tscircuit/**", "vendor/**"]),
  {
    files: ["**/*.{ts,tsx,mjs}"],
    extends: [js.configs.recommended],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
])
