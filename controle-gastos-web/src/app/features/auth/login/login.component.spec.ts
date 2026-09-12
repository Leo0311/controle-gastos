import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { NEVER } from 'rxjs';

import { LoginComponent } from './login.component';
import { provedoresDeTeste } from '../../../testing/test-providers';
import { API_BASE_URL } from '../../../core/api.constants';
import { NotificacaoService } from '../../../core/notificacao.service';
import { GoogleSignInService } from '../../../services/google-sign-in.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let notificacao: NotificacaoService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provedoresDeTeste(),
        // GoogleSignInButtonComponent chama precarregar() já no ngOnInit -
        // sem esse mock, o teste tocaria o DOM/window.google de verdade
        // (inserção de <script> real) só por montar a tela, sem relação com
        // o que este spec testa (isso é coberto em GoogleSignInService/
        // GoogleSignInButtonComponent specs).
        { provide: GoogleSignInService, useValue: { credencial$: NEVER, erro$: NEVER, precarregar: () => {}, solicitarLogin: () => {} } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
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

  it('entrarComGoogle chama POST /auth/google e navega pro dashboard em caso de sucesso', () => {
    const navigateSpy = spyOn(router, 'navigate');

    component.entrarComGoogle('access-token-fake');

    const req = httpMock.expectOne(`${API_BASE_URL}/auth/google`);
    expect(req.request.body).toEqual({ accessToken: 'access-token-fake' });
    req.flush({ token: 'jwt', usuarioId: 1, nome: 'Léo', email: 'leo@example.com' });

    expect(component.carregando).toBeFalse();
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('entrarComGoogle mostra notificação de erro quando o backend recusa o login', () => {
    const erroSpy = spyOn(notificacao, 'erro');

    component.entrarComGoogle('access-token-invalido');

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
