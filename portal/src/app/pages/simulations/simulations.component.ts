import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-simulations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h1 class="page-title">Simulations</h1>

    <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
    <div class="alert alert-success" *ngIf="successMsg">{{ successMsg }}</div>

    <div class="grid-2">
      <!-- ACH Incoming -->
      <div class="card">
        <h2>ACH Incoming</h2>
        <div class="form-group">
          <label>Account ID</label>
          <input type="text" [(ngModel)]="accountId" placeholder="acct-..." class="mono" />
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input type="number" [(ngModel)]="amount" placeholder="100.00" step="0.01" />
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <input type="text" [(ngModel)]="description" placeholder="Incoming payment" />
        </div>
        <button class="btn-primary" (click)="simulateAchIncoming()" [disabled]="loading">Simulate ACH Incoming</button>
      </div>

      <!-- Wire Incoming -->
      <div class="card">
        <h2>Wire Incoming</h2>
        <div class="form-group">
          <label>Account ID</label>
          <input type="text" [(ngModel)]="accountId" placeholder="acct-..." class="mono" />
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input type="number" [(ngModel)]="wireAmount" placeholder="5000.00" step="0.01" />
        </div>
        <div class="form-group">
          <label>External Name (optional)</label>
          <input type="text" [(ngModel)]="externalName" placeholder="Wire sender" />
        </div>
        <button class="btn-primary" (click)="simulateWireIncoming()" [disabled]="loading">Simulate Wire Incoming</button>
      </div>

      <!-- ACH Outgoing -->
      <div class="card">
        <h2>ACH Outgoing</h2>
        <div class="form-group">
          <label>Account ID</label>
          <input type="text" [(ngModel)]="accountId" placeholder="acct-..." class="mono" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Routing #</label>
            <input type="text" [(ngModel)]="routingNumber" placeholder="021000021" class="mono" />
          </div>
          <div class="form-group">
            <label>Account #</label>
            <input type="text" [(ngModel)]="accountNumber" placeholder="1234567890" class="mono" />
          </div>
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input type="number" [(ngModel)]="achOutAmount" placeholder="50.00" step="0.01" />
        </div>
        <div class="form-group">
          <label>Recipient Name</label>
          <input type="text" [(ngModel)]="recipientName" placeholder="Jane Doe" />
        </div>
        <button class="btn-primary" (click)="simulateAchOutgoing()" [disabled]="loading">Simulate ACH Outgoing</button>
      </div>

      <!-- Card Event -->
      <div class="card">
        <h2>Card Network Event</h2>
        <div class="form-group">
          <label>Account ID</label>
          <input type="text" [(ngModel)]="accountId" placeholder="acct-..." class="mono" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Event Type</label>
            <select [(ngModel)]="cardEventType">
              <option value="authorization">Authorization</option>
              <option value="post">Post</option>
              <option value="void">Void</option>
              <option value="refund">Refund</option>
            </select>
          </div>
          <div class="form-group">
            <label>Amount</label>
            <input type="number" [(ngModel)]="cardAmount" placeholder="25.00" step="0.01" />
          </div>
        </div>
        <div class="form-group">
          <label>Reference ID (for post/void/refund)</label>
          <input type="text" [(ngModel)]="cardReferenceId" placeholder="ref-..." class="mono" />
        </div>
        <button class="btn-primary" (click)="simulateCard()" [disabled]="loading">Simulate Card Event</button>
      </div>
    </div>

    <!-- Result -->
    <div class="card" *ngIf="lastResult">
      <h2>Simulation Result</h2>
      <pre class="json-output">{{ lastResult | json }}</pre>
    </div>
  `,
  styles: [`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
  `],
})
export class SimulationsComponent {
  accountId = '';
  amount = 0;
  wireAmount = 0;
  achOutAmount = 0;
  cardAmount = 0;
  description = '';
  externalName = '';
  routingNumber = '';
  accountNumber = '';
  recipientName = '';
  cardEventType = 'authorization';
  cardReferenceId = '';
  error = '';
  successMsg = '';
  loading = false;
  lastResult: any = null;

  constructor(private api: ApiService) {}

  simulateAchIncoming(): void {
    this.clearStatus();
    this.loading = true;
    this.api.simulateAchIncoming({
      account_id: this.accountId,
      amount: this.amount,
      description: this.description || undefined,
    }).subscribe({
      next: (res) => { this.loading = false; this.lastResult = res; this.successMsg = 'ACH Incoming simulated'; },
      error: (err) => { this.loading = false; this.error = err.error?.message || 'Simulation failed'; },
    });
  }

  simulateWireIncoming(): void {
    this.clearStatus();
    this.loading = true;
    this.api.simulateWireIncoming({
      account_id: this.accountId,
      amount: this.wireAmount,
      external_name: this.externalName || undefined,
    }).subscribe({
      next: (res) => { this.loading = false; this.lastResult = res; this.successMsg = 'Wire Incoming simulated'; },
      error: (err) => { this.loading = false; this.error = err.error?.message || 'Simulation failed'; },
    });
  }

  simulateAchOutgoing(): void {
    this.clearStatus();
    this.loading = true;
    this.api.simulateAchOutgoing({
      account_id: this.accountId,
      amount: this.achOutAmount,
      routing_number: this.routingNumber,
      account_number: this.accountNumber,
      recipient_name: this.recipientName || undefined,
    }).subscribe({
      next: (res) => { this.loading = false; this.lastResult = res; this.successMsg = 'ACH Outgoing simulated'; },
      error: (err) => { this.loading = false; this.error = err.error?.message || 'Simulation failed'; },
    });
  }

  simulateCard(): void {
    this.clearStatus();
    this.loading = true;
    this.api.simulateCard({
      account_id: this.accountId,
      amount: this.cardAmount,
      event_type: this.cardEventType,
      reference_id: this.cardReferenceId || undefined,
    }).subscribe({
      next: (res) => { this.loading = false; this.lastResult = res; this.successMsg = `Card ${this.cardEventType} simulated`; },
      error: (err) => { this.loading = false; this.error = err.error?.message || 'Simulation failed'; },
    });
  }

  private clearStatus(): void {
    this.error = '';
    this.successMsg = '';
    this.lastResult = null;
  }
}
