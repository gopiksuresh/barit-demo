import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { SIMULATED_LOCATION, type VenueDto, type VenueMenuDto } from '@barit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { itemInclude, toCategoryDto, toVenueDto } from '../common/mappers';
import { sortByDistance } from './geo';

@Controller('venues')
export class VenuesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Venue locator. The guest app sends the fixed simulated location. */
  @Get()
  async list(@Query('lat') lat?: string, @Query('lng') lng?: string): Promise<VenueDto[]> {
    const origin = {
      lat: Number.isFinite(Number(lat)) && lat !== undefined ? Number(lat) : SIMULATED_LOCATION.lat,
      lng: Number.isFinite(Number(lng)) && lng !== undefined ? Number(lng) : SIMULATED_LOCATION.lng,
    };
    const venues = await this.prisma.venue.findMany();
    return sortByDistance(origin, venues).map(({ place, distanceKm }) => toVenueDto(place, distanceKm));
  }

  /** Public live menu — available, non-archived items only. */
  @Get(':slug/menu')
  async menu(@Param('slug') slug: string): Promise<VenueMenuDto> {
    const venue = await this.prisma.venue.findUnique({ where: { slug } });
    if (!venue) throw new NotFoundException('Venue not found');
    const categories = await this.prisma.category.findMany({
      where: { venueId: venue.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { archived: false, isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          include: itemInclude,
        },
      },
    });
    return {
      venue: toVenueDto(venue),
      categories: categories.filter((c) => c.items.length > 0).map(toCategoryDto),
    };
  }
}
