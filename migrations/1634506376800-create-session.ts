import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
} from 'typeorm';

export class createSession1634506376800 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'session',
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
                    name: 'user_id',
                    type: 'bigint',
                },
                {
                    name: 'unique_id',
                    type: 'varchar',
                    length: '1024',
                },
                {
                    name: 'mfa_state',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    default: 'NOW()',
                },
                {
                    name: 'last_activity_at',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'expires_at',
                    type: 'timestamp',
                },
                {
                    name: 'user_agent',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'ip',
                    type: 'varchar',
                    length: '255',
                },
            ]
        }), true);

        await queryRunner.createIndex('session', new TableIndex({
            name: 'IDX_SESSION_ORGANIZATION_ID',
            columnNames: ['organization_id'],
        }));

        await queryRunner.createIndex('session', new TableIndex({
            name: 'IDX_SESSION_USER_ID',
            columnNames: ['user_id'],
        }));

        await queryRunner.createForeignKey('session', new TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organization',
            onDelete: 'CASCADE',
        }));

        await queryRunner.createForeignKey('session', new TableForeignKey({
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('session');
        ['organization_id','user_id'].forEach(async (dfk) => {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf(dfk) !== -1);
            await queryRunner.dropForeignKey('session', foreignKey);
        });
        await queryRunner.dropIndex('session', 'IDX_SESSION_ORGANIZATION_ID');
        await queryRunner.dropIndex('session', 'IDX_SESSION_USER_ID');
        await queryRunner.dropTable('session');
    }

}
