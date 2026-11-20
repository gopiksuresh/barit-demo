import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type VenueType, type StaffRole } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const rs = (rupees: number) => Math.round(rupees * 100);

type P = [label: string, rupees: number];
interface ItemSeed {
  name: string;
  description: string;
  veg?: boolean;
  special?: boolean;
  image?: string;
  portions: P[];
}
interface CategorySeed {
  name: string;
  gst: number;
  items: ItemSeed[];
}
interface VenueSeed {
  slug: string;
  name: string;
  type: VenueType;
  address: string;
  lat: number;
  lng: number;
  tablePrefix: string;
  tables: number;
  staff: Array<{ phone: string; name: string; role: StaffRole }>;
  menu: CategorySeed[];
}

const VENUES: VenueSeed[] = [
  {
    slug: 'kayal-kitchen',
    name: 'Kayal Kitchen',
    type: 'RESTAURANT',
    address: 'Princess Street, Fort Kochi, Kerala 682001',
    lat: 9.9658,
    lng: 76.2421,
    tablePrefix: 'kk',
    tables: 8,
    staff: [
      { phone: '+919999900001', name: 'Anjali (Owner)', role: 'OWNER' },
      { phone: '+919999900003', name: 'Chef Babu', role: 'KITCHEN' },
    ],
    menu: [
      {
        name: 'Breakfast',
        gst: 5,
        items: [
          { name: 'Appam & Vegetable Stew', description: 'Lacy fermented rice hoppers with a mild coconut-milk stew of potato, carrot and peas.', veg: true, special: true, portions: [['2 Appam', 140], ['4 Appam', 240]] },
          { name: 'Puttu & Kadala Curry', description: 'Steamed rice-and-coconut cylinders with black chickpea curry.', veg: true, portions: [['Regular', 120]] },
          { name: 'Idiyappam & Egg Roast', description: 'String hoppers with eggs in a slow-cooked caramelised onion-tomato masala.', portions: [['Regular', 150]] },
        ],
      },
      {
        name: 'Mains',
        gst: 5,
        items: [
          { name: 'Kerala Parotta', description: 'Flaky, layered flatbread, griddled to order.', veg: true, portions: [['1 pc', 30], ['3 pcs', 85]] },
          { name: 'Beef Fry (Ularthiyathu)', description: 'Slow-roasted beef with coconut slivers, curry leaves and black pepper.', special: true, portions: [['Half', 190], ['Full', 340]] },
          { name: 'Fish Moilee', description: 'Seer fish simmered in turmeric-tinted coconut milk with green chilli and ginger.', portions: [['Regular', 360]] },
          { name: 'Nadan Chicken Curry', description: 'Home-style chicken curry with roasted coconut and Kerala garam masala.', portions: [['Half', 180], ['Full', 320]] },
          { name: 'Karimeen Pollichathu', description: 'Pearl spot fish marinated in masala, wrapped in banana leaf and pan-roasted.', special: true, portions: [['Regular', 450]] },
          { name: 'Matta Rice', description: 'Kerala red rice, steamed.', veg: true, portions: [['Bowl', 70]] },
        ],
      },
      {
        name: 'Sadya',
        gst: 5,
        items: [
          { name: 'Veg Sadya (Lunch only)', description: 'Banana-leaf feast: matta rice, sambar, parippu, avial, thoran, olan, kaalan, pachadi, pickles, pappadam and payasam.', veg: true, special: true, portions: [['Per plate', 320]] },
        ],
      },
      {
        name: 'Desserts & Drinks',
        gst: 5,
        items: [
          { name: 'Palada Pradhaman', description: 'Rice-flake ada slow-cooked in sweetened milk.', veg: true, portions: [['Cup', 90]] },
          { name: 'Pazham Pori', description: 'Ripe Nendran banana fritters.', veg: true, portions: [['2 pcs', 60]] },
          { name: 'Sulaimani', description: 'Spiced black tea with lime.', veg: true, portions: [['Glass', 40]] },
          { name: 'Fresh Lime Soda', description: 'Sweet, salted or mixed.', veg: true, portions: [['Glass', 70]] },
        ],
      },
    ],
  },
  {
    slug: 'toddy-and-tide',
    name: 'Toddy & Tide',
    type: 'BAR',
    address: 'Panampilly Nagar, Kochi, Kerala 682036',
    lat: 9.9591,
    lng: 76.2958,
    tablePrefix: 'tt',
    tables: 6,
    staff: [{ phone: '+919999900002', name: 'Rahul (Owner)', role: 'OWNER' }],
    menu: [
      {
        name: 'Shappu Fry',
        gst: 5,
        items: [
          { name: 'Kappa & Meen Curry', description: 'Boiled tapioca with fiery red fish curry, toddy-shop style.', special: true, portions: [['Plate', 220]] },
          { name: 'Duck Roast (Tharavu)', description: 'Kuttanad duck roasted with shallots, pepper and coconut milk.', portions: [['Half', 290], ['Full', 520]] },
          { name: 'Prawns Ularthiyathu', description: 'Prawns tossed dry with coconut, curry leaves and Kashmiri chilli.', portions: [['Regular', 340]] },
          { name: 'Chicken 65', description: 'Crisp, spicy fried chicken bites.', portions: [['Regular', 240]] },
          { name: 'Kappa Biryani', description: 'Tapioca and beef cooked together — a shappu classic.', portions: [['Plate', 260]] },
          { name: 'Banana Chips & Kadala', description: 'Coconut-oil fried Nendran chips with spiced peanuts.', veg: true, portions: [['Bowl', 120]] },
        ],
      },
      {
        // Alcoholic beverages sit outside GST (state excise / VAT). Shown at 0% for the demo.
        name: 'Cocktails',
        gst: 0,
        items: [
          { name: 'Kochi Mule', description: 'Vodka, ginger beer, lime and a curry-leaf tincture.', special: true, portions: [['Glass', 420]] },
          { name: 'Cardamom Old Fashioned', description: 'Bourbon stirred with cardamom-jaggery syrup and orange bitters.', portions: [['Glass', 480]] },
          { name: 'Spiced Rum Punch', description: 'Dark rum, pineapple, lime, clove and nutmeg.', portions: [['Glass', 390]] },
          { name: 'Classic Mojito', description: 'White rum, mint, lime, soda.', portions: [['Glass', 360]] },
        ],
      },
      {
        name: 'Toddy & Beer',
        gst: 0,
        items: [
          { name: 'Fresh Palm Toddy', description: 'Morning-tapped coconut toddy, served chilled.', portions: [['Glass', 90], ['Bottle (750ml)', 220]] },
          { name: 'Draught Lager', description: 'House pour.', portions: [['Pint', 280], ['Pitcher', 980]] },
        ],
      },
      {
        name: 'Mocktails',
        gst: 5,
        items: [
          { name: 'Kulukki Sarbath', description: 'Shaken lime, basil seeds, green chilli and sugar syrup.', veg: true, portions: [['Glass', 110]] },
          { name: 'Tender Coconut Cooler', description: 'Fresh tender coconut water, malai and mint.', veg: true, portions: [['Glass', 140]] },
        ],
      },
    ],
  },
  {
    slug: 'malabar-spice-house',
    name: 'Malabar Spice House',
    type: 'RESTAURANT',
    address: 'Infopark Road, Kakkanad, Kochi, Kerala 682042',
    lat: 10.0159,
    lng: 76.3419,
    tablePrefix: 'ms',
    tables: 4,
    staff: [],
    menu: [
      {
        name: 'Malabar Specials',
        gst: 5,
        items: [
          { name: 'Thalassery Chicken Biryani', description: 'Kaima rice layered with chicken masala, fried onions and ghee.', special: true, portions: [['Plate', 280]] },
          { name: 'Mutton Biryani', description: 'Thalassery style, with raita and pickle.', portions: [['Plate', 360]] },
          { name: 'Pathiri & Chicken Curry', description: 'Thin rice-flour flatbreads with Malabar chicken curry.', portions: [['Regular', 210]] },
          { name: 'Unnakaya', description: 'Banana dumplings stuffed with egg, coconut and cashew.', veg: true, portions: [['2 pcs', 80]] },
        ],
      },
    ],
  },
];

