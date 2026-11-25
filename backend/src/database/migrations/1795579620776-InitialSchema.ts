import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1795579620776 implements MigrationInterface {
    name = 'InitialSchema1795579620776'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('CUSTOMER', 'STAFF', 'ADMIN')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(50) NOT NULL, "passwordHash" character varying(255) NOT NULL, "fullName" character varying(100) NOT NULL, "email" character varying(255) NOT NULL, "phone" character varying(15), "role" "public"."users_role_enum" NOT NULL DEFAULT 'CUSTOMER', "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE', "hotelId" uuid, CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "CHK_users_role_hotel_id" CHECK (("role" = 'STAFF' AND "hotelId" IS NOT NULL) OR ("role" IN ('CUSTOMER', 'ADMIN') AND "hotelId" IS NULL)), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "hotelId" uuid NOT NULL, "comment" text NOT NULL, "starRate" smallint NOT NULL, CONSTRAINT "CHK_reviews_star_rate" CHECK ("starRate" BETWEEN 1 AND 5), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."hotels_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TABLE "hotels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "description" text, "address" character varying(255) NOT NULL, "city" character varying(100) NOT NULL, "phone" character varying(15) NOT NULL, "status" "public"."hotels_status_enum" NOT NULL DEFAULT 'ACTIVE', "freeCancellationHours" integer NOT NULL, "cancellationFeePercent" smallint NOT NULL, CONSTRAINT "CHK_hotels_cancellation_fee_percent" CHECK ("cancellationFeePercent" BETWEEN 0 AND 100), CONSTRAINT "CHK_hotels_free_cancellation_hours" CHECK ("freeCancellationHours" >= 0), CONSTRAINT "PK_2bb06797684115a1ba7c705fc7b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "room_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hotelId" uuid NOT NULL, "name" character varying(100) NOT NULL, "description" text, "capacity" integer NOT NULL, "pricePerHour" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "CHK_room_types_price_per_hour" CHECK ("pricePerHour" >= 0), CONSTRAINT "CHK_room_types_capacity" CHECK ("capacity" > 0), CONSTRAINT "PK_b6e1d0a9b67d4b9fbff9c35ab69" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."rooms_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "roomTypeId" uuid NOT NULL, "name" character varying(50) NOT NULL, "status" "public"."rooms_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_status_enum" AS ENUM('PENDING', 'ACCEPT', 'CANCEL', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "roomId" uuid NOT NULL, "guestCount" integer NOT NULL, "startTime" TIMESTAMP WITH TIME ZONE NOT NULL, "endTime" TIMESTAMP WITH TIME ZONE NOT NULL, "totalPrice" integer NOT NULL, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'PENDING', "cancellationFee" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cancelledAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_bookings_cancellation_fee" CHECK ("cancellationFee" >= 0), CONSTRAINT "CHK_bookings_total_price" CHECK ("totalPrice" >= 0), CONSTRAINT "CHK_bookings_time_range" CHECK ("endTime" > "startTime"), CONSTRAINT "CHK_bookings_guest_count" CHECK ("guestCount" > 0), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_ba55c97cf1bcb6490cc597e241b" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_7ed5659e7139fc8bc039198cc1f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_a7cc013c66ce20ff12a192c6222" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "room_types" ADD CONSTRAINT "FK_7ed42fc166559badb3c937c400c" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rooms" ADD CONSTRAINT "FK_76b20e23154532d6fc4a0f0ea27" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_38a69a58a323647f2e75eb994de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_0172b36e4e054d6ebb819d58efb" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_0172b36e4e054d6ebb819d58efb"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_38a69a58a323647f2e75eb994de"`);
        await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_76b20e23154532d6fc4a0f0ea27"`);
        await queryRunner.query(`ALTER TABLE "room_types" DROP CONSTRAINT "FK_7ed42fc166559badb3c937c400c"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_a7cc013c66ce20ff12a192c6222"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_7ed5659e7139fc8bc039198cc1f"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_ba55c97cf1bcb6490cc597e241b"`);
        await queryRunner.query(`DROP TABLE "bookings"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
        await queryRunner.query(`DROP TABLE "rooms"`);
        await queryRunner.query(`DROP TYPE "public"."rooms_status_enum"`);
        await queryRunner.query(`DROP TABLE "room_types"`);
        await queryRunner.query(`DROP TABLE "hotels"`);
        await queryRunner.query(`DROP TYPE "public"."hotels_status_enum"`);
        await queryRunner.query(`DROP TABLE "reviews"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
