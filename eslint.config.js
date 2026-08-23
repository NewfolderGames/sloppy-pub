import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	globalIgnores(["dist"]),
	{
		files: ["**/*.{js,jsx,ts,tsx}"],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
			stylistic.configs.customize({
				quotes: "double",
				commaDangle: "always-multiline",
				indent: "tab",
				semi: true,
				jsx: true,
			}),
		],
		languageOptions: {
			ecmaVersion: 2024,
			globals: globals.browser,
		},
		rules: {
			"@stylistic/no-trailing-spaces": "off",
			"@stylistic/padded-blocks": "off",
			"@stylistic/spaced-comment": "off",
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
]);
