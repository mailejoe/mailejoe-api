import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
    TableForeignKey
} from 'typeorm';

export class createRolePermission1639277934006 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'role-permission',
            columns: [
                {
                    name: 'id',
                    type: 'bigint',
                    isPrimary: true,
                    isGenerated: true,
                },
                {
                    name: 'role_id',
                    type: 'bigint',
                },
                {
                    name: 'permission',
                    type: 'varchar',
                    length: '1024',
                },
            ]
        }), true);

        await queryRunner.createIndex('role-permission', new TableIndex({
            name: 'IDX_ROLE_PERMISSION_ROLE_ID',
            columnNames: ['role_id'],
        }));

        await queryRunner.createForeignKey('role-permission', new TableForeignKey({
            columnNames: ['role_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'role',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('role-permission');
        const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('role_id') !== -1);
        await queryRunner.dropForeignKey('role-permission', foreignKey);
        await queryRunner.dropIndex('role-permission', 'IDX_ROLE_PERMISSION_ROLE_ID');
        await queryRunner.dropTable('role-permission');
    }

}
