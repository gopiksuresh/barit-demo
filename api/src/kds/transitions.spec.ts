import { canTransition, type OrderStatus } from '@barit/shared';

describe('KDS order transitions', () => {
  it('allows only the forward path Ordered → Cooking → Ready → Served', () => {
    expect(canTransition('ORDERED', 'COOKING')).toBe(true);
    expect(canTransition('COOKING', 'READY')).toBe(true);
    expect(canTransition('READY', 'SERVED')).toBe(true);
  });

  it('rejects skipping or going backwards', () => {
    const bad: Array<[OrderStatus, OrderStatus]> = [
      ['ORDERED', 'READY'],
      ['ORDERED', 'SERVED'],
      ['COOKING', 'ORDERED'],
      ['READY', 'COOKING'],
      ['SERVED', 'READY'],
      ['COOKING', 'CANCELLED'],
    ];
    for (const [from, to] of bad) expect(canTransition(from, to)).toBe(false);
  });

  it('lets an order be cancelled only before cooking starts', () => {
    expect(canTransition('ORDERED', 'CANCELLED')).toBe(true);
  });

  it('treats Served and Cancelled as terminal', () => {
    for (const to of ['ORDERED', 'COOKING', 'READY', 'SERVED', 'CANCELLED'] as OrderStatus[]) {
      expect(canTransition('SERVED', to)).toBe(false);
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });
});
