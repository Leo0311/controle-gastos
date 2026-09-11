import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { provedoresDeTeste } from '../../testing/test-providers';
import { PaginaNaoEncontradaComponent } from './pagina-nao-encontrada.component';

describe('PaginaNaoEncontradaComponent', () => {
  let component: PaginaNaoEncontradaComponent;
  let fixture: ComponentFixture<PaginaNaoEncontradaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginaNaoEncontradaComponent],
      providers: [...provedoresDeTeste()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaginaNaoEncontradaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mostra a mensagem de página não encontrada', () => {
    expect(fixture.nativeElement.textContent).toContain('Página não encontrada.');
  });

  it('tem um link de volta pro dashboard', () => {
    const link = fixture.debugElement.query(By.directive(RouterLink));
    expect(link.injector.get(RouterLink).href).toBe('/dashboard');
  });
});
