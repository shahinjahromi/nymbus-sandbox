import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h1 class="page-title">Accounts</h1>

    <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
    <div class="alert alert-success" *ngIf="successMsg">{{ successMsg }}</div>

    <!-- Create account -->
    <div class="card">
      <h2>Create Account</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Customer ID</label>
          <input type="text" [(ngModel)]="newCustomerId" placeholder="cust-..." class="mono" />
        </div>
        <div class="form-group">
          <label>Type</label>
          <select [(ngModel)]="newType">
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="money_market">Money Market</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Currency</label>
          <input type="text" [(ngModel)]="newCurrency" placeholder="USD" />
        </div>
        <div class="form-group">
          <label>Initial Balance</label>
          <input type="number" [(ngModel)]="newBalance" placeholder="0.00" />
        </div>
      </div>
      <button class="btn-primary" (click)="createAccount()" [disabled]="creating">
        <span class="spinner" *ngIf="creating"></span>
        Create Account
      </button>
    </div>

    <!-- Accounts table -->
    <div class="card">
      <h2>All Accounts</h2>
      <table *ngIf="accounts.length > 0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Currency</th>
            <th>Balance</th>
            <th>Customer</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of accounts">
            <td>
              <a [routerLink]="['/accounts', a.id]" class="mono link">{{ a.id }}</a>
            </td>
            <td>{{ a.type }}</td>
            <td>{{ a.currency || 'USD' }}</td>
            <td class="mono">{{ a.balance | number:'1.2-2' }}</td>
            <td class="mono text-muted">{{ a.customerId }}</td>
            <td>
              <div class="action-bar">
                <button class="btn-sm" (click)="seed(a.id)">Seed</button>
                <button class="btn-sm btn-danger" (click)="reset(a.id)">Reset</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="accounts.length === 0 && !loading">No accounts. Create one or seed tenant data.</div>
      <div class="empty-state" *ngIf="loading"><span class="spinner"></span> Loading...</div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
    .link { color: var(--color-primary); text-decoration: none; }
    .link:hover { text-decoration: underline; }
  `],
})
export class AccountsComponent implements OnInit {
  accounts: any[] = [];
  newCustomerId = '';
  newType = 'checking';
  newCurrency = 'USD';
  newBalance = 0;
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
    this.api.listAccounts().subscribe({
      next: (res) => { this.accounts = res.data ?? []; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  createAccount(): void {
    this.error = '';
    this.successMsg = '';
    this.creating = true;
    this.api.createAccount({
      customer_id: this.newCustomerId,
      type: this.newType,
      currency: this.newCurrency || undefined,
      initial_balance: this.newBalance,
    }).subscribe({
      next: () => {
        this.creating = false;
        this.successMsg = 'Account created';
        this.newCustomerId = '';
        this.newBalance = 0;
        this.load();
      },
      error: (err) => {
        this.creating = false;
        this.error = err.error?.message || 'Failed to create account';
      },
    });
  }

  seed(id: string): void {
    this.api.seedAccount(id).subscribe({
      next: () => { this.successMsg = `Account ${id} seeded`; this.load(); },
      error: (err) => { this.error = err.error?.message || 'Seed failed'; },
    });
  }

  reset(id: string): void {
    if (!confirm('Reset all data for this account?')) return;
    this.api.resetAccount(id).subscribe({
      next: () => { this.successMsg = `Account ${id} reset`; this.load(); },
      error: (err) => { this.error = err.error?.message || 'Reset failed'; },
    });
  }
}
