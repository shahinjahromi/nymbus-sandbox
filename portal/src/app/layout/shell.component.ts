import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <!-- Mobile backdrop -->
      <div class="sidebar-backdrop" [class.visible]="sidebarOpen" (click)="closeSidebar()"></div>

      <!-- Sidebar -->
      <aside class="sidebar" [class.open]="sidebarOpen">
        <div class="sidebar-brand">
          <div class="brand-icon">N</div>
          <div>
            <div class="brand-title">Nymbus Sandbox</div>
            <div class="brand-env"><span class="badge badge-sandbox">sandbox</span></div>
          </div>
          <button class="sidebar-close" (click)="closeSidebar()" aria-label="Close menu">&times;</button>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section">Overview</div>
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">&#9632;</span> Dashboard
          </a>

          <div class="nav-section">Integration</div>
          <a routerLink="/credentials" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">&#128273;</span> Credentials
          </a>
          <a routerLink="/contract" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">&#128196;</span> API Contract
          </a>

          <div class="nav-section">Data</div>
          <a routerLink="/customers" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">&#128101;</span> Customers
          </a>
          <a routerLink="/accounts" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">&#128179;</span> Accounts
          </a>

          <div class="nav-section">Simulation</div>
          <a routerLink="/simulations" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">&#9889;</span> Simulations
          </a>

          <div class="nav-section">Observability</div>
          <a routerLink="/activity" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">&#128200;</span> API Activity
          </a>
          <a routerLink="/audit" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">&#128220;</span> Audit Trail
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="nav-section">Tenant</div>
          <button class="nav-item tenant-btn" (click)="seedTenant(); closeSidebar()">
            <span class="nav-icon">&#127793;</span> Seed Data
          </button>
          <button class="nav-item tenant-btn danger" (click)="resetTenant()">
            <span class="nav-icon">&#128465;</span> Reset All Data
          </button>
        </div>
      </aside>

      <!-- Main area -->
      <div class="main">
        <header class="topbar">
          <div class="topbar-left">
            <button class="hamburger" (click)="toggleSidebar()" aria-label="Open menu">
              <span></span><span></span><span></span>
            </button>
            <div class="topbar-title">Developer Portal</div>
          </div>
          <div class="topbar-right">
            <span class="user-email" *ngIf="user$ | async as user">{{ user.email }}</span>
            <button class="btn-sm" (click)="logout()">Logout</button>
          </div>
        </header>

        <div class="content">
          <div class="toast" *ngIf="toastMsg" [class.toast-success]="toastType==='success'" [class.toast-danger]="toastType==='danger'">
            {{ toastMsg }}
          </div>
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      background: #1a1d23;
      color: #c9d1d9;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 16px 12px;
      border-bottom: 1px solid #30363d;
    }
    .brand-icon {
      width: 32px;
      height: 32px;
      background: var(--color-primary);
      color: #fff;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 16px;
    }
    .brand-title { font-weight: 600; font-size: 14px; color: #fff; }
    .brand-env { margin-top: 2px; }

    .sidebar-nav {
      flex: 1;
      padding: 8px 0;
    }
    .nav-section {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6e7681;
      padding: 12px 16px 4px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      color: #c9d1d9;
      text-decoration: none;
      font-size: 13px;
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      font-family: var(--font-sans);
      transition: background 0.15s;
    }
    .nav-item:hover { background: #21262d; }
    .nav-item.active {
      background: #21262d;
      color: #fff;
      border-left: 3px solid var(--color-primary);
      padding-left: 13px;
    }
    .nav-icon { width: 18px; text-align: center; font-size: 14px; }

    .sidebar-footer {
      border-top: 1px solid #30363d;
      padding: 8px 0 12px;
    }
    .tenant-btn { font-size: 12px; }
    .tenant-btn.danger:hover { color: var(--color-danger); }

    /* ── Main ── */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .topbar {
      height: var(--header-height);
      min-height: var(--header-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
    }
    .topbar-title { font-weight: 600; font-size: 15px; }
    .topbar-left { display: flex; align-items: center; gap: 12px; }
    .topbar-right { display: flex; align-items: center; gap: 12px; }
    .user-email { font-size: 13px; color: var(--color-text-muted); }

    /* ── Hamburger button (hidden on desktop) ── */
    .hamburger {
      display: none;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      width: 32px;
      height: 32px;
      padding: 4px;
      border: none;
      background: none;
      cursor: pointer;
    }
    .hamburger span {
      display: block;
      height: 2px;
      width: 100%;
      background: var(--color-text);
      border-radius: 1px;
      transition: transform 0.2s;
    }

    /* ── Sidebar close button (mobile only) ── */
    .sidebar-close {
      display: none;
      margin-left: auto;
      background: none;
      border: none;
      color: #c9d1d9;
      font-size: 24px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .sidebar-close:hover { color: #fff; }

    /* ── Mobile backdrop ── */
    .sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 99;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    /* ── Toast ── */
    .toast {
      position: fixed;
      top: 16px;
      right: 24px;
      z-index: 1000;
      padding: 10px 20px;
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 500;
      animation: fadeIn 0.2s ease;
    }
    .toast-success { background: #d1e7dd; color: #0a3622; border: 1px solid #a3cfbb; }
    .toast-danger { background: #f8d7da; color: #58151c; border: 1px solid #f1aeb5; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

    /* ── Mobile responsive ── */
    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: 100;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
      }
      .sidebar.open {
        transform: translateX(0);
      }
      .sidebar-close { display: block; }
      .sidebar-backdrop.visible {
        display: block;
      }
      .hamburger { display: flex; }
      .topbar { padding: 0 12px; }
      .content { padding: 16px; }
      .user-email { display: none; }
      .toast { right: 12px; left: 12px; }
    }
  `],
})
export class ShellComponent {
  user$;
  toastMsg = '';
  toastType: 'success' | 'danger' = 'success';
  sidebarOpen = false;

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private router: Router,
  ) {
    this.user$ = this.auth.user$;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  seedTenant(): void {
    this.api.seedTenant().subscribe({
      next: () => this.showToast('Tenant data seeded successfully', 'success'),
      error: () => this.showToast('Failed to seed tenant data', 'danger'),
    });
  }

  resetTenant(): void {
    if (!confirm('Reset ALL tenant data? This cannot be undone.')) return;
    this.api.resetTenant().subscribe({
      next: () => this.showToast('Tenant data reset', 'success'),
      error: () => this.showToast('Failed to reset tenant data', 'danger'),
    });
  }

  private showToast(msg: string, type: 'success' | 'danger'): void {
    this.toastMsg = msg;
    this.toastType = type;
    setTimeout(() => (this.toastMsg = ''), 3000);
  }
}
