import { GenericContainer, Wait } from 'testcontainers';
import { runServer, stopServer } from '../../src/main';
import axios from 'axios';
import { createConnection } from 'typeorm';
import * as Chance from 'chance';

const chance = new Chance();

describe('auth', () => {
  let container;
  
  beforeAll(async () => {
    axios.defaults.baseURL = 'http://localhost:3000/api/v1';

    container = await new GenericContainer('postgres')
      .withExposedPorts({
        container: 5432,
        host: 5000
      })
      .withEnv('TZ', 'America/Chicago')
      .withEnv('PGTZ', 'America/Chicago')
      .withEnv('POSTGRES_USER', 'mjadmin')
      .withEnv('POSTGRES_PASSWORD', 'password')
      .withEnv('POSTGRES_DB', 'mailejoe')
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
      .start();

    await new Promise(r => setTimeout(r, 5000));

    const connection = await createConnection({
      type: 'postgres',
      username: 'mjadmin',
      password: 'password',
      database: 'mailejoe',
      port: 5000,
      host: '127.0.0.1',
      migrationsTableName: 'mailejoe_migrations',
      entities: [
        'src/entity/*.ts'
      ],
      migrations: [
        'migrations/*.ts'
      ],
      cli: {
        migrationsDir: 'migrations'
      },
      synchronize: false,
      logging: 'all'
    });
    
    await connection.runMigrations({
      transaction: 'each',
    });

    await connection.close();

    await runServer();

    await new Promise(r => setTimeout(r, 5000));
  });

  afterAll(async () => {
    await stopServer();
    await container.stop();
  });

  describe('setupOrganization', () => {

    it ('should return 400 on empty payload', async () => {
      try {
        await axios({
          url: '/setup',
          method: 'post',
          data: {},
          headers: {'Content-Type': 'application/json'}
        });
      } catch (err) {
        expect(err.response.status).toBe(400);
        expect(err.response.data).toBe({ error: 'The `name` field is required.' });
      }
    });

    it ('should return 400 on missing firstName field', async () => {
      try {
        await axios({
          url: '/setup',
          method: 'post',
          data: { name: chance.string() },
          headers: {'Content-Type': 'application/json'}
        });
      } catch (err) {
        expect(err.response.status).toBe(400);
        expect(err.response.data).toBe({ error: 'The `firstName` field is required.' });
      }
    });

    it ('should return 400 on missing lastName field', async () => {
      try {
        await axios({
          url: '/setup',
          method: 'post',
          data: { name: chance.string(), firstName: chance.string() },
          headers: {'Content-Type': 'application/json'}
        });
      } catch (err) {
        expect(err.response.status).toBe(400);
        expect(err.response.data).toBe({ error: 'The `lastName` field is required.' });
      }
    });

    it ('should return 400 on missing email field', async () => {
      try {
        await axios({
          url: '/setup',
          method: 'post',
          data: { name: chance.string(), firstName: chance.string(), lastName: chance.string() },
          headers: {'Content-Type': 'application/json'}
        });
      } catch (err) {
        expect(err.response.status).toBe(400);
        expect(err.response.data).toBe({ error: 'The `email` field is required.' });
      }
    });

  });
});