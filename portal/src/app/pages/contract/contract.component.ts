import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-contract',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

    <!-- Implemented API Endpoints -->
    <div class="card" id="endpoints">
      <h2>Implemented API Endpoints</h2>
      <p class="text-muted" style="margin-bottom:12px" *ngIf="endpointCatalog">
        {{ endpointCatalog.implemented }} of {{ endpointCatalog.total }} operations have dedicated sandbox implementations
      </p>

      <div class="endpoint-controls" *ngIf="endpointCatalog">
        <input type="text" class="search-input" placeholder="Search endpoints..." [(ngModel)]="endpointSearch" (ngModelChange)="filterEndpoints()">
        <select class="filter-select" [(ngModel)]="endpointTagFilter" (ngModelChange)="filterEndpoints()">
          <option value="">All Tags</option>
          <option *ngFor="let t of allTags" [value]="t">{{ t }}</option>
        </select>
        <select class="filter-select" [(ngModel)]="endpointStatusFilter" (ngModelChange)="filterEndpoints()">
          <option value="">All</option>
          <option value="implemented">Implemented</option>
          <option value="fallback">Fallback</option>
        </select>
      </div>

      <div *ngIf="filteredEndpoints.length > 0" class="endpoint-list">
        <div *ngFor="let ep of filteredEndpoints" class="endpoint-item" [class.expanded]="expandedEndpoint === ep.operationId">
          <div class="endpoint-header" (click)="toggleEndpoint(ep.operationId)">
            <span class="method-badge" [attr.data-method]="ep.method">{{ ep.method }}</span>
            <span class="endpoint-path mono">{{ ep.path }}</span>
            <span class="impl-badge" [class.impl-yes]="ep.implemented" [class.impl-no]="!ep.implemented">
              {{ ep.implemented ? 'Implemented' : 'Fallback' }}
            </span>
            <span class="deprecated-badge" *ngIf="ep.deprecated">Deprecated</span>
            <span class="expand-icon">{{ expandedEndpoint === ep.operationId ? '▾' : '▸' }}</span>
          </div>
          <div class="endpoint-summary" *ngIf="ep.summary">{{ ep.summary }}</div>

          <div class="endpoint-detail" *ngIf="expandedEndpoint === ep.operationId">
            <div *ngIf="ep.description" class="ep-description">{{ ep.description }}</div>

            <div *ngIf="ep.operationId" class="ep-meta">
              <span class="label-col">Operation ID</span>
              <span class="mono">{{ ep.operationId }}</span>
            </div>

            <div *ngIf="ep.parameters.length > 0" class="ep-section">
              <h4>Parameters</h4>
              <table class="schema-table">
                <thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
                <tbody>
                  <tr *ngFor="let p of ep.parameters">
                    <td class="mono">{{ p.name }}</td>
                    <td>{{ p.in }}</td>
                    <td class="mono">{{ p.type }}</td>
                    <td>{{ p.required ? 'Yes' : 'No' }}</td>
                    <td>{{ p.description || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div *ngIf="ep.requestBody.length > 0" class="ep-section">
              <h4>Request Body</h4>
              <table class="schema-table">
                <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
                <tbody>
                  <tr *ngFor="let f of ep.requestBody">
                    <td class="mono">{{ f.name }}</td>
                    <td class="mono">{{ f.type }}</td>
                    <td>{{ f.required ? 'Yes' : 'No' }}</td>
                    <td>{{ f.description || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div *ngIf="ep.responses.length > 0" class="ep-section">
              <h4>Responses</h4>
              <div *ngFor="let r of ep.responses" class="response-block">
                <div class="response-code">
                  <span class="status-code" [class.status-2xx]="r.code.startsWith('2')" [class.status-4xx]="r.code.startsWith('4')" [class.status-5xx]="r.code.startsWith('5')">{{ r.code }}</span>
                  <span>{{ r.description }}</span>
                </div>
                <table class="schema-table" *ngIf="r.fields.length > 0">
                  <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let f of r.fields">
                      <td class="mono">{{ f.name }}</td>
                      <td class="mono">{{ f.type }}</td>
                      <td>{{ f.description || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="empty-state" *ngIf="filteredEndpoints.length === 0 && !loading">No matching endpoints</div>
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

    /* Endpoint catalog styles */
    .endpoint-controls {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-input {
      flex: 1;
      min-width: 200px;
      padding: 6px 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      font-size: 13px;
      font-family: inherit;
    }
    .search-input:focus { outline: none; border-color: var(--color-primary); }
    .filter-select {
      padding: 6px 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      font-size: 13px;
      font-family: inherit;
      background: var(--color-surface);
    }
    .endpoint-list { border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; }
    .endpoint-item { border-bottom: 1px solid var(--color-border); }
    .endpoint-item:last-child { border-bottom: none; }
    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      cursor: pointer;
      font-size: 13px;
    }
    .endpoint-header:hover { background: #f8f9fa; }
    .endpoint-path { flex: 1; font-size: 13px; }
    .impl-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .impl-yes { background: #d1fae5; color: #065f46; }
    .impl-no { background: #fef3c7; color: #92400e; }
    .deprecated-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 600;
      background: #fee2e2;
      color: #991b1b;
      text-transform: uppercase;
    }
    .expand-icon { color: var(--color-text-muted); font-size: 12px; width: 16px; text-align: center; }
    .endpoint-summary {
      padding: 0 12px 8px 12px;
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .endpoint-detail {
      padding: 0 12px 12px 12px;
      background: #f8f9fa;
      border-top: 1px solid var(--color-border);
    }
    .ep-description {
      padding: 12px 0 8px 0;
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-text);
      white-space: pre-line;
    }
    .ep-meta {
      padding: 6px 0;
      font-size: 12px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .ep-section { margin-top: 12px; }
    .ep-section h4 {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: var(--color-text-muted);
      margin-bottom: 6px;
    }
    .schema-table {
      width: 100%;
      font-size: 12px;
      border-collapse: collapse;
    }
    .schema-table th {
      text-align: left;
      padding: 4px 8px;
      border-bottom: 2px solid var(--color-border);
      font-weight: 600;
      color: var(--color-text-muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .schema-table td {
      padding: 4px 8px;
      border-bottom: 1px solid var(--color-border);
      vertical-align: top;
    }
    .response-block { margin-bottom: 8px; }
    .response-code {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .status-code {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      background: #e9ecef;
    }
    .status-2xx { background: #d1fae5; color: #065f46; }
    .status-4xx { background: #fef3c7; color: #92400e; }
    .status-5xx { background: #fee2e2; color: #991b1b; }
    .method-badge[data-method="GET"] { background: #dbeafe; color: #1e40af; }
    .method-badge[data-method="POST"] { background: #d1fae5; color: #065f46; }
    .method-badge[data-method="PUT"] { background: #fef3c7; color: #92400e; }
    .method-badge[data-method="PATCH"] { background: #e0e7ff; color: #3730a3; }
    .method-badge[data-method="DELETE"] { background: #fee2e2; color: #991b1b; }

    @media (max-width: 768px) {
      .endpoint-header { flex-wrap: wrap; gap: 4px; padding: 8px; }
      .endpoint-path { 
        width: 100%; 
        overflow: hidden; 
        text-overflow: ellipsis; 
        white-space: nowrap; 
        font-size: 12px; 
      }
      .endpoint-controls { flex-direction: column; }
      .search-input { min-width: 0; width: 100%; }
      .schema-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .endpoint-detail { padding: 0 8px 8px 8px; }
      .ep-meta { flex-wrap: wrap; }
    }
  `],
})
export class ContractComponent implements OnInit {
  metadata: any = null;
  deprecations: any[] = [];
  changelog: any[] = [];
  loading = false;

  // Endpoint catalog
  endpointCatalog: any = null;
  allEndpoints: any[] = [];
  filteredEndpoints: any[] = [];
  allTags: string[] = [];
  endpointSearch = '';
  endpointTagFilter = '';
  endpointStatusFilter = '';
  expandedEndpoint: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loading = true;
    this.api.getContractMetadata().subscribe({
      next: (res) => {
        const a = res.active ?? res;
        this.metadata = {
          title: a.title,
          version: a.contractVersion ?? a.version,
          source: a.sourceFile ?? a.source,
          description: a.description,
          totalPaths: a.endpointCount ?? a.totalPaths,
          totalOperations: a.operationCount ?? a.totalOperations,
        };
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
    this.api.getContractDeprecations().subscribe({
      next: (res) => {
        this.deprecations = res.operations ?? res.data ?? res.deprecations ?? [];
      },
    });
    this.api.getContractChangelog().subscribe({
      next: (res) => {
        if (res.data ?? res.entries) {
          this.changelog = res.data ?? res.entries ?? [];
        } else {
          const changes: string[] = [];
          for (const op of (res.added ?? [])) changes.push(`Added: ${op}`);
          for (const op of (res.removed ?? [])) changes.push(`Removed: ${op}`);
          for (const op of (res.modified ?? [])) changes.push(`Modified: ${op}`);
          if (changes.length > 0) {
            this.changelog = [{
              version: this.metadata?.version ?? 'current',
              date: new Date().toISOString().slice(0, 10),
              changes,
            }];
          }
        }
      },
    });
    this.api.getContractEndpoints().subscribe({
      next: (res) => {
        this.endpointCatalog = res;
        this.allEndpoints = res.endpoints ?? [];
        // Collect unique tags
        const tags = new Set<string>();
        for (const ep of this.allEndpoints) {
          for (const t of (ep.tags ?? [])) tags.add(t);
        }
        this.allTags = [...tags].sort();
        this.filterEndpoints();
      },
    });
  }

  filterEndpoints(): void {
    const search = this.endpointSearch.toLowerCase();
    this.filteredEndpoints = this.allEndpoints.filter(ep => {
      if (this.endpointStatusFilter === 'implemented' && !ep.implemented) return false;
      if (this.endpointStatusFilter === 'fallback' && ep.implemented) return false;
      if (this.endpointTagFilter && !(ep.tags ?? []).includes(this.endpointTagFilter)) return false;
      if (search) {
        const haystack = `${ep.method} ${ep.path} ${ep.operationId ?? ''} ${ep.summary ?? ''} ${ep.description ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  toggleEndpoint(opId: string | undefined): void {
    if (!opId) return;
    this.expandedEndpoint = this.expandedEndpoint === opId ? null : opId;
  }
}
