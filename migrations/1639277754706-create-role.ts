import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
    TableForeignKey
} from 'typeorm';

export class createRole1639277754706 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'role',
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
                    name: 'name',
                    type: 'varchar',
                    length: '1024',
                },
                {
                    name: 'description',
                    type: 'varchar',
                    length: '1024',
                },
                {
                    name: 'archived',
                    type: 'boolean',
                    default: false,
                },
            ]
        }), true);

        await queryRunner.createIndex('role', new TableIndex({
            name: 'IDX_ROLE_ORGANIZATION_ID',
            columnNames: ['organization_id'],
        }));

        await queryRunner.createForeignKey('role', new TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organization',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('role');
        const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('organization_id') !== -1);
        await queryRunner.dropForeignKey('role', foreignKey);
        await queryRunner.dropIndex('role', 'IDX_ROLE_ORGANIZATION_ID');
        await queryRunner.dropTable('role');
    }

}