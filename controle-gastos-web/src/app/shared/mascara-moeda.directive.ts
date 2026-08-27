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
 *
 * A lógica roda inteiramente em cima do evento "beforeinput" (não keydown):
 * teclados virtuais (Android/iOS) frequentemente não disparam keydown com
 * key:"Backspace" para a tecla de apagar - por causa da composição do
 * teclado, ela chega como key:"Unidentified", então uma máscara baseada em
 * keydown simplesmente não reage no celular. O "beforeinput" sempre carrega
 * o inputType real (insertText, deleteContentBackward etc.), é cancelável
 * em qualquer plataforma e por isso é o único jeito confiável de ter o
 * mesmo comportamento em desktop e mobile.
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

  @HostListener('beforeinput', ['$event'])
  onBeforeInput(evento: InputEvent): void {
    const alvo = evento.target as HTMLInputElement;
    const haSelecao = alvo.selectionStart !== alvo.selectionEnd;

    switch (evento.inputType) {
      case 'insertText':
      case 'insertCompositionText':
      case 'insertFromDrop': {
        evento.preventDefault();
        const digitos = (evento.data ?? '').replace(/\D/g, '');
        for (const digito of digitos) {
          if (this.centavos < MAX_CENTAVOS) {
            this.centavos = this.centavos * 10 + Number(digito);
          }
        }
        this.emitirEAtualizar();
        return;
      }

      case 'deleteContentBackward':
      case 'deleteContentForward':
      case 'deleteByCut': {
        evento.preventDefault();
        // Com uma seleção ativa (Ctrl+A, seleção manual, ou "cortar"), apagar
        // limpa o campo inteiro em vez de remover só um dígito - selecionar
        // tudo e apertar Backspace/Delete precisa esvaziar o campo de verdade.
        this.centavos = haSelecao ? 0 : Math.trunc(this.centavos / 10);
        this.emitirEAtualizar();
        return;
      }

      case 'insertFromPaste':
        // Colar é tratado inteiramente pelo listener de "paste" abaixo (que já
        // dá preventDefault e nunca deixa o beforeinput correspondente rodar
        // o efeito padrão); isso aqui é só uma trava de segurança.
        evento.preventDefault();
        return;

      default:
        // Qualquer outro tipo (undo/redo, autocorreção etc.) é bloqueado para
        // manter o campo sempre controlado pelo estado em centavos.
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
