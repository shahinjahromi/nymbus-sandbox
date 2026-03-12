import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h1 class="page-title">Audit Trail</h1>
    <p class="text-muted" style="margin-bottom:16px">Tenant-scoped audit log of portal and credential actions</p>

    <div class="action-bar">
      <div class="form-group" style="width:120px;margin:0">
        <label>Limit</label>
        <input type="number" [(ngModel)]="limit" placeholder="100" />
      </div>
      <button class="btn-primary" (click)="load()" style="margin-top:18px">Refresh</button>
    </div>

    <div class="card">
      <h2>Entries ({{ entries.length }})</h2>
      <table *ngIf="entries.length > 0">
        <thead>
          <tr>
            <th>Action</th>
            <th>Actor</th>
            <th>Outcome</th>
            <th>Details</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let e of entries">
            <td class="mono">{{ e.action }}</td>
            <td class="mono">{{ e.actor }}</td>
            <td>
              <span class="badge" [ngClass]="e.outcome === 'success' ? 'badge-active' : 'badge-revoked'">
                {{ e.outcome }}
              </span>
            </td>
            <td class="mono text-muted" style="max-width:300px;overflow:hidden;text-overflow:ellipsis">
              {{ e.details ? (e.details | json) : '—' }}
            </td>
            <td class="text-muted">{{ e.timestamp | date:'medium' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="entries.length === 0 && !loading">No audit entries</div>
      <div class="empty-state" *ngIf="loading"><span class="spinner"></span> Loading...</div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
  `],
})
export class AuditComponent implements OnInit {
  entries: any[] = [];
  limit = 100;
  loading = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.listAuditLog(this.limit).subscribe({
      next: (res) => { this.entries = res.data ?? []; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }
}
