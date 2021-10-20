import {
  isDevelopment,
  isProduction,
  isTest
} from '../env';

describe('env utility', () => {
  const OLD_ENV = process.env;
  
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('isTest', () => {
    it('should handle when NODE_ENV is not defined', () => {
      process.env.NODE_ENV = undefined;
      expect(isTest()).toBeUndefined();
    });
  
    it('should handle when NODE_ENV contains the test keyword', () => {
      process.env.NODE_ENV = 'sometestsome';
      expect(isTest()).toBe(true);
    });
  
    it('should handle NODE_ENV not being case sensitive', () => {
      process.env.NODE_ENV = 'TeSt';
      expect(isTest()).toBe(true);
    });
  
    it('should handle NODE_ENV not containing test', () => {
      process.env.NODE_ENV = 'dev';
      expect(isTest()).toBe(false);
    });
  });
  
  describe('isDevelopment', () => {
    it('should handle when NODE_ENV is not defined', () => {
      process.env.NODE_ENV = undefined;
      expect(isDevelopment()).toBeUndefined();
    });
  
    it('should handle when NODE_ENV contains the dev keyword', () => {
      process.env.NODE_ENV = 'somedevsome';
      expect(isDevelopment()).toBe(true);
    });
  
    it('should handle NODE_ENV not being case sensitive', () => {
      process.env.NODE_ENV = 'DeV';
      expect(isDevelopment()).toBe(true);
    });
  
    it('should handle NODE_ENV not containing dev', () => {
      process.env.NODE_ENV = 'test';
      expect(isDevelopment()).toBe(false);
    });
  });
  
  describe('isProduction', () => {
    it('should handle when NODE_ENV is not defined', () => {
      process.env.NODE_ENV = undefined;
      expect(isProduction()).toBeUndefined();
    });
  
    it('should handle when NODE_ENV contains the prod keyword', () => {
      process.env.NODE_ENV = 'someprodsome';
      expect(isProduction()).toBe(true);
    });
  
    it('should handle NODE_ENV not being case sensitive', () => {
      process.env.NODE_ENV = 'pROd';
      expect(isProduction()).toBe(true);
    });
  
    it('should handle NODE_ENV not containing prod', () => {
      process.env.NODE_ENV = 'dev';
      expect(isProduction()).toBe(false);
    });
  });  
});
