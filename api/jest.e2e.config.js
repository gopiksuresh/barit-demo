/** API e2e tests - run against TEST_DATABASE_URL (barit_test), migrated in globalSetup. */
module.exports = {
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/global-setup.js',
  setupFiles: ['<rootDir>/test/env.js'],
  testTimeout: 30000,
};
