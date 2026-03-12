import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PortalUser {
  email: string;
  name?: string;
  tenantId: string;
}

export interface PortalSession {
  portal_token: string;
  user: PortalUser;
  environment: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'portal_token';
  private readonly USER_KEY = 'portal_user';

  private userSubject = new BehaviorSubject<PortalUser | null>(this.loadUser());
  user$ = this.userSubject.asObservable();

  get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  get currentUser(): PortalUser | null {
    return this.userSubject.value;
  }

  setSession(session: PortalSession): void {
    localStorage.setItem(this.TOKEN_KEY, session.portal_token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(session.user));
    this.userSubject.next(session.user);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.userSubject.next(null);
  }

  private loadUser(): PortalUser | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
