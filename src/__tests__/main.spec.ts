import { Server } from '@hapi/hapi';
import { runServer, stopServer } from '../main';

let server: Server;

beforeAll(async () => {
  server = await runServer();
})

afterAll(async () => {
  await stopServer(server);
});

describe('run server smoke test', () => {
  it('ping responds', async () => {
    const res = await server.inject({
        method: 'get',
        url: '/ping'
    });
    expect(res.statusCode).toBe(200);
    expect(res.result).toBe('ping');
  });
})