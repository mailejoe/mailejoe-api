import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
    TableForeignKey,
} from 'typeorm';

export class createEmailAddress1647306965575 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'email-address',
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
                    name: 'mailbox_id',
                    type: 'bigint',
                },
                {
                    name: 'address',
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

        await queryRunner.createIndex('email-address', new TableIndex({
            name: 'IDX_EMAIL_ADDRESS_ORGANIZATION_ID',
            columnNames: ['organization_id'],
        }));

        await queryRunner.createIndex('email-address', new TableIndex({
            name: 'IDX_EMAIL_ADDRESS_MAILBOX_ID',
            columnNames: ['mailbox_id'],
        }));

        await queryRunner.createForeignKey('email-address', new TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organization',
            onDelete: 'CASCADE',
        }));

        await queryRunner.createForeignKey('email-address', new TableForeignKey({
            columnNames: ['mailbox_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'mailbox',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('email-address');
        ['organization_id','mailbox_id'].forEach(async (dfk) => {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf(dfk) !== -1);
            await queryRunner.dropForeignKey('email-address', foreignKey);
        });
        await queryRunner.dropIndex('email-address', 'IDX_EMAIL_ADDRESS_ORGANIZATION_ID');
        await queryRunner.dropIndex('email-address', 'IDX_EMAIL_ADDRESS_MAILBOX_ID');
        await queryRunner.dropTable('email-address');
    }

}
