import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
    TableForeignKey
} from 'typeorm';

export class createUser1634161018037 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'user',
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
            ]
        }), true)

        await queryRunner.createIndex('user', new TableIndex({
            name: 'IDX_USER_ORGANIZATION_ID',
            columnNames: ['organization_id'],
        }));

        await queryRunner.createForeignKey('user', new TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organization',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('user');
        const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('organization_id') !== -1);
        await queryRunner.dropForeignKey('user', foreignKey);
        await queryRunner.dropIndex('user', 'IDX_USER_ORGANIZATION_ID');
        await queryRunner.dropTable('user');
    }

}