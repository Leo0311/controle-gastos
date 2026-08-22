import { Routes } from '@angular/router';

import { DashboardComponent } from './features/dashboard/dashboard/dashboard.component';
import { GastosComponent } from './features/gastos/gastos/gastos.component';
import { OrcamentosComponent } from './features/orcamentos/orcamentos/orcamentos.component';

export const routes: Routes = [
  { path: '', redirectTo: 'gastos', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'gastos', component: GastosComponent },
  { path: 'orcamentos', component: OrcamentosComponent }
];
