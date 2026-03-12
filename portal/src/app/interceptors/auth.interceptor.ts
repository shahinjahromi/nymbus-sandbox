import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { tap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  let request = req;
  const token = auth.token;
  if (token) {
    request = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(request).pipe(
    tap({
      error: (err) => {
        if (err.status === 401 && !req.url.includes('/login') && !req.url.includes('/register')) {
          auth.logout();
          router.navigate(['/login']);
        }
      },
    })
  );
};
