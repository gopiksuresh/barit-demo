import { Pipe, PipeTransform } from '@angular/core';
import { formatInr } from '@barit/shared';

/**
 * Formats integer paise as rupees.
 *   34000 | inr          → ₹340.00   (bills, receipts — paise always shown)
 *   34000 | inr:'short'  → ₹340      (menu prices — decimals only when not whole rupees)
 */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(paise: number | null | undefined, mode: 'full' | 'short' = 'full'): string {
    if (paise == null) return '';
    if (mode === 'short' && paise % 100 === 0) return '₹' + (paise / 100).toLocaleString('en-IN');
    return formatInr(paise);
  }
}
