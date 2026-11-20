import { haversineKm, sortByDistance } from './geo';

const MG_ROAD = { lat: 9.9658, lng: 76.2854 };

describe('geo', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(MG_ROAD, MG_ROAD)).toBeCloseTo(0, 6);
  });

  it('measures MG Road → Fort Kochi at roughly 4.7 km', () => {
    const d = haversineKm(MG_ROAD, { lat: 9.9658, lng: 76.2421 });
    expect(d).toBeGreaterThan(4.4);
    expect(d).toBeLessThan(5.0);
  });

  it('sorts venues nearest first', () => {
    const venues = [
      { name: 'Kakkanad', lat: 10.0159, lng: 76.3419 },
      { name: 'Panampilly', lat: 9.9591, lng: 76.2958 },
      { name: 'Fort Kochi', lat: 9.9658, lng: 76.2421 },
    ];
    expect(sortByDistance(MG_ROAD, venues).map((v) => v.place.name)).toEqual(['Panampilly', 'Fort Kochi', 'Kakkanad']);
  });
});
