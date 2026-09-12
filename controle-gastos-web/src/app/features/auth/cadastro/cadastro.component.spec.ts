import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { CadastroComponent } from './cadastro.component';
import { provedoresDeTeste } from '../../../testing/test-providers';
import { API_BASE_URL } from '../../../core/api.constants';
import { NotificacaoService } from '../../../core/notificacao.service';

describe('CadastroComponent', () => {
  let component: CadastroComponent;
  let fixture: ComponentFixture<CadastroComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let notificacao: NotificacaoService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CadastroComponent],
      providers: [provedoresDeTeste()]
    }).compileComponents();

    fixture = TestBed.createComponent(CadastroComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    notificacao = TestBed.inject(NotificacaoService);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('cadastrarComGoogle chama POST /auth/google e navega pro dashboard em caso de sucesso', () => {
    const navigateSpy = spyOn(router, 'navigate');

    component.cadastrarComGoogle('id-token-fake');

    const req = httpMock.expectOne(`${API_BASE_URL}/auth/google`);
    expect(req.request.body).toEqual({ idToken: 'id-token-fake' });
    req.flush({ token: 'jwt', usuarioId: 1, nome: 'Léo', email: 'leo@example.com' });

    expect(component.carregando).toBeFalse();
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('cadastrarComGoogle mostra notificação de erro quando o backend recusa o login', () => {
    const erroSpy = spyOn(notificacao, 'erro');

    component.cadastrarComGoogle('id-token-invalido');

    const req = httpMock.expectOne(`${API_BASE_URL}/auth/google`);
    req.flush({ erro: 'O e-mail da conta Google não está verificado.' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.carregando).toBeFalse();
    expect(erroSpy).toHaveBeenCalledWith('O e-mail da conta Google não está verificado.');
  });

  it('erroGoogle repassa a mensagem do GoogleSignInButtonComponent pra notificação', () => {
    const erroSpy = spyOn(notificacao, 'erro');

    component.erroGoogle('Não foi possível carregar o login do Google.');

    expect(erroSpy).toHaveBeenCalledWith('Não foi possível carregar o login do Google.');
  });
});
