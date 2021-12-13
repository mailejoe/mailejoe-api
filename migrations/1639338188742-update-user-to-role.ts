import {
    MigrationInterface,
    QueryRunner,
    TableColumn,
    TableIndex,
    TableForeignKey,
} from 'typeorm';

export class updateUserToRole1639338188742 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('user', new TableColumn({
            name: 'role_id',
            type: 'bigint',
        }));
        
        await queryRunner.createIndex('user', new TableIndex({
            name: 'IDX_USER_ROLE',
            columnNames: ['role_id'],
        }));

        await queryRunner.createForeignKey('user', new TableForeignKey({
            columnNames: ['role_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'role',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('user');
        const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('role_id') !== -1);
        await queryRunner.dropForeignKey('user', foreignKey);
        await queryRunner.dropIndex('user', 'IDX_USER_ROLE');
        await queryRunner.dropColumn('user', 'role_id');
    }

}
