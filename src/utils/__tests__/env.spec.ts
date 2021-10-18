import {
  isDevelopment,
  isProduction,
  isTest
} from '../env';

describe('isTest', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });
  
  test('should handle when NODE_ENV is not defined', () => {
    process.env.NODE_ENV = undefined;
    expect(isTest()).toBeUndefined();
  });

  test('should handle when NODE_ENV contains the test keyword', () => {
    process.env.NODE_ENV = 'sometestsome';
    expect(isTest()).toBe(true);
  });

  test('should handle NODE_ENV not being case sensitive', () => {
    process.env.NODE_ENV = 'TeSt';
    expect(isTest()).toBe(true);
  });

  test('should handle NODE_ENV not containing test', () => {
    process.env.NODE_ENV = 'dev';
    expect(isTest()).toBe(false);
  });
});

describe('isDevelopment', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });
  
  test('should handle when NODE_ENV is not defined', () => {
    process.env.NODE_ENV = undefined;
    expect(isDevelopment()).toBeUndefined();
  });

  test('should handle when NODE_ENV contains the dev keyword', () => {
    process.env.NODE_ENV = 'somedevsome';
    expect(isDevelopment()).toBe(true);
  });

  test('should handle NODE_ENV not being case sensitive', () => {
    process.env.NODE_ENV = 'DeV';
    expect(isDevelopment()).toBe(true);
  });

  test('should handle NODE_ENV not containing dev', () => {
    process.env.NODE_ENV = 'test';
    expect(isDevelopment()).toBe(false);
  });
});

describe('isProduction', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });
  
  test('should handle when NODE_ENV is not defined', () => {
    process.env.NODE_ENV = undefined;
    expect(isProduction()).toBeUndefined();
  });

  test('should handle when NODE_ENV contains the prod keyword', () => {
    process.env.NODE_ENV = 'someprodsome';
    expect(isProduction()).toBe(true);
  });

  test('should handle NODE_ENV not being case sensitive', () => {
    process.env.NODE_ENV = 'pROd';
    expect(isProduction()).toBe(true);
  });

  test('should handle NODE_ENV not containing prod', () => {
    process.env.NODE_ENV = 'dev';
    expect(isProduction()).toBe(false);
  });
});

