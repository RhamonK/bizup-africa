// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge functions = runtime Deno (imports npm:), hors du graphe RN
    ignores: ["dist/*", "supabase/functions/*"],
  },
  {
    rules: {
      // L'app est en français — apostrophes/guillemets dans le JSX sont voulus
      "react/no-unescaped-entities": "off",
    },
  },
]);
