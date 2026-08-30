import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';

import { FORMATOS_DATA_PT_BR, PtBrDateAdapter } from './pt-br-date-adapter';

describe('PtBrDateAdapter', () => {
  let adapter: DateAdapter<Date>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
        { provide: DateAdapter, useClass: PtBrDateAdapter }
      ]
    });
    adapter = TestBed.inject(DateAdapter);
  });

  it('faz parse de dd/MM/aaaa digitado', () => {
    const d = adapter.parse('15/03/2026', {})!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // março
    expect(d.getDate()).toBe(15);
  });

  it('aceita separador - e . e ano com 2 dígitos e 8 dígitos colados', () => {
    for (const texto of ['15-03-2026', '15.03.2026', '15/03/26', '15032026']) {
      const d = adapter.parse(texto, {})!;
      expect(d.getFullYear()).withContext(texto).toBe(2026);
      expect(d.getMonth()).withContext(texto).toBe(2);
      expect(d.getDate()).withContext(texto).toBe(15);
    }
  });

  it('devolve null (nunca Invalid Date) para texto incompleto ou inválido', () => {
    for (const texto of ['', '15', '15/03', '15/', 'abc', '99/99/2026', '31/02/2026', '15/13/2026']) {
      const resultado = adapter.parse(texto, {});
      expect(resultado).withContext(`"${texto}"`).toBeNull();
    }
  });

  it('formata Date de volta para dd/MM/aaaa no dateInput', () => {
    const texto = adapter.format(new Date(2026, 2, 5), FORMATOS_DATA_PT_BR.display.dateInput);
    expect(texto).toBe('05/03/2026');
  });

  it('round-trip: format e parse são consistentes', () => {
    const original = new Date(2025, 11, 31);
    const texto = adapter.format(original, FORMATOS_DATA_PT_BR.display.dateInput);
    const voltou = adapter.parse(texto, {})!;
    expect(voltou.getTime()).toBe(original.getTime());
  });
});
