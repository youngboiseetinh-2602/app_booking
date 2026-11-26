import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowManagerHotelAssignment1795592558769 implements MigrationInterface {
  name = 'AllowManagerHotelAssignment1795592558769';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "CHK_users_role_hotel_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_role_hotel_id" CHECK (("role"::text IN ('STAFF', 'MANAGER') AND "hotelId" IS NOT NULL) OR ("role"::text IN ('CUSTOMER', 'ADMIN') AND "hotelId" IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "CHK_users_role_hotel_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_role_hotel_id" CHECK (("role"::text = 'STAFF' AND "hotelId" IS NOT NULL) OR ("role"::text IN ('CUSTOMER', 'ADMIN') AND "hotelId" IS NULL))`,
    );
  }
}
