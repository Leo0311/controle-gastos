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

  beforeEach(async () => {
    credencialSubject = new Subject<string>();
    erroSubject = new Subject<string>();
    solicitarLoginSpy = jasmine.createSpy('solicitarLogin');

    await TestBed.configureTestingModule({
      imports: [GoogleSignInButtonComponent],
      providers: [{
        provide: GoogleSignInService,
        useValue: {
          credencial$: credencialSubject.asObservable(),
          erro$: erroSubject.asObservable(),
          solicitarLogin: solicitarLoginSpy
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

  it('clicar no botão aciona GoogleSignInService.solicitarLogin()', () => {
    const botao: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    botao.click();

    expect(solicitarLoginSpy).toHaveBeenCalledTimes(1);
  });

  it('repassa credencial$ do serviço no output (credencial)', () => {
    const emitido: string[] = [];
    component.credencial.subscribe((idToken) => emitido.push(idToken));

    credencialSubject.next('id-token-fake');

    expect(emitido).toEqual(['id-token-fake']);
  });

  it('repassa erro$ do serviço no output (erro)', () => {
    const emitido: string[] = [];
    component.erro.subscribe((mensagem) => emitido.push(mensagem));

    erroSubject.next('Não foi possível carregar o login do Google.');

    expect(emitido).toEqual(['Não foi possível carregar o login do Google.']);
  });
});
