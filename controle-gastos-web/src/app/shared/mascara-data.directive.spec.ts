import { ElementRef } from '@angular/core';

import { MascaraDataDirective } from './mascara-data.directive';

describe('MascaraDataDirective', () => {
  let input: HTMLInputElement;
  let diretiva: MascaraDataDirective;

  beforeEach(() => {
    input = document.createElement('input');
    document.body.appendChild(input);
    diretiva = new MascaraDataDirective(new ElementRef(input));
  });

  afterEach(() => input.remove());

  // Simula digitar `texto` caractere a caractere, disparando onInput a cada um
  // (como o evento 'input' real faria), respeitando o filtro de não-dígitos.
  function digitar(texto: string): void {
    for (const ch of texto) {
      input.value += ch;
      input.setSelectionRange(input.value.length, input.value.length);
      diretiva.onInput();
    }
  }

  it('insere as barras automaticamente ao digitar só dígitos', () => {
    digitar('15032026');
    expect(input.value).toBe('15/03/2026');
  });

  it('formata progressivamente enquanto digita', () => {
    input.value = '1'; diretiva.onInput(); expect(input.value).toBe('1');
    input.value = '15'; diretiva.onInput(); expect(input.value).toBe('15');
    input.value = '150'; diretiva.onInput(); expect(input.value).toBe('15/0');
    input.value = '15/03'; diretiva.onInput(); expect(input.value).toBe('15/03');
    input.value = '15/034'; diretiva.onInput(); expect(input.value).toBe('15/03/4');
  });

  it('descarta caracteres não numéricos e limita a 8 dígitos', () => {
    input.value = '1a5/b0c3/d2e0f2g6h9'; diretiva.onInput();
    expect(input.value).toBe('15/03/2026');
  });

  it('não mexe no valor quando já está formatado (deixa o datepicker reparsear)', () => {
    input.value = '15/03/2026';
    diretiva.onInput();
    expect(input.value).toBe('15/03/2026');
  });

  it('mantém o caret depois do último dígito digitado, pulando a barra', () => {
    input.value = '15';
    input.setSelectionRange(2, 2);
    input.value = '150';
    input.setSelectionRange(3, 3);
    diretiva.onInput();
    expect(input.value).toBe('15/0');
    expect(input.selectionStart).toBe(4); // depois do "0", já passou da barra
  });
});
