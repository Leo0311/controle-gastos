import { CurrencyPipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { DashboardComponent } from './dashboard.component';
import { provedoresDeTeste } from '../../../testing/test-providers';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provedoresDeTeste(),
        provideCharts(withDefaultRegisterables()),
        CurrencyPipe
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('título do card de alerta', () => {
    const gasto = (descricao: string) => ({ descricao, valor: 10, categoriaId: 1, data: '2026-09-01' });

    it('com 1 conta, nomeia a conta', () => {
      component.atrasadas = [gasto('Condomínio')];
      expect(component.tituloAtrasadas).toBe('1 conta atrasada: Condomínio');

      component.venceHoje = [gasto('Netflix')];
      expect(component.tituloVenceHoje).toBe('1 conta vence hoje: Netflix');

      component.aVencer = [gasto('Internet')];
      expect(component.tituloAVencer).toBe('1 conta a vencer: Internet');
    });

    it('com mais de 1 conta, texto genérico (sem nomes)', () => {
      component.atrasadas = [gasto('a'), gasto('b')];
      expect(component.tituloAtrasadas).toBe('2 contas atrasadas');

      component.venceHoje = [gasto('a'), gasto('b'), gasto('c')];
      expect(component.tituloVenceHoje).toBe('3 contas vencem hoje');

      component.aVencer = [gasto('a'), gasto('b')];
      expect(component.tituloAVencer).toBe('2 contas a vencer');
    });
  });
});
