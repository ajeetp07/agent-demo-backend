const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const EXAMPLE_ENV_PATH = path.resolve(".", `.env.example`);
const ENV_PATH = path.resolve(
  ".",
  process.env.NODE_ENV === "test"
    ? ".env.spec"
    : process.env.NODE_ENV === "development"
      ? ".env.development"
      : ".env",
);

const loadEnv = () => {
  //parsing both env files
  const exampleEnv = dotenv.parse(fs.readFileSync(EXAMPLE_ENV_PATH));
  const env = dotenv.parse(fs.readFileSync(ENV_PATH));

  //checking missing values
  const missingFromEnv = difference(Object.keys(exampleEnv), Object.keys(env));
  const missingFromEnvExample = difference(
    Object.keys(env),
    Object.keys(exampleEnv),
  );

  showMessage(missingFromEnv, missingFromEnvExample);
};

const difference = (arrA, arrB) => {
  return arrA.filter((a) => arrB.indexOf(a) < 0);
};

const showMessage = (missingFromEnv, missingFromEnvExample) => {
  console.log("");
  if (missingFromEnv.length > 0 || missingFromEnvExample.length > 0) {
    console.log("\x1b[41m%s\x1b[0m", "  Env Check: Failed  ");
    if (missingFromEnvExample.length > 0) {
      console.log("\x1b[33m%s\x1b[0m", "  Missing:", missingFromEnvExample);
      console.log("\x1b[33m%s\x1b[0m", "  From:", EXAMPLE_ENV_PATH);
      console.log("");
    }
    if (missingFromEnv.length > 0) {
      console.log("\x1b[33m%s\x1b[0m", "  Missing:", missingFromEnv);
      console.log("\x1b[33m%s\x1b[0m", "  From:", ENV_PATH);
      console.log("");
    }
    throw new Error("Check env files!");
  } else {
    console.log("\x1b[42m%s\x1b[0m", "  Env Check: Passed  ");
    console.log("");
  }
};

loadEnv();
