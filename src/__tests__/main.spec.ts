import { Express } from 'express';
import * as request from 'supertest';
import { runServer, stopServer } from '../main';

let server: Express;

beforeAll(async () => {
  server = await runServer();
})

afterAll(async () => {
  await stopServer();
});

describe('run server smoke test', () => {
  it('ping responds', async () => {
    const result = await request(server).get('/ping').send();

    expect(result.statusCode).toBe(200);
    expect(result.text).toBe('pong');
  });
})