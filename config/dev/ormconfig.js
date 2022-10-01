import { DataSource } from 'typeorm';

const LocalDataSource = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: 5432,
  username: 'mjadmin',
  password: 'password',
  database: 'mailejoe',
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
  synchronize: false
});

export default LocalDataSource;