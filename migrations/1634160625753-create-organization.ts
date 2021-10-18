import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
} from 'typeorm';

export class createOrganization1634160625753 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'organization',
            columns: [
                {
                    name: 'id',
                    type: 'bigint',
                    isPrimary: true,
                    isGenerated: true,
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'unique_id',
                    type: 'varchar',
                    length: '1024',
                },
                {
                    name: 'session_key',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'session_key_last_rotation',
                    type: 'timestamp',
                    default: 'now()',
                },
                {
                    name: 'registered_on',
                    type: 'timestamp',
                    default: 'now()',
                },
                {
                    name: 'min_pwd_len',
                    type: 'int',
                    default: 12,
                },
                {
                    name: 'max_pwd_len',
                    type: 'int',
                    default: null,
                    isNullable: true,
                },
                {
                    name: 'min_numeric_chars',
                    type: 'int',
                    default: 1,
                },
                {
                    name: 'min_lowercase_chars',
                    type: 'int',
                    default: 1,
                },
                {
                    name: 'min_uppercase_chars',
                    type: 'int',
                    default: 1,
                },
                {
                    name: 'min_special_chars',
                    type: 'int',
                    default: 1,
                },
                {
                    name: 'special_char_set',
                    type: 'varchar',
                    length: '50',
                },
                {
                    name: 'self_service_pwd_reset',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'pwd_reused',
                    type: 'int',
                    default: null,
                    isNullable: true,
                },
                {
                    name: 'max_pwd_age',
                    type: 'int',
                    default: 90,
                    isNullable: true,
                },
                {
                    name: 'enforce_mfa',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'trusted_cidrs',
                    type: 'text',
                    isArray: true,
                },
                {
                    name: 'session_interval',
                    type: 'varchar',
                    length: '50',
                    default: "'1h'",
                },
                {
                    name: 'session_key_rotation',
                    type: 'int',
                    default: 30,
                },
                {
                    name: 'allow_username_reminder',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'allow_multiple_sessions',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'brute_force_limit',
                    type: 'int',
                    default: 5,
                },
                {
                    name: 'brute_force_action',
                    type: 'varchar',
                    length: '255',
                    default: "'block'",  // block|timeout|none
                },
            ]
        }), true);

        await queryRunner.createIndex('organization', new TableIndex({
            name: 'IDX_ORGANIZATION_UNIQUE_ID',
            columnNames: ['unique_id'],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('organization');
    }
}