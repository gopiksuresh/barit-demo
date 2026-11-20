import type { Bill, BillLine } from '@barit/shared';

export interface BillInputLine {
  itemName: string;
  portionLabel: string;
  qty: number;
  unitPricePaise: number;
  /** GST rate snapshotted at order time, e.g. 5 for 5%. */
  gstRatePct: number;
}

/**
 * Pure bill calculation. Menu prices are GST-exclusive; GST is computed per line
 * (rounded to the nearest paisa) and split evenly into CGST/SGST. Tip is added
 * after tax and is not taxed.
 */
export function calculateBill(input: BillInputLine[], tipPaise = 0): Bill {
  if (!Number.isInteger(tipPaise) || tipPaise < 0) throw new RangeError('tipPaise must be a non-negative integer');

  const lines: BillLine[] = input.map((l) => {
    const lineTotalPaise = l.unitPricePaise * l.qty;
    const gstPaise = Math.round((lineTotalPaise * l.gstRatePct) / 100);
    return {
      itemName: l.itemName,
      portionLabel: l.portionLabel,
      qty: l.qty,
      unitPricePaise: l.unitPricePaise,
      lineTotalPaise,
      gstRatePct: l.gstRatePct,
      gstPaise,
    };
  });

  const subtotalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  const gstPaise = lines.reduce((s, l) => s + l.gstPaise, 0);
  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;

  return {
    lines,
    subtotalPaise,
    gstPaise,
    cgstPaise,
    sgstPaise,
    tipPaise,
    totalPaise: subtotalPaise + gstPaise + tipPaise,
  };
}
