import { Express } from 'express';
import * as request from 'supertest';
import { runServer, stopServer } from '../../main';

let server: Express;

beforeAll(async () => {
  server = await runServer();
})

afterAll(async () => {
  await stopServer();
});

describe('auth', () => {
  it('setupOrganization', async () => {
    const result = await request(server).post('/setup').send();

    expect(result.statusCode).toBe(400);
    expect(result.text).toBe('The `orgName` field is required.');
  });
})