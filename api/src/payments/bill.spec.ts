import { calculateBill } from './bill';

const line = (unitPricePaise: number, qty: number, gstRatePct: number) => ({
  itemName: 'x',
  portionLabel: 'p',
  qty,
  unitPricePaise,
  gstRatePct,
});

describe('calculateBill', () => {
  it('computes 5% GST on food and adds the tip after tax', () => {
    // Appam 2pc ₹140 + Beef Fry Full ₹340 = ₹480; GST 5% = ₹24.00; tip ₹48
    const b = calculateBill([line(14000, 1, 5), line(34000, 1, 5)], 4800);
    expect(b.subtotalPaise).toBe(48000);
    expect(b.gstPaise).toBe(2400);
    expect(b.cgstPaise + b.sgstPaise).toBe(2400);
    expect(b.cgstPaise).toBe(1200);
    expect(b.tipPaise).toBe(4800);
    expect(b.totalPaise).toBe(48000 + 2400 + 4800);
  });

  it('handles mixed rates (bar food at 5%, cocktails at 0%)', () => {
    const b = calculateBill([line(22000, 1, 5), line(42000, 2, 0)]);
    expect(b.subtotalPaise).toBe(22000 + 84000);
    expect(b.gstPaise).toBe(1100);
    expect(b.lines[1].gstPaise).toBe(0);
    expect(b.totalPaise).toBe(106000 + 1100);
  });

  it('rounds GST per line to the nearest paisa and splits odd paise into SGST', () => {
    // ₹30.10 x 1 @5% = 150.5 paise → 151 (half rounds up)
    const b = calculateBill([line(3010, 1, 5)]);
    expect(b.gstPaise).toBe(151);
    expect(b.cgstPaise).toBe(75);
    expect(b.sgstPaise).toBe(76);
  });

  it('multiplies by quantity before applying GST', () => {
    const b = calculateBill([line(3000, 3, 5)]);
    expect(b.lines[0].lineTotalPaise).toBe(9000);
    expect(b.gstPaise).toBe(450);
  });

  it('returns a zero bill for no lines', () => {
    expect(calculateBill([]).totalPaise).toBe(0);
  });

  it('rejects negative or fractional tips', () => {
    expect(() => calculateBill([line(100, 1, 5)], -1)).toThrow(RangeError);
    expect(() => calculateBill([line(100, 1, 5)], 1.5)).toThrow(RangeError);
  });
});
