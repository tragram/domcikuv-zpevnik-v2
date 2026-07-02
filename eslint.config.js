import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': 'warn'
    },
  },
  {
    // Web/worker boundary: client code may only value-import the typed API
    // client from the worker. Shared schemas/constants/types belong in src/lib
    // (see src/lib/contracts). Type-only imports are fine — they're erased at
    // build time and never pull server code into the bundle.
    files: ["src/web/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/worker/**", "!**/worker/api-client"],
              allowTypeImports: true,
              message:
                "Client code must not value-import worker modules (server SDKs end up in the bundle). Use `import type`, the api-client, or move the shared code to src/lib/contracts.",
            },
          ],
        },
      ],
    },
  },
  {
    // Mirror rule for the server: worker code must not depend on web app
    // modules (they can pull in browser-only code and create tangled
    // dependencies). Shared logic belongs in src/lib.
    files: ["src/worker/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/web/**"],
              allowTypeImports: true,
              message:
                "Worker code must not value-import web modules. Use `import type` or move the shared code to src/lib.",
            },
          ],
        },
      ],
    },
  },
);
