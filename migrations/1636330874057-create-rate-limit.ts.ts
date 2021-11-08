import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
} from 'typeorm';

export class createRateLimit1636330874057 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'rate-limit',
            columns: [
                {
                    name: 'id',
                    type: 'bigint',
                    isPrimary: true,
                    isGenerated: true,
                },
                {
                    name: 'user_id',
                    type: 'bigint',
                },
                {
                    name: 'client_identifier',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'route',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'call_count',
                    type: 'bigint',
                },
                {
                    name: 'first_called_on',
                    type: 'timestamp',
                },
            ]
        }), true);

        await queryRunner.createIndex('rate-limit', new TableIndex({
            name: 'IDX_RATE_LIMIT_USER_ID',
            columnNames: ['user_id'],
        }));

        await queryRunner.createForeignKey('rate-limit', new TableForeignKey({
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('rate-limit');
        ['user_id'].forEach(async (dfk) => {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf(dfk) !== -1);
            await queryRunner.dropForeignKey('user-pwd-history', foreignKey);
        });
        await queryRunner.dropIndex('rate-limit', 'IDX_RATE_LIMIT_USER_ID');
        await queryRunner.dropTable('rate-limit');
    }

}
