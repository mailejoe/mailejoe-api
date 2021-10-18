import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
} from 'typeorm';

export class createUserPwdHistory1634506413259 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'user-pwd-history',
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
                    name: 'pwd',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'last_used_on',
                    type: 'timestamp',
                    default: 'NOW()',
                },
            ]
        }), true);

        await queryRunner.createIndex('user-pwd-history', new TableIndex({
            name: 'IDX_USER_PWD_HISTORY_ORGANIZATION_ID',
            columnNames: ['organization_id'],
        }));

        await queryRunner.createIndex('user-pwd-history', new TableIndex({
            name: 'IDX_USER_PWD_HISTORY_USER_ID',
            columnNames: ['user_id'],
        }));

        await queryRunner.createForeignKey('user-pwd-history', new TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organization',
            onDelete: 'CASCADE',
        }));

        await queryRunner.createForeignKey('user-pwd-history', new TableForeignKey({
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('user-pwd-history');
        ['organization_id','user_id'].forEach(async (dfk) => {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf(dfk) !== -1);
            await queryRunner.dropForeignKey('user-pwd-history', foreignKey);
        });
        await queryRunner.dropIndex('user-pwd-history', 'IDX_USER_PWD_HISTORY_ORGANIZATION_ID');
        await queryRunner.dropIndex('user-pwd-history', 'IDX_USER_PWD_HISTORY_USER_ID');
        await queryRunner.dropTable('user-pwd-history');
    }

}
