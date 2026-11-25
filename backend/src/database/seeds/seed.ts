import { EntityManager } from 'typeorm';
import { Hotel } from '../../hotels/entities/hotel.entity';
import { RoomType } from '../../room-types/entities/room-type.entity';
import { Room } from '../../rooms/entities/room.entity';
import dataSource from '../data-source';
import { seedHotels } from './hotel.seed';
import { seedRoomTypes } from './room-type.seed';
import { seedRooms } from './room.seed';

interface SeedSummary {
  hotels: number;
  roomTypes: number;
  rooms: number;
}

export async function runSeed(): Promise<void> {
  try {
    await dataSource.initialize();
    const summary: SeedSummary = await dataSource.transaction(
      async (manager: EntityManager): Promise<SeedSummary> => {
        // Serialize seed invocations because the natural keys are not unique constraints.
        await manager.query('SELECT pg_advisory_xact_lock($1)', [726184903]);
        const hotels: Hotel[] = await seedHotels(manager.getRepository(Hotel));
        const roomTypes: RoomType[] = await seedRoomTypes(
          manager.getRepository(RoomType),
          hotels,
        );
        const rooms: Room[] = await seedRooms(
          manager.getRepository(Room),
          roomTypes,
        );
        return {
          hotels: hotels.length,
          roomTypes: roomTypes.length,
          rooms: rooms.length,
        };
      },
    );
    console.log(
      `Seed completed: ${summary.hotels} hotels, ${summary.roomTypes} room types, ${summary.rooms} rooms (including existing records).`,
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  runSeed().catch((error: unknown): void => {
    console.error(
      'Seed failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exitCode = 1;
  });
}
