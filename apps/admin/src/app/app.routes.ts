import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { StaffStore } from './core/staff.store';

/** Signed in with a phone that maps to a StaffUser. */
const requireStaff: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const staff = inject(StaffStore);
  const router = inject(Router);
  await auth.ready;
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  return (await staff.load()) ? true : router.createUrlTree(['/login']);
};

/** Kitchen staff only see the KDS. */
const requireMenuRole: CanActivateFn = () => {
  const staff = inject(StaffStore);
  return staff.canEditMenu() ? true : inject(Router).createUrlTree(['/kds']);
};

const homeRedirect: CanActivateFn = () =>
  inject(Router).createUrlTree([inject(StaffStore).canEditMenu() ? '/orders' : '/kds']);

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage), title: 'Sign in · BARit Admin' },
  {
    path: 'kds',
    canActivate: [requireStaff],
    loadComponent: () => import('./pages/kds.page').then((m) => m.KdsPage),
    title: 'Kitchen · BARit',
  },
  {
    path: '',
    canActivate: [requireStaff],
    loadComponent: () => import('./shell').then((m) => m.Shell),
    children: [
      { path: 'orders', canActivate: [requireMenuRole], loadComponent: () => import('./pages/orders.page').then((m) => m.OrdersPage), title: 'Live orders · BARit Admin' },
      { path: 'menu', canActivate: [requireMenuRole], loadComponent: () => import('./pages/menu.page').then((m) => m.MenuPage), title: 'Menu · BARit Admin' },
      { path: 'tables', canActivate: [requireMenuRole], loadComponent: () => import('./pages/tables.page').then((m) => m.TablesPage), title: 'Tables · BARit Admin' },
      { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },
    ],
  },
  { path: '**', redirectTo: '' },
];
