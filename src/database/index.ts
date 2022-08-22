import { DataSource } from 'typeorm';
import { types } from 'pg';

import { isDevelopment, isTest } from '../utils/env';

let dataSource: DataSource;

types.setTypeParser(types.builtins.INT8, (value: string): number => parseFloat(value));

export const establishDatabaseConnection = async (): Promise<DataSource> => {
  try {
    dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        entities: [
          __dirname + '/../entity/*.ts'
        ],
        synchronize: false,
        logging: process.env.NODE_ENV === 'prod' ? ['error'] : ['query', 'error'],
        extra: {
          min: 2,
          max: isDevelopment() || isTest() ? 50 : 2,
          connectionTimeoutMillis: 2000,
          idleTimeoutMillis: 30000,
        }
    });
    await dataSource.initialize();
    return dataSource;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export const getDataSource = (): DataSource => {
  return dataSource;
}