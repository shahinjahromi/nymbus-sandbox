import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h1 class="page-title">Customers</h1>

    <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
    <div class="alert alert-success" *ngIf="successMsg">{{ successMsg }}</div>

    <!-- Create customer -->
    <div class="card">
      <h2>Create Customer</h2>
      <div class="form-row">
        <div class="form-group">
          <label>First Name</label>
          <input type="text" [(ngModel)]="newFirstName" placeholder="Jane" />
        </div>
        <div class="form-group">
          <label>Last Name</label>
          <input type="text" [(ngModel)]="newLastName" placeholder="Doe" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" [(ngModel)]="newEmail" placeholder="jane@example.com" />
        </div>
        <div class="form-group">
          <label>External ID (optional)</label>
          <input type="text" [(ngModel)]="newExternalId" placeholder="ext-123" />
        </div>
      </div>
      <button class="btn-primary" (click)="createCustomer()" [disabled]="creating">
        <span class="spinner" *ngIf="creating"></span>
        Create Customer
      </button>
    </div>

    <!-- Customers table -->
    <div class="card">
      <h2>All Customers</h2>
      <table *ngIf="customers.length > 0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>External ID</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let c of customers">
            <td class="mono">{{ c.id }}</td>
            <td>{{ c.firstName }} {{ c.lastName }}</td>
            <td class="mono">{{ c.email }}</td>
            <td class="mono text-muted">{{ c.externalId || '—' }}</td>
            <td class="text-muted">{{ c.createdAt | date:'short' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="customers.length === 0 && !loading">No customers. Create one or seed tenant data.</div>
      <div class="empty-state" *ngIf="loading"><span class="spinner"></span> Loading...</div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
  `],
})
export class CustomersComponent implements OnInit {
  customers: any[] = [];
  newFirstName = '';
  newLastName = '';
  newEmail = '';
  newExternalId = '';
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
    this.api.listUsers().subscribe({
      next: (res) => { this.customers = res.data ?? []; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  createCustomer(): void {
    this.error = '';
    this.successMsg = '';
    this.creating = true;
    this.api.createUser({
      first_name: this.newFirstName,
      last_name: this.newLastName,
      email: this.newEmail,
      external_id: this.newExternalId || undefined,
    }).subscribe({
      next: () => {
        this.creating = false;
        this.successMsg = 'Customer created';
        this.newFirstName = '';
        this.newLastName = '';
        this.newEmail = '';
        this.newExternalId = '';
        this.load();
      },
      error: (err) => {
        this.creating = false;
        this.error = err.error?.message || 'Failed to create customer';
      },
    });
  }
}
