import { MigrationInterface, QueryRunner } from 'typeorm';

export class addOrganizations1634479306222 implements MigrationInterface {
    
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO "organization"("name","unique_id","session_key","session_key_last_rotation","registered_on","min_pwd_len","max_pwd_len","min_numeric_chars","min_lowercase_chars","min_uppercase_chars","min_special_chars","special_char_set","self_service_pwd_reset","pwd_reused","max_pwd_age","enforce_mfa","trusted_cidrs","session_interval","session_key_rotation","allow_username_reminder","allow_multiple_sessions","brute_force_limit","brute_force_action") VALUES('Ferro Corp.','f3fdcf9d-d72b-4718-a44d-f1d53c4cd69f','bc7144b9-8247-4644-a928-5f284f7d7a6c',NOW(),NOW(),12,NULL,1,1,1,1,'&-_^%$#.!=+*',TRUE,NULL,90,TRUE,array[]::text[],'1h',14,TRUE,FALSE,5,'block')`);
        await queryRunner.query(`INSERT INTO "organization"("name","unique_id","session_key","session_key_last_rotation","registered_on","min_pwd_len","max_pwd_len","min_numeric_chars","min_lowercase_chars","min_uppercase_chars","min_special_chars","special_char_set","self_service_pwd_reset","pwd_reused","max_pwd_age","enforce_mfa","trusted_cidrs","session_interval","session_key_rotation","allow_username_reminder","allow_multiple_sessions","brute_force_limit","brute_force_action") VALUES('Acme, Inc.','9f528bfb-d877-5658-881d-f2098dd2500c','4117cfb0-4c2a-597a-8601-0c1db7f23912',NOW(),NOW(),12,NULL,1,1,1,1,'&-_^%$#.!=+*',TRUE,NULL,90,TRUE,array[]::text[],'1h',14,TRUE,FALSE,5,'block')`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "organization"`);
    }

}
