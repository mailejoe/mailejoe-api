module.exports = {
  preset: 'ts-jest',
  //globalSetup: './jest.global-setup.ts',
  //globalTeardown: './jest.global-teardown.ts',
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleFileExtensions: [
    'js',
    'json',
    'ts'
  ],
  rootDir: '.',
  testRegex: '.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  coverageDirectory: './coverage',
  testEnvironment: 'node'
};
