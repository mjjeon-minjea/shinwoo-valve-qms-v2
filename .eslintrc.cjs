module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:boundaries/recommended'
  ],
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    '.agent/',
    'scripts/',
    'uploads/',
    'api/',
    'vite.config.js',
    'tailwind.config.js',
    'postcss.config.js'
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: {
    react: { version: '18.2' },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx']
      }
    },
    'boundaries/elements': [
      {
        type: 'components',
        pattern: '**/src/components/**'
      },
      {
        type: 'lib',
        pattern: '**/src/lib/**'
      },
      {
        type: 'contexts',
        pattern: '**/src/contexts/**'
      },
      {
        type: 'data',
        pattern: '**/src/data/**'
      },
      {
        type: 'assets',
        pattern: '**/src/assets/**'
      },
      {
        type: 'root',
        pattern: 'src/*.jsx'
      },
      { type: 'config', pattern: '**/src/config/**' }
    ]
  },
  plugins: ['react-refresh', 'boundaries'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'no-unused-vars': 'warn',
    'react/prop-types': 'off',
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        message: '${file.type} 레이어는 ${dependency.type} 레이어를 참조(import)할 수 없습니다. 아키텍처 의존성 단방향 원칙을 준수하세요.',
        rules: [
          {
            from: 'components',
            allow: ['lib', 'contexts', 'data', 'components', 'assets', 'config']
          },
          {
            from: 'contexts',
            allow: ['lib', 'data', 'contexts']
          },
          {
            from: 'lib',
            allow: ['data', 'lib']
          },
          {
            from: 'data',
            allow: ['data']
          },
          {
            from: 'root',
            allow: ['components', 'contexts', 'lib', 'data', 'root', 'assets']
          }
        ]
      }
    ],
    'boundaries/no-unknown': 'error',
    'boundaries/no-unknown-files': 'warn'
  },
}
