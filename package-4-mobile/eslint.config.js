const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
module.exports = [
  { ignores: ["node_modules/**", ".expo/**"] },
  {
    files: ["*.js", "lib/**/*.js"],
    languageOptions: { ecmaVersion: 2021, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-undef": "off", // React Native গ্লোবাল (fetch, FormData ইত্যাদি) এনভায়রনমেন্ট-নির্ভর
    },
    settings: { react: { version: "detect" } },
  },
];
