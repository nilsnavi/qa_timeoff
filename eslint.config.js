const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

let reactHooks;
let reactRefresh;

try {
  reactHooks = require('eslint-plugin-react-hooks');
} catch {
  // Not installed — e.g. in backend-only CI
}
try {
  reactRefresh = require('eslint-plugin-react-refresh');
} catch {
  // Not installed
}

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // ── Global ignores ──────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.vite/**',
      '**/.turbo/**',
      '**/*.tsbuildinfo',
      '**/*.generated.*',
      '**/generated/**',
      '**/prisma/generated/**',
      '**/prisma/migrations/**',
      'vite.config.*',
      'vitest.config.*',
      'postcss.config.*',
      'tailwind.config.*',
    ],
  },

  // ── Base recommended rules ──────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── TypeScript common rules ─────────────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'off',
    },
  },

  // ── Frontend React-specific rules ────────────────────────────────
  ...(reactHooks
    ? [
        {
          files: ['apps/frontend/**/*.{ts,tsx}'],
          plugins: {
            'react-hooks': reactHooks,
          },
          rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
          },
        },
      ]
    : []),
  ...(reactRefresh
    ? [
        {
          files: ['apps/frontend/**/*.{ts,tsx}'],
          plugins: {
            'react-refresh': reactRefresh,
          },
          rules: {
            'react-refresh/only-export-components': [
              'warn',
              { allowConstantExport: true },
            ],
          },
        },
      ]
    : []),
];
