import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = '/portal-api';

  constructor(private http: HttpClient) {}

  /* ── Auth ── */
  register(email: string, password: string, name?: string): Observable<any> {
    return this.http.post(`${this.base}/register`, { email, password, name });
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.base}/login`, { email, password });
  }

  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.base}/password-reset/request`, { email });
  }

  confirmPasswordReset(email: string, otp: string, new_password: string): Observable<any> {
    return this.http.post(`${this.base}/password-reset/confirm`, { email, otp, new_password });
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.base}/me`);
  }

  /* ── Credentials ── */
  listCredentials(): Observable<any> {
    return this.http.get(`${this.base}/credentials`);
  }

  createCredential(label?: string, expires_at?: string): Observable<any> {
    return this.http.post(`${this.base}/credentials`, { label, expires_at });
  }

  revokeCredential(id: string): Observable<any> {
    return this.http.post(`${this.base}/credentials/${id}/revoke`, {});
  }

  rotateCredential(id: string): Observable<any> {
    return this.http.post(`${this.base}/credentials/${id}/rotate`, {});
  }

  /* ── Users/Customers ── */
  listUsers(): Observable<any> {
    return this.http.get(`${this.base}/users`);
  }

  createUser(body: { first_name: string; last_name: string; email: string; external_id?: string }): Observable<any> {
    return this.http.post(`${this.base}/users`, body);
  }

  /* ── Accounts ── */
  listAccounts(): Observable<any> {
    return this.http.get(`${this.base}/accounts`);
  }

  createAccount(body: { customer_id: string; type: string; currency?: string; initial_balance?: number }): Observable<any> {
    return this.http.post(`${this.base}/accounts`, body);
  }

  getAccount(id: string): Observable<any> {
    return this.http.get(`${this.base}/accounts/${id}`);
  }

  getAccountTransactions(id: string): Observable<any> {
    return this.http.get(`${this.base}/accounts/${id}/transactions`);
  }

  seedAccount(id: string): Observable<any> {
    return this.http.post(`${this.base}/accounts/${id}/seed`, {});
  }

  resetAccount(id: string): Observable<any> {
    return this.http.post(`${this.base}/accounts/${id}/reset`, {});
  }

  /* ── Tenant ── */
  resetTenant(): Observable<any> {
    return this.http.post(`${this.base}/tenant/reset`, {});
  }

  seedTenant(): Observable<any> {
    return this.http.post(`${this.base}/tenant/seed`, {});
  }

  /* ── Simulations ── */
  simulateAchIncoming(body: { account_id: string; amount: number; description?: string; external_name?: string }): Observable<any> {
    return this.http.post(`${this.base}/simulations/ach-incoming`, body);
  }

  simulateWireIncoming(body: { account_id: string; amount: number; description?: string; external_name?: string }): Observable<any> {
    return this.http.post(`${this.base}/simulations/wire-incoming`, body);
  }

  simulateAchOutgoing(body: {
    account_id: string; amount: number;
    routing_number: string; account_number: string;
    recipient_name?: string; description?: string;
  }): Observable<any> {
    return this.http.post(`${this.base}/simulations/ach-outgoing`, body);
  }

  simulateCard(body: {
    account_id: string; amount: number;
    event_type?: string; reference_id?: string; description?: string;
  }): Observable<any> {
    return this.http.post(`${this.base}/simulations/card`, body);
  }

  /* ── Yield / Interest ── */
  getYieldConfig(accountId: string): Observable<any> {
    return this.http.get(`${this.base}/accounts/${accountId}/yield-config`);
  }

  setYieldConfig(accountId: string, apy: number, enabled: boolean): Observable<any> {
    return this.http.post(`${this.base}/accounts/${accountId}/yield-config`, { apy, enabled });
  }

  accrueDailyInterest(as_of_date?: string): Observable<any> {
    return this.http.post(`${this.base}/interest/accrue-daily`, { as_of_date });
  }

  /* ── Observability ── */
  listApiActivity(params?: { method?: string; path_contains?: string; status?: string; limit?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) httpParams = httpParams.set(k, v);
      });
    }
    return this.http.get(`${this.base}/api-activity`, { params: httpParams });
  }

  listAuditLog(limit?: number): Observable<any> {
    let httpParams = new HttpParams();
    if (limit) httpParams = httpParams.set('limit', String(limit));
    return this.http.get(`${this.base}/audit`, { params: httpParams });
  }

  /* ── Contract ── */
  getContractMetadata(): Observable<any> {
    return this.http.get(`${this.base}/contract/metadata`);
  }

  getContractChangelog(): Observable<any> {
    return this.http.get(`${this.base}/contract/changelog`);
  }

  getContractDeprecations(): Observable<any> {
    return this.http.get(`${this.base}/contract/deprecations`);
  }

  getContractEndpoints(): Observable<any> {
    return this.http.get(`${this.base}/contract/endpoints`);
  }

  /* ── Server Info ── */
  getServerInfo(): Observable<any> {
    return this.http.get(`${this.base}/server-info`);
  }
}
