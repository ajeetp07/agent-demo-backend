export default {
  "**/*.ts": ["eslint .", "npx prettier --ignore-path .gitignore --write"],
  "**/*.{js,json,md}": ["prettier --ignore-path .gitignore --write"],
};
