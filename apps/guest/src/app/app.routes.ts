import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';

const requireLogin: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  await auth.ready;
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/venues.page').then((m) => m.VenuesPage), title: 'BARit — venues near you' },
  { path: 'v/:slug', loadComponent: () => import('./pages/menu.page').then((m) => m.MenuPage), title: 'Menu · BARit' },
  { path: 'table/:qrToken', loadComponent: () => import('./pages/menu.page').then((m) => m.MenuPage), title: 'Order · BARit' },
  { path: 'cart', loadComponent: () => import('./pages/cart.page').then((m) => m.CartPage), title: 'Your order · BARit' },
  { path: 'login', loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage), title: 'Verify phone · BARit' },
  {
    path: 'session/:id',
    canActivate: [requireLogin],
    loadComponent: () => import('./pages/session.page').then((m) => m.SessionPage),
    title: 'Your table · BARit',
  },
  { path: '**', redirectTo: '' },
];
