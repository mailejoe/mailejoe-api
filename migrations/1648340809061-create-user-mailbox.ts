import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
    TableForeignKey,
} from 'typeorm';

export class createUserMailbox1648340809061 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'user-mailbox',
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
                    name: 'mailbox_id',
                    type: 'bigint',
                },
            ]
        }), true);

        await queryRunner.createIndex('user-mailbox', new TableIndex({
            name: 'IDX_USER_MAILBOX_USER_ID',
            columnNames: ['user_id'],
        }));

        await queryRunner.createIndex('user-mailbox', new TableIndex({
            name: 'IDX_USER_MAILBOX_MAILBOX_ID',
            columnNames: ['mailbox_id'],
        }));

        await queryRunner.createForeignKey('user-mailbox', new TableForeignKey({
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE',
        }));

        await queryRunner.createForeignKey('user-mailbox', new TableForeignKey({
            columnNames: ['mailbox_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'mailbox',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('user-mailbox');
        ['user_id','mailbox_id'].forEach(async (dfk) => {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf(dfk) !== -1);
            await queryRunner.dropForeignKey('user-mailbox', foreignKey);
        });
        await queryRunner.dropIndex('user-mailbox', 'IDX_USER_MAILBOX_USER_ID');
        await queryRunner.dropIndex('user-mailbox', 'IDX_USER_MAILBOX_MAILBOX_ID');
        await queryRunner.dropTable('user-mailbox');
    }

}
