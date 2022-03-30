import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
    TableForeignKey,
} from 'typeorm';

export class createEmail1648561639961 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'email',
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
                    name: 'email_address_id',
                    type: 'bigint',
                },
                {
                    name: 'subject',
                    type: 'varchar',
                    length: '1024',
                },
                {
                    name: 'content',
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

        await queryRunner.createIndex('email', new TableIndex({
            name: 'IDX_EMAIL_ORGANIZATION_ID',
            columnNames: ['organization_id'],
        }));

        await queryRunner.createIndex('email', new TableIndex({
            name: 'IDX_EMAIL_MAILBOX_ID',
            columnNames: ['mailbox_id'],
        }));

        await queryRunner.createIndex('email', new TableIndex({
            name: 'IDX_EMAIL_EMAIL_ADDRESS_ID',
            columnNames: ['email_address_id'],
        }));

        await queryRunner.createForeignKey('email', new TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organization',
            onDelete: 'CASCADE',
        }));

        await queryRunner.createForeignKey('email', new TableForeignKey({
            columnNames: ['mailbox_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'mailbox',
            onDelete: 'CASCADE',
        }));

        await queryRunner.createForeignKey('email', new TableForeignKey({
            columnNames: ['email_address_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'email-address',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('email');
        ['organization_id','mailbox_id','email_address_id'].forEach(async (dfk) => {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf(dfk) !== -1);
            await queryRunner.dropForeignKey('email', foreignKey);
        });
        await queryRunner.dropIndex('email', 'IDX_EMAIL_ORGANIZATION_ID');
        await queryRunner.dropIndex('email', 'IDX_EMAIL_MAILBOX_ID');
        await queryRunner.dropIndex('email', 'IDX_EMAIL_EMAIL_ADDRESS_ID');
        await queryRunner.dropTable('email');
    }

}
