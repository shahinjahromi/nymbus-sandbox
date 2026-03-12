import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'credentials',
        loadComponent: () => import('./pages/credentials/credentials.component').then(m => m.CredentialsComponent),
      },
      {
        path: 'customers',
        loadComponent: () => import('./pages/customers/customers.component').then(m => m.CustomersComponent),
      },
      {
        path: 'accounts',
        loadComponent: () => import('./pages/accounts/accounts.component').then(m => m.AccountsComponent),
      },
      {
        path: 'accounts/:id',
        loadComponent: () => import('./pages/account-detail/account-detail.component').then(m => m.AccountDetailComponent),
      },
      {
        path: 'simulations',
        loadComponent: () => import('./pages/simulations/simulations.component').then(m => m.SimulationsComponent),
      },
      {
        path: 'activity',
        loadComponent: () => import('./pages/activity/activity.component').then(m => m.ActivityComponent),
      },
      {
        path: 'audit',
        loadComponent: () => import('./pages/audit/audit.component').then(m => m.AuditComponent),
      },
      {
        path: 'contract',
        loadComponent: () => import('./pages/contract/contract.component').then(m => m.ContractComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
