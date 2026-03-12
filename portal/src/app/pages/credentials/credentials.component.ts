import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-credentials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h1 class="page-title">API Credentials</h1>

    <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
    <div class="alert alert-success" *ngIf="successMsg">{{ successMsg }}</div>

    <!-- Create form -->
    <div class="card">
      <h2>Generate New Credential</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Label</label>
          <input type="text" [(ngModel)]="newLabel" placeholder="e.g. staging-key" />
        </div>
        <div class="form-group">
          <label>Expires At (optional)</label>
          <input type="date" [(ngModel)]="newExpiresAt" />
        </div>
      </div>
      <button class="btn-primary" (click)="create()" [disabled]="creating">
        <span class="spinner" *ngIf="creating"></span>
        Generate
      </button>
    </div>

    <!-- Secret display -->
    <div class="card" *ngIf="lastSecret" style="border-color: var(--color-warning);">
      <h2 style="color: var(--color-warning); border-color: var(--color-warning);">&#9888; Client Secret</h2>
      <p style="font-size:13px;margin-bottom:8px;">Copy and store this secret now. It will not be shown again.</p>
      <div class="json-output">{{ lastSecret }}</div>
    </div>

    <!-- Credentials table -->
    <div class="card">
      <h2>Active Credentials</h2>
      <table *ngIf="credentials.length > 0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Label</th>
            <th>Status</th>
            <th>Client ID</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let c of credentials">
            <td class="mono">{{ c.id }}</td>
            <td>{{ c.label || '—' }}</td>
            <td>
              <span class="badge" [ngClass]="'badge-' + c.status">{{ c.status }}</span>
            </td>
            <td class="mono">{{ c.clientId }}</td>
            <td class="text-muted">{{ c.createdAt | date:'short' }}</td>
            <td>
              <div class="action-bar" *ngIf="c.status === 'active'">
                <button class="btn-sm" (click)="rotate(c.id)">Rotate</button>
                <button class="btn-sm btn-danger" (click)="revoke(c.id)">Revoke</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="credentials.length === 0 && !loading">
        No credentials yet. Generate one to get started.
      </div>
      <div class="empty-state" *ngIf="loading">
        <span class="spinner"></span> Loading...
      </div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
  `],
})
export class CredentialsComponent implements OnInit {
  credentials: any[] = [];
  newLabel = '';
  newExpiresAt = '';
  lastSecret = '';
  error = '';
  successMsg = '';
  loading = false;
  creating = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.listCredentials().subscribe({
      next: (res) => {
        this.credentials = res.data ?? [];
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  create(): void {
    this.error = '';
    this.successMsg = '';
    this.lastSecret = '';
    this.creating = true;
    this.api.createCredential(this.newLabel || undefined, this.newExpiresAt || undefined).subscribe({
      next: (res) => {
        this.creating = false;
        this.lastSecret = res.client_secret;
        this.successMsg = 'Credential created successfully';
        this.newLabel = '';
        this.newExpiresAt = '';
        this.load();
      },
      error: (err) => {
        this.creating = false;
        this.error = err.error?.message || 'Failed to create credential';
      },
    });
  }

  rotate(id: string): void {
    this.error = '';
    this.lastSecret = '';
    this.api.rotateCredential(id).subscribe({
      next: (res) => {
        this.lastSecret = res.client_secret;
        this.successMsg = 'Credential rotated. Save the new secret.';
        this.load();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to rotate credential';
      },
    });
  }

  revoke(id: string): void {
    if (!confirm('Revoke this credential? It cannot be reactivated.')) return;
    this.error = '';
    this.lastSecret = '';
    this.api.revokeCredential(id).subscribe({
      next: () => {
        this.successMsg = 'Credential revoked';
        this.load();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to revoke credential';
      },
    });
  }
}
