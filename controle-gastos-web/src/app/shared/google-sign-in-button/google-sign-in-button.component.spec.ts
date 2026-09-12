import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { GoogleSignInButtonComponent } from './google-sign-in-button.component';
import { GoogleSignInService } from '../../services/google-sign-in.service';

describe('GoogleSignInButtonComponent', () => {
  let component: GoogleSignInButtonComponent;
  let fixture: ComponentFixture<GoogleSignInButtonComponent>;
  let credencialSubject: Subject<string>;
  let erroSubject: Subject<string>;
  let solicitarLoginSpy: jasmine.Spy;
  let precarregarSpy: jasmine.Spy;

  beforeEach(async () => {
    credencialSubject = new Subject<string>();
    erroSubject = new Subject<string>();
    solicitarLoginSpy = jasmine.createSpy('solicitarLogin');
    precarregarSpy = jasmine.createSpy('precarregar');

    await TestBed.configureTestingModule({
      imports: [GoogleSignInButtonComponent],
      providers: [{
        provide: GoogleSignInService,
        useValue: {
          credencial$: credencialSubject.asObservable(),
          erro$: erroSubject.asObservable(),
          solicitarLogin: solicitarLoginSpy,
          precarregar: precarregarSpy
        }
      }]
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleSignInButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('chama GoogleSignInService.precarregar() já no ngOnInit - antes de qualquer clique', () => {
    // Essencial pro requestAccessToken() do clique poder ser síncrono (ver
    // javadoc de GoogleSignInService) - carregar o script no clique quebraria
    // a cadeia do gesto do usuário e o popup seria bloqueado.
    expect(precarregarSpy).toHaveBeenCalledTimes(1);
  });

  it('clicar no botão aciona GoogleSignInService.solicitarLogin()', () => {
    const botao: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    botao.click();

    expect(solicitarLoginSpy).toHaveBeenCalledTimes(1);
  });

  it('repassa credencial$ do serviço no output (credencial)', () => {
    const emitido: string[] = [];
    component.credencial.subscribe((accessToken) => emitido.push(accessToken));

    credencialSubject.next('access-token-fake');

    expect(emitido).toEqual(['access-token-fake']);
  });

  it('repassa erro$ do serviço no output (erro)', () => {
    const emitido: string[] = [];
    component.erro.subscribe((mensagem) => emitido.push(mensagem));

    erroSubject.next('Não foi possível carregar o login do Google.');

    expect(emitido).toEqual(['Não foi possível carregar o login do Google.']);
  });
});
