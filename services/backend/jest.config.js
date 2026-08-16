export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@relay/shared-types$': '<rootDir>/../../packages/shared-types/dist/index.js',
    '^@relay/tool-schemas$': '<rootDir>/../../packages/tool-schemas/dist/index.js',
    '^@relay/config$': '<rootDir>/../../packages/config/dist/index.js',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
      },
    ],
  },
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  verbose: true,
};
