import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
} from 'typeorm';

export class createUserAccessHistory1634506376939 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'user-access-history',
            columns: [
                {
                    name: 'id',
                    type: 'bigint',
                    isPrimary: true,
                    isGenerated: true,
                },
                {
                    name: 'organization_id',
                    type: 'bigint',
                },
                {
                    name: 'session_id',
                    type: 'bigint',
                },
                {
                    name: 'user_id',
                    type: 'bigint',
                },
                {
                    name: 'programmatic',
                    type: 'boolean',
                },
                {
                    name: 'ip',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'operating_system',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'mobile',
                    type: 'boolean',
                    isNullable: true,
                },
                {
                    name: 'platform',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'engine_name',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'engine_version',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'browser_name',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'browser_version',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'localization',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'country_code',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                },
                {
                    name: 'region',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'city',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'latitude',
                    type: 'float8',
                    isNullable: true,
                },
                {
                    name: 'longitude',
                    type: 'float8',
                    isNullable: true,
                },
                {
                    name: 'login',
                    type: 'timestamp',
                },
            ]
        }), true);

        await queryRunner.createIndex('user-access-history', new TableIndex({
            name: 'IDX_USER_ACCESS_HISTORY_ORGANIZATION_ID',
            columnNames: ['organization_id'],
        }));

        await queryRunner.createIndex('user-access-history', new TableIndex({
            name: 'IDX_USER_ACCESS_HISTORY_SESSION_ID',
            columnNames: ['session_id'],
        }));

        await queryRunner.createIndex('user-access-history', new TableIndex({
            name: 'IDX_USER_ACCESS_HISTORY_USER_ID',
            columnNames: ['user_id'],
        }));

        await queryRunner.createForeignKey('user-access-history', new TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organization',
            onDelete: 'CASCADE',
        }));

        await queryRunner.createForeignKey('user-access-history', new TableForeignKey({
            columnNames: ['session_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'session',
            onDelete: 'CASCADE',
        }));

        await queryRunner.createForeignKey('user-access-history', new TableForeignKey({
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('user-access-history');
        ['organization_id','session_id','user_id'].forEach(async (dfk) => {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf(dfk) !== -1);
            await queryRunner.dropForeignKey('user-access-history', foreignKey);
        });
        await queryRunner.dropIndex('user-access-history', 'IDX_USER_ACCESS_HISTORY_ORGANIZATION_ID');
        await queryRunner.dropIndex('user-access-history', 'IDX_USER_ACCESS_HISTORY_SESSION_ID');
        await queryRunner.dropIndex('user-access-history', 'IDX_USER_ACCESS_HISTORY_USER_ID');
        await queryRunner.dropTable('user-access-history');
    }

}
