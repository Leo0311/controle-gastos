import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { guestGuard } from './core/guest.guard';
import { DashboardComponent } from './features/dashboard/dashboard/dashboard.component';
import { GastosComponent } from './features/gastos/gastos/gastos.component';
import { OrcamentosComponent } from './features/orcamentos/orcamentos/orcamentos.component';
import { AnalisesComponent } from './features/analises/analises/analises.component';
import { CategoriasComponent } from './features/categorias/categorias/categorias.component';
import { GastosRecorrentesComponent } from './features/gastos-recorrentes/gastos-recorrentes/gastos-recorrentes.component';
import { LoginComponent } from './features/auth/login/login.component';
import { CadastroComponent } from './features/auth/cadastro/cadastro.component';
import { EsqueciSenhaComponent } from './features/auth/esqueci-senha/esqueci-senha.component';
import { RedefinirSenhaComponent } from './features/auth/redefinir-senha/redefinir-senha.component';
import { PaginaNaoEncontradaComponent } from './features/pagina-nao-encontrada/pagina-nao-encontrada.component';

export const routes: Routes = [
  { path: '', redirectTo: 'gastos', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'cadastro', component: CadastroComponent, canActivate: [guestGuard] },
  { path: 'esqueci-senha', component: EsqueciSenhaComponent, canActivate: [guestGuard] },
  { path: 'redefinir-senha', component: RedefinirSenhaComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'gastos', component: GastosComponent, canActivate: [authGuard] },
  { path: 'orcamentos', component: OrcamentosComponent, canActivate: [authGuard] },
  { path: 'analises', component: AnalisesComponent, canActivate: [authGuard] },
  { path: 'categorias', component: CategoriasComponent, canActivate: [authGuard] },
  { path: 'gastos-recorrentes', component: GastosRecorrentesComponent, canActivate: [authGuard] },
  // Sempre por último: pega qualquer URL que não bateu com nenhuma rota acima
  // (ver PaginaNaoEncontradaComponent).
  { path: '**', component: PaginaNaoEncontradaComponent }
];
