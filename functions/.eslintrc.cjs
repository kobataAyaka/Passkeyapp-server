module.exports = {
  env: {
    es6: true,
    node: true,
  },
  // parser: "@babel/eslint-parser",
  parserOptions: {
    "ecmaVersion": 2022,
    "sourceType": "script",
    requireConfigFile: false,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "max-len": ["warn", { "code": 120 }],
  "no-unused-vars": "warn",
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
