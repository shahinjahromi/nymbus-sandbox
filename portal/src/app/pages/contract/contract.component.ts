import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-contract',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1 class="page-title">API Contract</h1>
    <p class="text-muted" style="margin-bottom:16px">Active Nymbus OpenAPI contract metadata, change log, and deprecation notices</p>

    <!-- Metadata -->
    <div class="card">
      <h2>Contract Metadata</h2>
      <div *ngIf="metadata">
        <table class="detail-table">
          <tr><td class="label-col">Title</td><td>{{ metadata.title }}</td></tr>
          <tr><td class="label-col">Version</td><td class="mono">{{ metadata.version }}</td></tr>
          <tr><td class="label-col">Source</td><td class="mono">{{ metadata.source }}</td></tr>
          <tr *ngIf="metadata.description"><td class="label-col">Description</td><td>{{ metadata.description }}</td></tr>
          <tr><td class="label-col">Total Paths</td><td>{{ metadata.totalPaths }}</td></tr>
          <tr><td class="label-col">Total Operations</td><td>{{ metadata.totalOperations }}</td></tr>
        </table>
      </div>
      <div class="empty-state" *ngIf="!metadata && !loading">No contract metadata available</div>
    </div>

    <!-- Deprecations -->
    <div class="card">
      <h2>Deprecation Notices</h2>
      <table *ngIf="deprecations.length > 0">
        <thead>
          <tr>
            <th>Operation</th>
            <th>Path</th>
            <th>Method</th>
            <th>Guidance</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let d of deprecations">
            <td class="mono">{{ d.operationId || '—' }}</td>
            <td class="mono">{{ d.path }}</td>
            <td><span class="method-badge">{{ d.method | uppercase }}</span></td>
            <td>{{ d.guidance || d.description || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="deprecations.length === 0 && !loading">No deprecated operations</div>
    </div>

    <!-- Change log -->
    <div class="card">
      <h2>Change Log</h2>
      <div *ngIf="changelog.length > 0">
        <div *ngFor="let entry of changelog" class="changelog-entry">
          <div class="changelog-version">
            <span class="badge badge-sandbox">{{ entry.version }}</span>
            <span class="text-muted" style="margin-left:8px">{{ entry.date }}</span>
          </div>
          <ul>
            <li *ngFor="let change of entry.changes">{{ change }}</li>
          </ul>
        </div>
      </div>
      <div class="empty-state" *ngIf="changelog.length === 0 && !loading">No change log entries</div>
    </div>

    <div class="empty-state" *ngIf="loading"><span class="spinner"></span> Loading...</div>
  `,
  styles: [`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .detail-table { width: auto; }
    .detail-table td { padding: 4px 16px 4px 0; border: none; }
    .label-col { font-weight: 600; color: var(--color-text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 120px; }
    .method-badge {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      background: #e9ecef;
    }
    .changelog-entry {
      padding: 12px 0;
      border-bottom: 1px solid var(--color-border);
    }
    .changelog-entry:last-child { border-bottom: none; }
    .changelog-version { margin-bottom: 8px; }
    .changelog-entry ul {
      padding-left: 20px;
      font-size: 13px;
    }
    .changelog-entry li { margin-bottom: 4px; }
  `],
})
export class ContractComponent implements OnInit {
  metadata: any = null;
  deprecations: any[] = [];
  changelog: any[] = [];
  loading = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loading = true;
    this.api.getContractMetadata().subscribe({
      next: (res) => { this.metadata = res; this.loading = false; },
      error: () => { this.loading = false; },
    });
    this.api.getContractDeprecations().subscribe({
      next: (res) => { this.deprecations = res.data ?? res.deprecations ?? []; },
    });
    this.api.getContractChangelog().subscribe({
      next: (res) => { this.changelog = res.data ?? res.entries ?? []; },
    });
  }
}
