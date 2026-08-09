import js from "@eslint/js";
import checkFile from "eslint-plugin-check-file";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Layering follows bulletproof-react: shared code (components, hooks, lib,
// utils) -> features -> app, imports flowing left to right only. The zones
// are enforced with plain import patterns, which works because parent-
// relative imports are banned: everything crosses folders via @/ paths.
const noParentImports = {
  group: ["../*"],
  message: "Use @/ absolute imports instead of parent-relative paths.",
};

export default [
  { ignores: ["dist/", "node_modules/"] },

  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Teaches no-unused-vars that a component referenced in JSX is used, so
      // the rule can stay strict and still flag genuinely dead imports.
      "react/jsx-uses-vars": "error",
      "no-unused-vars": "error",
      "no-restricted-imports": ["error", { patterns: [noParentImports] }],
    },
  },

  {
    files: ["src/features/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noParentImports,
            {
              group: ["@/app/*"],
              message: "Features must not import from the app layer.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/components/**", "src/hooks/**", "src/lib/**", "src/utils/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noParentImports,
            {
              group: ["@/app/*", "@/features/*"],
              message:
                "Shared code must not reach into features or the app layer.",
            },
          ],
        },
      ],
    },
  },

  // Filenames and folders are kebab-case everywhere, so a moved file never
  // changes case convention along with its layer.
  {
    files: ["src/**/*"],
    plugins: { "check-file": checkFile },
    rules: {
      "check-file/filename-naming-convention": [
        "error",
        { "**/*.{js,jsx}": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],
      "check-file/folder-naming-convention": [
        "error",
        { "src/**/": "KEBAB_CASE" },
      ],
    },
  },

  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["scripts/**/*.ts", "test/**/*.ts"],
  })),
  {
    files: ["scripts/**/*.ts", "test/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
];
