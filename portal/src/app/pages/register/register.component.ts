import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
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

        <h2>Create Developer Account</h2>

        <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
        <div class="alert alert-success" *ngIf="success">{{ success }}</div>

        <form (ngSubmit)="onRegister()">
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" [(ngModel)]="name" name="name" placeholder="Your name (optional)" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" name="email" placeholder="developer@example.com" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" name="password" placeholder="Choose a password" required />
          </div>
          <button type="submit" class="btn-primary full-width" [disabled]="loading">
            <span class="spinner" *ngIf="loading"></span>
            Create Account
          </button>
        </form>

        <div class="auth-footer">
          <a routerLink="/login">Already have an account? Sign in</a>
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
    .auth-footer a:hover { text-decoration: underline; }
  `],
})
export class RegisterComponent {
  email = '';
  password = '';
  name = '';
  error = '';
  success = '';
  loading = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
  ) {}

  onRegister(): void {
    this.error = '';
    this.success = '';
    this.loading = true;
    this.api.register(this.email, this.password, this.name || undefined).subscribe({
      next: () => {
        this.success = 'Account created! Logging you in...';
        this.api.login(this.email, this.password).subscribe({
          next: (res) => {
            this.auth.setSession(res);
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.loading = false;
            this.success = 'Account created! Please sign in.';
          },
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Registration failed';
      },
    });
  }
}
