// ESLint v9 ফ্ল্যাট কনফিগ
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { sourceType: "module", ecmaVersion: 2021 } },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",   // NestJS-এ req/res প্রায়ই any; এই প্রজেক্টে ইচ্ছাকৃতভাবে বন্ধ
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
    },
  },
];
