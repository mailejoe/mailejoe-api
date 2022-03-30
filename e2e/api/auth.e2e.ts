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
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('done3');
    await stopServer();
    console.log('done4');
    await container.stop();
    console.log('done5');
  });

  describe('setupOrganization', () => {

    it ('should return 200 and generate a new organization', async () => {
      const response = await axios({
        url: '/setup',
        method: 'post',
        data: {
          name: chance.string(),
          firstName: chance.string(),
          lastName: chance.string(),
          email: chance.email(),
        },
        headers: {'Content-Type': 'application/json'}
      });
      console.log('done');
      expect(response.status).toBe(204);
      console.log('done2');
    });

  });
});