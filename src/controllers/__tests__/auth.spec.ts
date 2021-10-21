import { Chance } from 'chance';
import { Express } from 'express';
import * as request from 'supertest';
import * as typeorm from 'typeorm';

import { runServer, stopServer } from '../../main';

const chance = new Chance();
const findOne = jest.fn();
const mockEntityManager = { findOne };

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getManager: jest.fn(() => mockEntityManager),
  }
});

let server: Express;

beforeAll(async () => {
  server = await runServer();
})

afterAll(async () => {
  await stopServer();
});

describe('auth', () => {
  describe('setupOrganization', () => {
    const fields = ['orgName','firstName','lastName','email'];
    
    fields.forEach((field, index) => {
      let previousObj = {};
      let i = index - 1;
      while (i >= 0) {
        previousObj[fields[i]] = chance.string();
        i--;
      }

      it(`should return a 400 error if ${field} does not exist`, async () => {
        const result = await request(server).post('/setup').send(previousObj);

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field is required.`);
      });

      it(`should return a 400 error if ${field} is not defined`, async () => {
        const result = await request(server).post('/setup').send({ [field]: null, ...previousObj });

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field is required.`);
      });

      it(`should return a 400 error if ${field} is not a string`, async () => {
        const result = await request(server).post('/setup').send({ [field]: 1, ...previousObj });

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field must be a string value.`);
      });

      it(`should return a 400 error if ${field} exceeds the string length limit`, async () => {
        const result = await request(server).post('/setup').send({ [field]: new Array(field !== 'email' ? 300 : 1050).join('a'), ...previousObj });

        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe(`The \`${field}\` field must be between 1 and ${field !== 'email' ? 255 : 1024} characters in length.`);
      });

      if (field === 'email') {
        it(`should return a 400 error if ${field} is not a valid email string`, async () => {
          const result = await request(server).post('/setup').send({ [field]: chance.string(), ...previousObj });
  
          expect(result.statusCode).toBe(400);
          expect(result.body.error).toBe(`The \`${field}\` field must be a valid email identifier.`);
        });
      }
    });

    it(`should return a 400 error if orgName is not unique`, async () => {
      findOne.mockReturnValueOnce(true);
      
      const result = await request(server).post('/setup').send({ orgName: chance.string(), firstName: chance.string(), lastName: chance.string(), email: chance.email() });

      expect(result.statusCode).toBe(400);
      expect(result.body.error).toBe('Organization name must be unique');
    });

    it(`should return a 400 error if email is not unique`, async () => {
      findOne.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      const result = await request(server).post('/setup').send({ orgName: chance.string(), firstName: chance.string(), lastName: chance.string(), email: chance.email() });

      expect(result.statusCode).toBe(400);
      expect(result.body.error).toBe('Email must be unique');
    });
  });
});