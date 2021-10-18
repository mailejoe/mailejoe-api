import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
} from 'typeorm';

export class createAuditLog1634505712214 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'audit-log',
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
                    isNullable: true,
                },
                {
                    name: 'entity_id',
                    type: 'bigint',
                },
                {
                    name: 'entity_type',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'operation',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'info',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'generated_on',
                    type: 'timestamp',
                    default: 'NOW()',
                },
                {
                    name: 'generated_by',
                    type: 'bigint',
                },
                {
                    name: 'ip',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'country_code',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                },
            ]
        }), true);

        await queryRunner.createIndex('audit-log', new TableIndex({
            name: 'IDX_AUDIT_LOG_ORGANIZATION_ID',
            columnNames: ['organization_id'],
        }));

        await queryRunner.createForeignKey('audit-log', new TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organization',
            onDelete: 'CASCADE',
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('audit-log');
        const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('organization_id') !== -1);
        await queryRunner.dropForeignKey('audit-log', foreignKey);
        await queryRunner.dropIndex('audit-log', 'IDX_USER_ORGANIZATION_ID');
        await queryRunner.dropTable('audit-log');
    }

}
