import 'reflect-metadata';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { databaseConfig } from '../config/database.config';
import { Hotel } from '../hotels/entities/hotel.entity';
import { Review } from '../reviews/entities/review.entity';
import { RoomType } from '../room-types/entities/room-type.entity';
import { Room } from '../rooms/entities/room.entity';
import { User } from '../users/entities/user.entity';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

const configService: ConfigService = new ConfigService();
const connectionOptions: ReturnType<typeof databaseConfig> =
  databaseConfig(configService);

if (connectionOptions.type !== 'postgres') {
  throw new Error('Migration DataSource requires PostgreSQL configuration.');
}

const migrationExtension: string = __filename.endsWith('.ts') ? 'ts' : 'js';
const dataSourceOptions: DataSourceOptions = {
  ...connectionOptions,
  type: connectionOptions.type,
  entities: [User, Hotel, Review, RoomType, Room, Booking],
  migrations: [
    resolve(__dirname, 'migrations', `*.${migrationExtension}`).replace(
      /\\/g,
      '/',
    ),
  ],
  synchronize: false,
  migrationsRun: false,
};

const dataSource: DataSource = new DataSource(dataSourceOptions);

export default dataSource;
