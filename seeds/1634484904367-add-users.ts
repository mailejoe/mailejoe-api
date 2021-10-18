import { MigrationInterface, QueryRunner } from 'typeorm';

export class addUsers1634484904367 implements MigrationInterface {

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO "user"("organization_id","email","username","first_name","last_name","pwd_hash","mfa_secret","mfa_enabled") VALUES('Ferro Corp.','f3fdcf9d-d72b-4718-a44d-f1d53c4cd69f','bc7144b9-8247-4644-a928-5f284f7d7a6c',NOW(),NOW(),12,NULL,1,1,1,1,'&-_^%$#.!=+*',TRUE,NULL,90,TRUE,array[]::text[],'1h',14,TRUE,FALSE,5,'block')`);
        await queryRunner.query(`INSERT INTO "user"("organization_id","email","username","first_name","last_name","pwd_hash","mfa_secret","mfa_enabled") VALUES('Acme, Inc.','9f528bfb-d877-5658-881d-f2098dd2500c','4117cfb0-4c2a-597a-8601-0c1db7f23912',NOW(),NOW(),12,NULL,1,1,1,1,'&-_^%$#.!=+*',TRUE,NULL,90,TRUE,array[]::text[],'1h',14,TRUE,FALSE,5,'block')`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "user"`);
    }

}
