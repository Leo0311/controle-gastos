import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// Maior valor aceito (R$ 9.999.999.999,99) - só para evitar que o número de
// centavos estoure a precisão segura de inteiro do JavaScript.
const MAX_CENTAVOS = 999999999999;

/**
 * Máscara de valor monetário estilo "caixa registradora": os dígitos digitados
 * entram da direita para a esquerda, preenchendo primeiro os centavos (ex:
 * digitar 1, 0, 1, 0 em sequência mostra 0,01 -> 0,10 -> 1,01 -> 10,10).
 * O FormControl associado sempre recebe o valor decimal real (ex: 10.10),
 * nunca a string formatada - a formatação é só a exibição no input.
 */
@Directive({
  selector: 'input[appMascaraMoeda]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MascaraMoedaDirective),
      multi: true
    }
  ],
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off'
  }
})
export class MascaraMoedaDirective implements ControlValueAccessor {

  private centavos = 0;
  private onChange: (valor: number | null) => void = () => { };
  private onTouched: () => void = () => { };

  constructor(private readonly el: ElementRef<HTMLInputElement>) { }

  @HostListener('keydown', ['$event'])
  onKeyDown(evento: KeyboardEvent): void {
    if (evento.ctrlKey || evento.metaKey) {
      return;
    }

    if (evento.key === 'Backspace') {
      evento.preventDefault();
      this.centavos = Math.trunc(this.centavos / 10);
      this.emitirEAtualizar();
      return;
    }

    if (evento.key >= '0' && evento.key <= '9') {
      evento.preventDefault();
      if (this.centavos < MAX_CENTAVOS) {
        this.centavos = this.centavos * 10 + Number(evento.key);
      }
      this.emitirEAtualizar();
      return;
    }

    // Bloqueia qualquer outro caractere imprimível (letras, ponto, vírgula, símbolos);
    // teclas de controle (Tab, setas, Delete, Enter...) mantêm o comportamento padrão.
    if (evento.key.length === 1) {
      evento.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(evento: ClipboardEvent): void {
    evento.preventDefault();
    const texto = (evento.clipboardData?.getData('text') ?? '').trim();
    if (!texto) {
      return;
    }

    // Texto com separador decimal explícito (ex: "1.234,56" ou "10,50"): usa o
    // valor exatamente como está escrito, em vez de tratar cada dígito como
    // um novo dígito digitado.
    const comSeparadorDecimal = texto.match(/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+[.,]\d{1,2}$/);
    if (comSeparadorDecimal) {
      const numero = Number(texto.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(numero)) {
        this.centavos = Math.min(Math.round(numero * 100), MAX_CENTAVOS);
        this.emitirEAtualizar();
        return;
      }
    }

    // Caso contrário, extrai só os dígitos e aplica a mesma lógica de digitação
    // sequencial (continuando a partir do valor atual do campo).
    const digitos = texto.replace(/\D/g, '');
    for (const digito of digitos) {
      if (this.centavos < MAX_CENTAVOS) {
        this.centavos = this.centavos * 10 + Number(digito);
      }
    }
    this.emitirEAtualizar();
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  writeValue(valor: number | null): void {
    this.centavos = valor != null && !isNaN(valor) ? Math.round(valor * 100) : 0;
    this.renderizar();
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.el.nativeElement.disabled = desabilitado;
  }

  private emitirEAtualizar(): void {
    this.renderizar();
    this.onChange(this.centavos > 0 ? this.centavos / 100 : null);
  }

  private renderizar(): void {
    this.el.nativeElement.value = this.centavos > 0
      ? (this.centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
  }
}
