import { focarPrimeiroCampoInvalido } from './form-utils';

describe('focarPrimeiroCampoInvalido', () => {
  let raiz: HTMLElement;

  beforeEach(() => {
    raiz = document.createElement('div');
    document.body.appendChild(raiz);
  });

  afterEach(() => raiz.remove());

  it('foca o primeiro campo inválido na ordem do DOM (= ordem da tela)', (done) => {
    raiz.innerHTML = `
      <input id="a" class="ng-valid">
      <input id="b" class="ng-invalid">
      <input id="c" class="ng-invalid">
    `;

    focarPrimeiroCampoInvalido(raiz);

    setTimeout(() => {
      expect(document.activeElement?.id).toBe('b');
      done();
    });
  });

  it('reconhece elementos não-input via [formcontrolname] (ex.: mat-select)', (done) => {
    raiz.innerHTML = `
      <input id="a" formcontrolname="descricao" class="ng-valid">
      <div id="sel" formcontrolname="categoria" tabindex="0" class="ng-invalid"></div>
    `;

    focarPrimeiroCampoInvalido(raiz);

    setTimeout(() => {
      expect(document.activeElement?.id).toBe('sel');
      done();
    });
  });

  it('pula campos inválidos porém desabilitados', (done) => {
    raiz.innerHTML = `
      <input id="a" class="ng-invalid" disabled>
      <input id="b" class="ng-invalid">
    `;

    focarPrimeiroCampoInvalido(raiz);

    setTimeout(() => {
      expect(document.activeElement?.id).toBe('b');
      done();
    });
  });

  it('não mexe no foco quando não há campo inválido', (done) => {
    raiz.innerHTML = `<input id="a" class="ng-valid">`;
    const focoAntes = document.activeElement;

    focarPrimeiroCampoInvalido(raiz);

    setTimeout(() => {
      expect(document.activeElement).toBe(focoAntes);
      done();
    });
  });
});
