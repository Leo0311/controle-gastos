import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard/dashboard.component';
import { GastosComponent } from './features/gastos/gastos/gastos.component';
import { OrcamentosComponent } from './features/orcamentos/orcamentos/orcamentos.component';
import { CategoriasComponent } from './features/categorias/categorias/categorias.component';
import { LoginComponent } from './features/auth/login/login.component';
import { CadastroComponent } from './features/auth/cadastro/cadastro.component';
import { EsqueciSenhaComponent } from './features/auth/esqueci-senha/esqueci-senha.component';
import { RedefinirSenhaComponent } from './features/auth/redefinir-senha/redefinir-senha.component';

export const routes: Routes = [
  { path: '', redirectTo: 'gastos', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'cadastro', component: CadastroComponent },
  { path: 'esqueci-senha', component: EsqueciSenhaComponent },
  { path: 'redefinir-senha', component: RedefinirSenhaComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'gastos', component: GastosComponent, canActivate: [authGuard] },
  { path: 'orcamentos', component: OrcamentosComponent, canActivate: [authGuard] },
  { path: 'categorias', component: CategoriasComponent, canActivate: [authGuard] }
];
