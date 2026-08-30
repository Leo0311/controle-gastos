import { Injectable } from '@angular/core';
import { MatDateFormats, NativeDateAdapter } from '@angular/material/core';

/**
 * DateAdapter para o formato brasileiro `dd/MM/aaaa`.
 *
 * O NativeDateAdapter do Material faz `new Date(Date.parse(texto))` ao ler o
 * que foi digitado - e `Date.parse("15/03/2026")` no V8 tenta interpretar como
 * MM/DD/AAAA, falha (mês 15) e devolve um `Invalid Date` (não `null`). Esse
 * `Invalid Date` passa no `Validators.required` e só quebra lá na frente
 * (`getFullYear()` vira `NaN`, a API recebe "NaN-NaN-NaN"). Por isso digitar a
 * data manualmente ficava instável, enquanto escolher pelo calendário (que já
 * entrega um `Date` válido) funcionava.
 *
 * Este adapter faz o parse explícito de `dd/MM/aaaa` (aceitando também `-` e `.`
 * como separador, `d/M/aa` e os 8 dígitos colados `ddMMaaaa`) e devolve `null`
 * para qualquer coisa incompleta ou inválida - nunca um `Invalid Date`.
 */
@Injectable()
export class PtBrDateAdapter extends NativeDateAdapter {

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const componentes = extrairComponentes(value.trim());
      if (!componentes) {
        return null;
      }
      const [dia, mes, ano] = componentes;
      if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
        return null;
      }
      try {
        // createDate valida o dia contra o mês real (rejeita 31/02, 29/02 em
        // ano não bissexto etc.) lançando erro - nunca "rola" para o mês seguinte.
        return this.createDate(ano, mes - 1, dia);
      } catch {
        return null;
      }
    }
    return super.parse(value as string | number, parseFormat as object);
  }

  override format(date: Date, displayFormat: object): string {
    if (displayFormat === FORMATOS_DATA_PT_BR.display.dateInput) {
      const dia = String(this.getDate(date)).padStart(2, '0');
      const mes = String(this.getMonth(date) + 1).padStart(2, '0');
      return `${dia}/${mes}/${this.getYear(date)}`;
    }
    return super.format(date, displayFormat);
  }
}

function extrairComponentes(texto: string): [dia: number, mes: number, ano: number] | null {
  const comSeparador = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(texto);
  if (comSeparador) {
    return [Number(comSeparador[1]), Number(comSeparador[2]), normalizarAno(comSeparador[3])];
  }
  const soDigitos = /^(\d{2})(\d{2})(\d{4})$/.exec(texto);
  if (soDigitos) {
    return [Number(soDigitos[1]), Number(soDigitos[2]), Number(soDigitos[3])];
  }
  return null;
}

// Ano com 2 dígitos: assume 20xx (o app lida com gastos recentes, não com datas
// históricas). "26" -> 2026.
function normalizarAno(ano: string): number {
  return ano.length === 2 ? 2000 + Number(ano) : Number(ano);
}

export const FORMATOS_DATA_PT_BR: MatDateFormats = {
  parse: {
    dateInput: { day: 'numeric', month: 'numeric', year: 'numeric' }
  },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' }
  }
};
