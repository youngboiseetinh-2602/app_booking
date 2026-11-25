import { Repository } from 'typeorm';
import { Hotel } from '../../hotels/entities/hotel.entity';
import { RoomType } from '../../room-types/entities/room-type.entity';

type RoomTypeSeedData = Pick<
  RoomType,
  'name' | 'description' | 'capacity' | 'pricePerHour'
>;

const roomTypesByHotel: Readonly<Record<string, readonly RoomTypeSeedData[]>> =
  {
    'The Aurora Hotel': [
      {
        name: 'Urban Cozy',
        description:
          'Phòng đơn nhỏ xinh với góc đọc sách và ánh sáng ấm, dành cho chuyến đi một mình.',
        capacity: 1,
        pricePerHour: 80000,
      },
      {
        name: 'Aurora Deluxe',
        description:
          'Phòng đôi đón nắng sớm với giường rộng và nội thất màu kem thanh lịch.',
        capacity: 2,
        pricePerHour: 140000,
      },
      {
        name: 'Heritage Premium',
        description:
          'Không gian ba khách với tranh phố cổ và bàn trà gỗ, kết hợp nét truyền thống và tiện nghi hiện đại.',
        capacity: 3,
        pricePerHour: 210000,
      },
      {
        name: 'Moonlight Suite',
        description:
          'Suite có phòng khách riêng và cửa sổ lớn, thích hợp gia đình nhỏ nghỉ ngơi giữa thành phố.',
        capacity: 4,
        pricePerHour: 330000,
      },
      {
        name: 'Aurora Royal Residence',
        description:
          'Không gian rộng cho đại gia đình với hai khu ngủ, bàn ăn và khu sinh hoạt chung sang trọng.',
        capacity: 6,
        pricePerHour: 520000,
      },
    ],
    'The Velvet Residence': [
      {
        name: 'Velvet Petite',
        description:
          'Phòng đơn với ghế bọc nhung và đèn ngủ cổ điển, dành cho khoảng nghỉ riêng tư.',
        capacity: 1,
        pricePerHour: 100000,
      },
      {
        name: 'Serenity Deluxe',
        description:
          'Phòng đôi tông trầm êm dịu với rèm dày và góc thưởng trà yên tĩnh.',
        capacity: 2,
        pricePerHour: 170000,
      },
      {
        name: 'Silk Heritage',
        description:
          'Phòng ba khách trang trí lụa và gỗ sẫm, gợi nét thanh lịch của những biệt thự Hà Nội.',
        capacity: 3,
        pricePerHour: 240000,
      },
      {
        name: 'Royal Signature',
        description:
          'Suite gia đình với phòng khách riêng, sofa nhung và khu thay đồ tiện nghi.',
        capacity: 4,
        pricePerHour: 390000,
      },
      {
        name: 'The Velvet Penthouse',
        description:
          'Căn hộ tầng cao dành cho sáu khách, có bàn ăn lớn và góc ngắm mái phố.',
        capacity: 6,
        pricePerHour: 580000,
      },
    ],
    'Ocean Pearl Hotel': [
      {
        name: 'Ocean Breeze',
        description:
          'Phòng đôi sắc xanh biển với cửa sổ thoáng và nội thất mây nhẹ nhàng.',
        capacity: 2,
        pricePerHour: 130000,
      },
      {
        name: 'Coral Deluxe',
        description:
          'Phòng ba khách lấy cảm hứng từ rạn san hô, có góc ngồi thư giãn sau chuyến dạo biển.',
        capacity: 3,
        pricePerHour: 190000,
      },
      {
        name: 'Pearl Horizon',
        description:
          'Phòng bốn khách với ban công hướng biển giả lập và tông ngọc trai dịu mắt.',
        capacity: 4,
        pricePerHour: 280000,
      },
      {
        name: 'Family Harmony',
        description:
          'Không gian gia đình năm người với hai khu ngủ và bàn sinh hoạt chung rộng rãi.',
        capacity: 5,
        pricePerHour: 400000,
      },
      {
        name: 'Azure Grand Suite',
        description:
          'Suite sáu khách có phòng khách lớn và khu ăn uống, mang cảm giác nghỉ dưỡng bên đại dương.',
        capacity: 6,
        pricePerHour: 560000,
      },
    ],
    'Pine Valley Retreat': [
      {
        name: 'Pine Nest',
        description:
          'Phòng đơn ốp gỗ với cửa sổ nhìn ra rừng thông giả lập, phù hợp nghỉ ngơi tĩnh lặng.',
        capacity: 1,
        pricePerHour: 90000,
      },
      {
        name: 'Garden Retreat',
        description:
          'Phòng đôi mở ra khu vườn hoa với ghế đọc sách và chất liệu gỗ tự nhiên.',
        capacity: 2,
        pricePerHour: 150000,
      },
      {
        name: 'Misty Valley Deluxe',
        description:
          'Phòng ba khách với sắc xanh rêu và góc trà ngắm thung lũng sương mờ.',
        capacity: 3,
        pricePerHour: 220000,
      },
      {
        name: 'Forest Harmony',
        description:
          'Phòng gia đình bốn khách có khu sinh hoạt chung ấm áp và cửa kính lớn hướng vườn.',
        capacity: 4,
        pricePerHour: 310000,
      },
      {
        name: 'Cloud Nine Suite',
        description:
          'Suite sáu khách trên tầng cao với hai khu ngủ và phòng khách nhìn ra những đồi thông.',
        capacity: 6,
        pricePerHour: 490000,
      },
    ],
    'The Skyline Hotel': [
      {
        name: 'Metro Executive',
        description:
          'Phòng đơn hiện đại với bàn làm việc và ánh sáng phù hợp cho khách công tác.',
        capacity: 1,
        pricePerHour: 120000,
      },
      {
        name: 'Skyline Premium',
        description:
          'Phòng đôi có cửa kính lớn và sofa cạnh cửa sổ, hướng về đường chân trời thành phố.',
        capacity: 2,
        pricePerHour: 200000,
      },
      {
        name: 'Neon Panorama',
        description:
          'Phòng ba khách có điểm nhấn ánh sáng đô thị và khu ngồi ngắm thành phố về đêm.',
        capacity: 3,
        pricePerHour: 290000,
      },
      {
        name: 'Metropolitan Suite',
        description:
          'Suite năm khách với khu tiếp khách riêng và bàn ăn, phù hợp nhóm bạn hoặc gia đình.',
        capacity: 5,
        pricePerHour: 440000,
      },
      {
        name: 'The Grand Penthouse',
        description:
          'Penthouse sáu khách với phòng khách rộng, hai khu ngủ và tầm nhìn toàn cảnh đô thị giả lập.',
        capacity: 6,
        pricePerHour: 600000,
      },
    ],
  };

export async function seedRoomTypes(
  repository: Repository<RoomType>,
  hotels: readonly Hotel[],
): Promise<RoomType[]> {
  const result: RoomType[] = [];
  for (const hotel of hotels) {
    const definitions: readonly RoomTypeSeedData[] | undefined =
      roomTypesByHotel[hotel.name];
    if (!definitions)
      throw new Error(`Missing room type seed data for ${hotel.name}.`);
    for (const data of definitions) {
      const existing: RoomType | null = await repository.findOneBy({
        hotelId: hotel.id,
        name: data.name,
      });
      const roomType: RoomType =
        existing ??
        (await repository.save(
          repository.create({ ...data, hotelId: hotel.id, isActive: true }),
        ));
      result.push(roomType);
    }
  }
  return result;
}
