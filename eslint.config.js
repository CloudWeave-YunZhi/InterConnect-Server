import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // 4格缩进，级别为 'warn' (警告)
      "indent": ["warn", 4],
      
      // 强制不使用分号，级别为 'warn'
      "semi": ["warn", "always"],
      
      // 强制使用单引号（推荐配套，保持整洁）
      "quotes": ["warn", "single"],
      
      // 解决 TS 相关的特定规则冲突
      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn"]
    },
  },
  {
    // 忽略构建目录
    ignores: ["dist/**", "node_modules/**"]
  }
];