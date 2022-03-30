import { Express } from 'express';
import axios from 'axios';
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
    const result = await axios.get('http://localhost:3000/ping');

    expect(result.status).toBe(200);
    expect(result.data).toBe('pong');
  });
})