import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErroCarregamentoComponent } from './erro-carregamento.component';

describe('ErroCarregamentoComponent', () => {
  let component: ErroCarregamentoComponent;
  let fixture: ComponentFixture<ErroCarregamentoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErroCarregamentoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ErroCarregamentoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('monta a mensagem a partir de oQue', () => {
    component.oQue = 'os gastos';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p').textContent)
      .toContain('Não foi possível carregar os gastos.');
  });

  it('emite tentarNovamente ao clicar no botão', () => {
    const spy = jasmine.createSpy('tentarNovamente');
    component.tentarNovamente.subscribe(spy);
    fixture.nativeElement.querySelector('button').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
