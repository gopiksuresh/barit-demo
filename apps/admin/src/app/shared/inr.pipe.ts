import { Pipe, PipeTransform } from '@angular/core';
import { formatInr } from '@barit/shared';

/** Formats integer paise as rupees: 34000 → ₹340.00 */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(paise: number | null | undefined): string {
    return paise == null ? '' : formatInr(paise);
  }
}
