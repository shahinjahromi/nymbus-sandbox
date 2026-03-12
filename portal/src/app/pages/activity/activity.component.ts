import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h1 class="page-title">API Activity Log</h1>
    <p class="text-muted" style="margin-bottom:16px">Sandbox API request history for your tenant</p>

    <!-- Filters -->
    <div class="card">
      <h2>Filters</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Method</label>
          <select [(ngModel)]="filterMethod">
            <option value="">All</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
        <div class="form-group">
          <label>Path Contains</label>
          <input type="text" [(ngModel)]="filterPath" placeholder="/accounts" class="mono" />
        </div>
        <div class="form-group">
          <label>Status Code</label>
          <input type="text" [(ngModel)]="filterStatus" placeholder="200" class="mono" />
        </div>
        <div class="form-group">
          <label>Limit</label>
          <input type="number" [(ngModel)]="filterLimit" placeholder="50" />
        </div>
      </div>
      <button class="btn-primary" (click)="load()">Apply Filters</button>
    </div>

    <!-- Activity table -->
    <div class="card">
      <h2>Requests ({{ entries.length }})</h2>
      <table *ngIf="entries.length > 0">
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Idempotency Key</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let e of entries">
            <td><span class="method-badge" [attr.data-method]="e.method">{{ e.method }}</span></td>
            <td class="mono">{{ e.path }}</td>
            <td [class.text-success]="e.statusCode >= 200 && e.statusCode < 300"
                [class.text-danger]="e.statusCode >= 400">
              {{ e.statusCode }}
            </td>
            <td class="text-muted">{{ e.durationMs }}ms</td>
            <td class="mono text-muted">{{ e.idempotencyKey || '—' }}</td>
            <td class="text-muted">{{ e.timestamp | date:'medium' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="entries.length === 0 && !loading">No API activity recorded</div>
      <div class="empty-state" *ngIf="loading"><span class="spinner"></span> Loading...</div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .method-badge {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      background: #e9ecef;
    }
  `],
})
export class ActivityComponent implements OnInit {
  entries: any[] = [];
  filterMethod = '';
  filterPath = '';
  filterStatus = '';
  filterLimit = 50;
  loading = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.listApiActivity({
      method: this.filterMethod || undefined,
      path_contains: this.filterPath || undefined,
      status: this.filterStatus || undefined,
      limit: this.filterLimit ? String(this.filterLimit) : undefined,
    } as any).subscribe({
      next: (res) => { this.entries = res.data ?? []; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }
}
