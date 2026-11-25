import { Repository } from 'typeorm';
import { RoomStatus } from '../../common/enums/room-status.enum';
import { RoomType } from '../../room-types/entities/room-type.entity';
import { Room } from '../../rooms/entities/room.entity';

export async function seedRooms(
  repository: Repository<Room>,
  roomTypes: readonly RoomType[],
): Promise<Room[]> {
  const result: Room[] = [];
  const floorsByHotel: Map<string, number> = new Map<string, number>();
  for (const roomType of roomTypes) {
    const floor: number = (floorsByHotel.get(roomType.hotelId) ?? 0) + 1;
    floorsByHotel.set(roomType.hotelId, floor);
    for (let roomNumber: number = 1; roomNumber <= 4; roomNumber += 1) {
      const name: string = String(floor * 100 + roomNumber);
      const existing: Room | null = await repository.findOne({
        where: { name, roomType: { hotelId: roomType.hotelId } },
      });
      if (existing && existing.roomTypeId !== roomType.id) {
        throw new Error(
          `Room ${name} already belongs to another room type in hotel ${roomType.hotelId}. Seed rolled back.`,
        );
      }
      const room: Room =
        existing ??
        (await repository.save(
          repository.create({
            roomTypeId: roomType.id,
            name,
            status:
              roomNumber === 4 && floor % 2 === 0
                ? RoomStatus.INACTIVE
                : RoomStatus.ACTIVE,
          }),
        ));
      result.push(room);
    }
  }
  return result;
}
