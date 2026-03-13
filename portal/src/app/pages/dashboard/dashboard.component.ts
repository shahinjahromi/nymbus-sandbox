import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService, PortalUser } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h1 class="page-title">Dashboard</h1>

    <div class="stats-grid" *ngIf="loaded">
      <div class="stat-card">
        <div class="stat-label">Customers</div>
        <div class="stat-value">{{ customerCount }}</div>
        <a routerLink="/customers" class="stat-link">View all &rarr;</a>
      </div>
      <div class="stat-card">
        <div class="stat-label">Accounts</div>
        <div class="stat-value">{{ accountCount }}</div>
        <a routerLink="/accounts" class="stat-link">View all &rarr;</a>
      </div>
      <div class="stat-card">
        <div class="stat-label">API Credentials</div>
        <div class="stat-value">{{ credentialCount }}</div>
        <a routerLink="/credentials" class="stat-link">Manage &rarr;</a>
      </div>
      <div class="stat-card">
        <div class="stat-label">Environment</div>
        <div class="stat-value"><span class="badge badge-sandbox">sandbox</span></div>
      </div>
    </div>

    <div class="card" *ngIf="serverInfo">
      <h2>Sandbox API Endpoint</h2>
      <table class="detail-table">
        <tr><td class="label-col">Base URL</td><td class="mono endpoint-url">{{ serverInfo.baseUrl }}</td></tr>
        <tr><td class="label-col">OAuth Token</td><td class="mono endpoint-url">{{ serverInfo.oauthEndpoint }}</td></tr>
        <tr><td class="label-col">Health Check</td><td class="mono endpoint-url">{{ serverInfo.healthEndpoint }}</td></tr>
      </table>
    </div>

    <div class="card" *ngIf="user">
      <h2>Your Profile</h2>
      <table class="detail-table">
        <tr><td class="label-col">Email</td><td class="mono">{{ user.email }}</td></tr>
        <tr><td class="label-col">Name</td><td>{{ user.name || '—' }}</td></tr>
        <tr><td class="label-col">Tenant ID</td><td class="mono">{{ user.tenantId }}</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Recent API Activity</h2>
      <table *ngIf="recentActivity.length > 0">
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of recentActivity">
            <td><span class="method-badge" [attr.data-method]="a.method">{{ a.method }}</span></td>
            <td class="mono">{{ a.path }}</td>
            <td>{{ a.statusCode }}</td>
            <td class="text-muted">{{ a.timestamp | date:'short' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="recentActivity.length === 0">No recent API activity</div>
      <a routerLink="/activity" class="stat-link" style="display:inline-block;margin-top:12px">View full log &rarr;</a>
    </div>
  `,
  styles: [`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 16px;
    }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-muted); font-weight: 600; }
    .stat-value { font-size: 28px; font-weight: 700; margin: 4px 0; }
    .stat-link { font-size: 12px; color: var(--color-primary); text-decoration: none; }
    .stat-link:hover { text-decoration: underline; }
    .detail-table { width: auto; }
    .detail-table td { padding: 6px 16px 6px 0; border: none; }
    .label-col { font-weight: 600; color: var(--color-text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 100px; }
    .method-badge {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      background: #e9ecef;
    }
    .endpoint-url {
      user-select: all;
      color: var(--color-primary);
    }
  `],
})
export class DashboardComponent implements OnInit {
  user: PortalUser | null = null;
  customerCount = 0;
  accountCount = 0;
  credentialCount = 0;
  recentActivity: any[] = [];
  serverInfo: any = null;
  loaded = false;

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    this.user = this.auth.currentUser;
    this.loadStats();
    this.api.getServerInfo().subscribe({ next: (res: any) => { this.serverInfo = res; } });
  }

  private loadStats(): void {
    this.api.listUsers().subscribe({ next: (res) => { this.customerCount = res.data?.length ?? 0; this.checkLoaded(); } });
    this.api.listAccounts().subscribe({ next: (res) => { this.accountCount = res.data?.length ?? 0; this.checkLoaded(); } });
    this.api.listCredentials().subscribe({ next: (res) => { this.credentialCount = res.data?.length ?? 0; this.checkLoaded(); } });
    this.api.listApiActivity({ limit: '5' }).subscribe({ next: (res) => { this.recentActivity = res.data ?? []; } });
  }

  private checkLoaded(): void {
    this.loaded = true;
  }
}
