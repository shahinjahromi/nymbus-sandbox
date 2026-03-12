import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-account-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="breadcrumb">
      <a routerLink="/accounts">Accounts</a> / <span class="mono">{{ accountId }}</span>
    </div>

    <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
    <div class="alert alert-success" *ngIf="successMsg">{{ successMsg }}</div>

    <div class="grid-2" *ngIf="account">
      <!-- Account info -->
      <div class="card">
        <h2>Account Details</h2>
        <table class="detail-table">
          <tr><td class="label-col">ID</td><td class="mono">{{ account.id }}</td></tr>
          <tr><td class="label-col">Type</td><td>{{ account.type }}</td></tr>
          <tr><td class="label-col">Currency</td><td>{{ account.currency || 'USD' }}</td></tr>
          <tr><td class="label-col">Balance</td><td class="mono">{{ account.balance | number:'1.2-2' }}</td></tr>
          <tr><td class="label-col">Customer</td><td class="mono">{{ account.customerId }}</td></tr>
          <tr><td class="label-col">Status</td><td><span class="badge badge-active">{{ account.status || 'active' }}</span></td></tr>
        </table>
        <div class="action-bar" style="margin-top:12px">
          <button class="btn-sm" (click)="seedAccount()">Seed Data</button>
          <button class="btn-sm btn-danger" (click)="resetAccount()">Reset Data</button>
        </div>
      </div>

      <!-- Yield config -->
      <div class="card">
        <h2>Interest / Yield Config</h2>
        <div *ngIf="yieldConfig">
          <table class="detail-table">
            <tr><td class="label-col">APY</td><td class="mono">{{ yieldConfig.apy }}%</td></tr>
            <tr><td class="label-col">Enabled</td><td>{{ yieldConfig.enabled ? 'Yes' : 'No' }}</td></tr>
          </table>
        </div>
        <div *ngIf="!yieldConfig" class="text-muted" style="margin-bottom:12px">No yield config set</div>
        <div class="form-row" style="margin-top:12px">
          <div class="form-group">
            <label>APY (%)</label>
            <input type="number" [(ngModel)]="newApy" placeholder="e.g. 3.5" step="0.01" />
          </div>
        </div>
        <button class="btn-sm btn-primary" (click)="setYieldConfig()">Update Yield Config</button>
        <button class="btn-sm" (click)="runAccrual()" style="margin-left:8px">Run Daily Accrual</button>
      </div>
    </div>

    <!-- Transactions -->
    <div class="card" *ngIf="account">
      <h2>Transactions</h2>
      <button class="btn-sm" (click)="loadTransactions()" style="margin-bottom:12px">Refresh</button>
      <table *ngIf="transactions.length > 0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Description</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of transactions">
            <td class="mono">{{ t.id }}</td>
            <td>{{ t.type }}</td>
            <td class="mono" [class.text-success]="t.amount > 0" [class.text-danger]="t.amount < 0">
              {{ t.amount | number:'1.2-2' }}
            </td>
            <td>{{ t.description || '—' }}</td>
            <td><span class="badge badge-active">{{ t.status || 'posted' }}</span></td>
            <td class="text-muted">{{ t.createdAt | date:'short' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="transactions.length === 0">No transactions</div>
    </div>

    <div class="empty-state" *ngIf="!account && !loading">Account not found</div>
    <div class="empty-state" *ngIf="loading"><span class="spinner"></span> Loading...</div>
  `,
  styles: [`
    .breadcrumb {
      font-size: 13px;
      margin-bottom: 16px;
      color: var(--color-text-muted);
    }
    .breadcrumb a {
      color: var(--color-primary);
      text-decoration: none;
    }
    .breadcrumb a:hover { text-decoration: underline; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    .detail-table { width: auto; }
    .detail-table td { padding: 4px 16px 4px 0; border: none; }
    .label-col { font-weight: 600; color: var(--color-text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 90px; }
  `],
})
export class AccountDetailComponent implements OnInit {
  accountId = '';
  account: any = null;
  yieldConfig: any = null;
  transactions: any[] = [];
  newApy = 0;
  error = '';
  successMsg = '';
  loading = false;

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.accountId = this.route.snapshot.params['id'];
    this.loadAccount();
    this.loadTransactions();
  }

  loadAccount(): void {
    this.loading = true;
    this.api.getAccount(this.accountId).subscribe({
      next: (res) => {
        this.account = res.account;
        this.yieldConfig = res.yield_config;
        if (this.yieldConfig) this.newApy = this.yieldConfig.apy;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  loadTransactions(): void {
    this.api.getAccountTransactions(this.accountId).subscribe({
      next: (res) => { this.transactions = res.data ?? []; },
    });
  }

  seedAccount(): void {
    this.api.seedAccount(this.accountId).subscribe({
      next: () => {
        this.successMsg = 'Account data seeded';
        this.loadAccount();
        this.loadTransactions();
      },
      error: (err) => { this.error = err.error?.message || 'Seed failed'; },
    });
  }

  resetAccount(): void {
    if (!confirm('Reset all data for this account?')) return;
    this.api.resetAccount(this.accountId).subscribe({
      next: () => {
        this.successMsg = 'Account data reset';
        this.loadAccount();
        this.loadTransactions();
      },
      error: (err) => { this.error = err.error?.message || 'Reset failed'; },
    });
  }

  setYieldConfig(): void {
    this.error = '';
    this.api.setYieldConfig(this.accountId, this.newApy, true).subscribe({
      next: (res) => {
        this.yieldConfig = res.yield_config;
        this.successMsg = 'Yield config updated';
      },
      error: (err) => { this.error = err.error?.message || 'Failed to update yield config'; },
    });
  }

  runAccrual(): void {
    this.api.accrueDailyInterest().subscribe({
      next: (res) => {
        this.successMsg = `Daily accrual complete (${res.data?.length ?? 0} accounts)`;
        this.loadAccount();
        this.loadTransactions();
      },
      error: (err) => { this.error = err.error?.message || 'Accrual failed'; },
    });
  }
}
