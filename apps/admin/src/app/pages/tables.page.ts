import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminApi, apiError, type AdminTable } from '../core/api.service';
import { StaffStore } from '../core/staff.store';

@Component({
  selector: 'ba-tables-page',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatCardModule, MatFormFieldModule, MatInputModule, MatTooltipModule],
  templateUrl: './tables.page.html',
  styleUrl: './tables.page.scss',
})
export class TablesPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly snack = inject(MatSnackBar);
  protected readonly staff = inject(StaffStore);

  protected readonly tables = signal<AdminTable[]>([]);
  protected readonly qr = signal<{ tableNumber: number; url: string; dataUrl: string } | null>(null);
  protected newNumber: number | null = null;
  protected newSeats = 4;

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    try {
      const ts = await this.api.tables();
      this.tables.set(ts);
      this.newNumber = (ts.at(-1)?.number ?? 0) + 1;
    } catch (e) {
      this.snack.open(apiError(e), 'OK', { duration: 3500 });
    }
  }

  protected async add() {
    if (!this.newNumber) return;
    try {
      await this.api.createTable(Number(this.newNumber), Number(this.newSeats) || 4);
      await this.reload();
    } catch (e) {
      this.snack.open(apiError(e), 'OK', { duration: 3500 });
    }
  }

  protected async showQr(t: AdminTable) {
    try {
      this.qr.set(await this.api.qr(t.id));
    } catch (e) {
      this.snack.open(apiError(e), 'OK', { duration: 3500 });
    }
  }

  protected async rotate(t: AdminTable) {
    if (!window.confirm(`Issue a new QR for table ${t.number}? Printed codes for this table will stop working.`)) return;
    try {
      await this.api.rotateQr(t.id);
      await this.reload();
      await this.showQr(t);
    } catch (e) {
      this.snack.open(apiError(e), 'OK', { duration: 3500 });
    }
  }

  protected async remove(t: AdminTable) {
    if (!window.confirm(`Delete table ${t.number}?`)) return;
    try {
      await this.api.deleteTable(t.id);
      await this.reload();
    } catch (e) {
      this.snack.open(apiError(e), 'OK', { duration: 3500 });
    }
  }

  protected print() {
    const q = this.qr();
    if (!q) return;
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    const venue = this.staff.me()?.venue?.name ?? '';
    w.document.write(`<!doctype html><title>Table ${q.tableNumber}</title>
      <body style="font-family:system-ui;text-align:center;padding:40px">
      <h2 style="margin:0">${venue.replace(/</g, '&lt;')}</h2>
      <img src="${q.dataUrl}" style="width:320px;height:320px" />
      <h1 style="margin:0">Table ${q.tableNumber}</h1><p>Scan to view the menu &amp; order</p>
      <script>onload=()=>{print();}</script></body>`);
    w.document.close();
  }
}
