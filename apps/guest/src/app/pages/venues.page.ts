import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SIMULATED_LOCATION, type VenueDto } from '@barit/shared';
import { ApiService, apiError } from '../core/api.service';
import { environment } from '../../environments/environment';
import { Icon } from '../shared/icon';

@Component({
  selector: 'bg-venues-page',
  imports: [RouterLink, Icon],
  templateUrl: './venues.page.html',
  styleUrl: './venues.page.scss',
})
export class VenuesPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly loc = SIMULATED_LOCATION;
  protected readonly dev = environment.useEmulators;
  protected readonly venues = signal<VenueDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit() {
    void this.load();
  }

  protected async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.venues.set(await this.api.venues());
    } catch (e) {
      this.error.set(apiError(e));
    } finally {
      this.loading.set(false);
    }
  }
}
