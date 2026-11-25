import { Repository } from 'typeorm';
import { HotelStatus } from '../../common/enums/hotel-status.enum';
import { Hotel } from '../../hotels/entities/hotel.entity';

type HotelSeedData = Pick<
  Hotel,
  | 'name'
  | 'description'
  | 'address'
  | 'city'
  | 'phone'
  | 'status'
  | 'freeCancellationHours'
  | 'cancellationFeePercent'
>;

const hotels: readonly HotelSeedData[] = [
  {
    name: 'The Aurora Hotel',
    description:
      'Khách sạn giả lập mang phong cách thanh lịch, đón ánh sáng tự nhiên giữa lòng Hà Nội.',
    address: '101 phố Bình Minh, phường Giả Lập',
    city: 'Hà Nội',
    phone: '02400000101',
    status: HotelStatus.ACTIVE,
    freeCancellationHours: 6,
    cancellationFeePercent: 20,
  },
  {
    name: 'The Velvet Residence',
    description:
      'Không gian lưu trú giả lập với nội thất nhung ấm áp và nét duyên kiến trúc Hà Nội xưa.',
    address: '202 phố Nhung, phường Giả Lập',
    city: 'Hà Nội',
    phone: '02400000202',
    status: HotelStatus.ACTIVE,
    freeCancellationHours: 12,
    cancellationFeePercent: 25,
  },
  {
    name: 'Ocean Pearl Hotel',
    description:
      'Khách sạn biển giả lập với sắc xanh dịu nhẹ, phù hợp kỳ nghỉ thư giãn tại Đà Nẵng.',
    address: '303 đường Ngọc Biển, phường Giả Lập',
    city: 'Đà Nẵng',
    phone: '02360000303',
    status: HotelStatus.ACTIVE,
    freeCancellationHours: 24,
    cancellationFeePercent: 30,
  },
  {
    name: 'Pine Valley Retreat',
    description:
      'Khu nghỉ dưỡng giả lập giữa thung lũng thông, kết hợp nội thất gỗ và không gian vườn yên tĩnh.',
    address: '404 đường Thung Lũng Thông, phường Giả Lập',
    city: 'Đà Lạt',
    phone: '02630000404',
    status: HotelStatus.ACTIVE,
    freeCancellationHours: 12,
    cancellationFeePercent: 20,
  },
  {
    name: 'The Skyline Hotel',
    description:
      'Khách sạn đô thị giả lập với thiết kế hiện đại và tầm nhìn thành phố Hồ Chí Minh về đêm.',
    address: '505 đại lộ Chân Trời, phường Giả Lập',
    city: 'TP. Hồ Chí Minh',
    phone: '02800000505',
    status: HotelStatus.ACTIVE,
    freeCancellationHours: 6,
    cancellationFeePercent: 25,
  },
];

export async function seedHotels(
  repository: Repository<Hotel>,
): Promise<Hotel[]> {
  const result: Hotel[] = [];
  for (const data of hotels) {
    const existing: Hotel | null = await repository.findOneBy({
      name: data.name,
      city: data.city,
    });
    const hotel: Hotel =
      existing ?? (await repository.save(repository.create(data)));
    result.push(hotel);
  }
  return result;
}
