import {
  validate,
} from '../validate';
import { Chance } from 'chance';
import { configure } from 'i18n';
import { join } from 'path';

configure({
  locales: ['en', 'es'],
  directory: join(__dirname, '/../../locales'),
  defaultLocale: 'en',
  objectNotation: true,
  retryInDefaultLocale: true,
  updateFiles: false,
});

const chance = new Chance();

describe('validate', () => {
  let expectedField;

  beforeEach(() => {
    jest.resetModules();
    expectedField = chance.string({ symbols: false });
  });

  describe('a single string validation', () => {
    it('should return an error message when simple validation fails', () => {
      expect(validate([{ validations: ['isRequired'], locale: 'en', val: null, field: expectedField }])).toBe(`The \`${expectedField}\` field is required.`);
    });

    it('should return null when simple validation passes', () => {
      expect(validate([{ validations: ['isRequired'], locale: 'en', val: chance.string(), field: expectedField }])).toBe(null);
    });
  });

  describe('an object validation', () => {
    it('should return an error message when simple validation fails', () => {
      expect(validate([{ validations: [{ type: 'isRequired' }], locale: 'en', val: null, field: expectedField }])).toBe(`The \`${expectedField}\` field is required.`);
    });

    it('should return null when simple validation passes', () => {
      expect(validate([{ validations: [{ type: 'isRequired' }], locale: 'en', val: chance.string(), field: expectedField }])).toBe(null);
    });

    it('should return null when simple validation passes with extra parameters passed to the validation fn', () => {
      expect(validate([{ validations: [{ type: 'isLength', min: 1, max: 100 }], locale: 'en', val: chance.string(), field: expectedField }])).toBe(null);
    });
  });

  it('should return null when a mix of string and object validations all pass', () => {
    expect(validate([{ validations: ['isRequired','isString',{ type: 'isLength', min: 1, max: 100 }], locale: 'en', val: chance.string(), field: expectedField }])).toBe(null);
  });

  it('should return an error message when a validation within a mix of string and object validations fails', () => {
    expect(validate([{ validations: ['isRequired','isString',{ type: 'isLength', min: 1, max: 100 }], locale: 'en', val: 100, field: expectedField }])).toBe(`The \`${expectedField}\` field must be a string value.`);
  });

  it('isRequired', () => {
    expect(validate([{ validations: ['isRequired'], locale: 'en', val: null, field: expectedField }])).toBe(`The \`${expectedField}\` field is required.`);
    expect(validate([{ validations: ['isRequired'], locale: 'en', val: undefined, field: expectedField }])).toBe(`The \`${expectedField}\` field is required.`);
    expect(validate([{ validations: ['isRequired'], locale: 'en', val: false, field: expectedField }])).toBe(null);
    expect(validate([{ validations: ['isRequired'], locale: 'en', val: 0, field: expectedField }])).toBe(null);
    expect(validate([{ validations: ['isRequired'], locale: 'en', val: '', field: expectedField }])).toBe(null);
    expect(validate([{ validations: ['isRequired'], locale: 'en', val: [], field: expectedField }])).toBe(null);
    expect(validate([{ validations: ['isRequired'], locale: 'en', val: {}, field: expectedField }])).toBe(null);
    expect(validate([{ validations: ['isRequired'], locale: 'en', val: chance.string(), field: expectedField }])).toBe(null);
  });

  it('isString', () => {
    expect(validate([{ validations: ['isString'], locale: 'en', val: null, field: expectedField }])).toBe(`The \`${expectedField}\` field must be a string value.`);
    expect(validate([{ validations: ['isString'], locale: 'en', val: undefined, field: expectedField }])).toBe(`The \`${expectedField}\` field must be a string value.`);
    expect(validate([{ validations: ['isString'], locale: 'en', val: false, field: expectedField }])).toBe(`The \`${expectedField}\` field must be a string value.`);
    expect(validate([{ validations: ['isString'], locale: 'en', val: 0, field: expectedField }])).toBe(`The \`${expectedField}\` field must be a string value.`);
    expect(validate([{ validations: ['isString'], locale: 'en', val: '', field: expectedField }])).toBe(null);
    expect(validate([{ validations: ['isString'], locale: 'en', val: [], field: expectedField }])).toBe(`The \`${expectedField}\` field must be a string value.`);
    expect(validate([{ validations: ['isString'], locale: 'en', val: {}, field: expectedField }])).toBe(`The \`${expectedField}\` field must be a string value.`);
    expect(validate([{ validations: ['isString'], locale: 'en', val: chance.string(), field: expectedField }])).toBe(null);
  });
});