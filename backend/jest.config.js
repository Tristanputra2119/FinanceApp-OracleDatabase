/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './',

  // Where Jest looks for tests
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  // Transform TypeScript via ts-jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        diagnostics: false
      }
    ]
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Bootstrap env vars before any test file loads
  setupFiles: ['<rootDir>/tests/setup.ts'],

  // Coverage
  collectCoverageFrom: [
    'controllers/**/*.ts',
    'middleware/**/*.ts',
    '!**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  verbose: true,
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true
};
