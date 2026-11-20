import { Component, input } from '@angular/core';

/** Indian food-labelling mark: green square-dot = veg, red/brown triangle = non-veg. */
@Component({
  selector: 'bg-veg-mark',
  templateUrl: './veg-mark.html',
  styleUrl: './veg-mark.scss',
})
export class VegMark {
  readonly veg = input.required<boolean>();
}
