module.exports = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleFileExtensions: [
    'js',
    'json',
    'ts'
  ],
  rootDir: '.',
  testRegex: '.e2e.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  testEnvironment: 'node'
};
