const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
module.exports = [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["src/**/*.jsx", "src/**/*.js"],
    languageOptions: { ecmaVersion: 2021, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // React 18+ নতুন JSX ট্রান্সফর্মে দরকার নেই
      "react/prop-types": "off",
    },
    settings: { react: { version: "detect" } },
  },
];