async function main() {
  // Wipe in dependency order — the seed always restores a clean demo state.
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.tableSession.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.staffUser.deleteMany();
  await prisma.portion.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.diningTable.deleteMany();
  await prisma.venue.deleteMany();

  for (const v of VENUES) {
    const venue = await prisma.venue.create({
      data: { slug: v.slug, name: v.name, type: v.type, address: v.address, lat: v.lat, lng: v.lng },
    });

    for (let n = 1; n <= v.tables; n++) {
      await prisma.diningTable.create({
        data: { venueId: venue.id, number: n, seats: n % 3 === 0 ? 6 : n % 2 === 0 ? 4 : 2, qrToken: `${v.tablePrefix}-t${n}` },
      });
    }

    for (const s of v.staff) {
      await prisma.staffUser.create({ data: { ...s, venueId: venue.id } });
    }

    for (const [ci, c] of v.menu.entries()) {
      const cat = await prisma.category.create({
        data: { venueId: venue.id, name: c.name, gstRatePct: c.gst, sortOrder: ci },
      });
      for (const [ii, it] of c.items.entries()) {
        await prisma.menuItem.create({
          data: {
            categoryId: cat.id,
            name: it.name,
            description: it.description,
            imageUrl: it.image ?? null,
            isVeg: it.veg ?? false,
            isSpecial: it.special ?? false,
            sortOrder: ii,
            portions: { create: it.portions.map(([label, rupees], pi) => ({ label, pricePaise: rs(rupees), sortOrder: pi })) },
          },
        });
      }
    }
    const items = v.menu.reduce((n, c) => n + c.items.length, 0);
    console.log(`  ✓ ${v.name}: ${v.menu.length} categories, ${items} items, ${v.tables} tables, ${v.staff.length} staff`);
  }

  console.log('\nDemo logins (Firebase Auth emulator — OTP appears in the emulator UI/terminal):');
  for (const v of VENUES) for (const s of v.staff) console.log(`  ${s.phone}  ${s.role.padEnd(7)}  ${v.name}`);
  console.log('\nTable QR tokens look like kk-t3 → http://localhost:4200/table/kk-t3');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
