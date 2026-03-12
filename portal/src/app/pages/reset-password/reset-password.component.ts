import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-icon">N</div>
          <h1>Nymbus Sandbox</h1>
          <span class="badge badge-sandbox">sandbox</span>
        </div>

        <h2>Reset Password</h2>

        <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
        <div class="alert alert-success" *ngIf="success">{{ success }}</div>

        <!-- Step 1: Request OTP -->
        <div *ngIf="step === 1">
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" placeholder="developer@example.com" />
          </div>
          <button class="btn-primary full-width" (click)="requestOtp()" [disabled]="loading">
            <span class="spinner" *ngIf="loading"></span>
            Send OTP
          </button>
        </div>

        <!-- Step 2: Confirm OTP + new password -->
        <div *ngIf="step === 2">
          <div class="alert alert-info" *ngIf="otpPreview">
            Sandbox OTP preview: <strong class="mono">{{ otpPreview }}</strong>
          </div>
          <div class="form-group">
            <label>OTP Code</label>
            <input type="text" [(ngModel)]="otp" placeholder="Enter OTP" class="mono" />
          </div>
          <div class="form-group">
            <label>New Password</label>
            <input type="password" [(ngModel)]="newPassword" placeholder="New password" />
          </div>
          <button class="btn-primary full-width" (click)="confirmReset()" [disabled]="loading">
            <span class="spinner" *ngIf="loading"></span>
            Reset Password
          </button>
        </div>

        <div class="auth-footer">
          <a routerLink="/login">Back to sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: var(--color-bg);
    }
    .auth-card {
      width: 100%; max-width: 400px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px; padding: 32px;
    }
    .auth-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .brand-icon {
      width: 32px; height: 32px; background: var(--color-primary); color: #fff;
      border-radius: 6px; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 16px;
    }
    .auth-brand h1 { font-size: 18px; font-weight: 600; flex: 1; }
    h2 { font-size: 15px; font-weight: 500; margin-bottom: 20px; color: var(--color-text-muted); }
    .full-width { width: 100%; justify-content: center; margin-top: 8px; }
    .auth-footer { text-align: center; margin-top: 16px; font-size: 13px; }
    .auth-footer a { color: var(--color-primary); text-decoration: none; }
  `],
})
export class ResetPasswordComponent {
  step = 1;
  email = '';
  otp = '';
  otpPreview = '';
  newPassword = '';
  error = '';
  success = '';
  loading = false;

  constructor(private api: ApiService) {}

  requestOtp(): void {
    this.error = '';
    this.loading = true;
    this.api.requestPasswordReset(this.email).subscribe({
      next: (res) => {
        this.loading = false;
        this.otpPreview = res.otpPreview || '';
        this.step = 2;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Failed to request OTP';
      },
    });
  }

  confirmReset(): void {
    this.error = '';
    this.loading = true;
    this.api.confirmPasswordReset(this.email, this.otp, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Password reset successfully! You can now sign in.';
        this.step = 1;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'OTP invalid or expired';
      },
    });
  }
}
