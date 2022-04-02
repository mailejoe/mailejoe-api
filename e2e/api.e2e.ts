import { GenericContainer, Wait } from 'testcontainers';
import { runServer, stopServer } from '../src/main';
import axios from 'axios';
import { DataSource } from 'typeorm';
import * as Chance from 'chance';

import { User, UserPwdHistory } from '../src/entity';

const chance = new Chance();

describe('integration', () => {
  let container,
      dataSource;
  
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

    dataSource = new DataSource({
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
      synchronize: false,
      logging: 'all'
    });

    await dataSource.initialize();
    
    await dataSource.runMigrations({
      transaction: 'each',
    });

    await runServer();

    await new Promise(r => setTimeout(r, 5000));
  });

  afterAll(async () => {
    await dataSource.destroy();

    await new Promise(r => setTimeout(r, 5000));
    
    await stopServer();
    await container.stop();
  });

  describe('ping', () => {

    it ('should return 200 and pong response', async () => {
      const response = await axios({
        url: 'http://localhost:3000/ping',
        method: 'get',
      });
      expect(response.status).toBe(200);
      expect(response.data).toBe('pong');
    });

  });

  describe('auth', () => {
    let email;

    describe('/setup', () => {
      let orgName;

      it ('should return 200 and generate a new organization', async () => {
        orgName = chance.string();
        email = chance.email();
        const response = await axios({
          url: '/setup',
          method: 'post',
          data: {
            name: orgName,
            firstName: chance.string(),
            lastName: chance.string(),
            email,
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(204);
      });

      it ('should return 400 when org name is not unique', async () => {
        try {
          await axios({
            url: '/setup',
            method: 'post',
            data: {
              name: orgName,
              firstName: chance.string(),
              lastName: chance.string(),
              email: chance.email(),
            },
            headers: {'Content-Type': 'application/json'}
          });
        } catch(err) {
          expect(err.response.status).toBe(400);
          expect(err.response.data).toStrictEqual({ error: 'Organization name must be unique' });
        }
      });

      it ('should return 400 when email address is not unique', async () => {
        try {
          await axios({
            url: '/setup',
            method: 'post',
            data: {
              name: chance.string(),
              firstName: chance.string(),
              lastName: chance.string(),
              email: email,
            },
            headers: {'Content-Type': 'application/json'}
          });
        } catch(err) {
          expect(err.response.status).toBe(400);
          expect(err.response.data).toStrictEqual({ error: 'Email must be unique' });
        }
      });

    });

    describe('/reset-password', () => {
      it ('should return 403 if token does not match', async () => {
        const response = await axios({
          url: `/reset-password?token=${chance.string()}`,
          method: 'post',
          data: {
            password: chance.string(),
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(403);
        expect(response.data).toBe('Unauthorized');
      });

      it ('should return 200 and reset the password', async () => {
        const user = await dataSource.manager.findOne(User, { where: { email } });

        const response = await axios({
          url: `/reset-password?token=${user.resetToken}`,
          method: 'post',
          data: {
            password: 'th3yIOp9!!pswYY#',
          },
          headers: {'Content-Type': 'application/json'}
        });
        expect(response.status).toBe(200);
        expect(response.data).toBe('Your password has been successfully updated.');
      });

    });

    describe('/login', () => {


    });

    describe('/mfa', () => {


    });
  });
});