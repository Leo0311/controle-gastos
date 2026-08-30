import { Directive, ElementRef, HostListener } from '@angular/core';

/**
 * Máscara de digitação para campo de data no formato `dd/mm/aaaa`: enquanto o
 * usuário digita, insere as barras automaticamente e descarta qualquer
 * caractere que não seja dígito (no máximo 8 dígitos).
 *
 * Diferente da MascaraMoedaDirective, esta NÃO é um ControlValueAccessor: o
 * campo de data usa `[matDatepicker]`, e é o MatDatepickerInput que continua
 * dono do valor do FormControl. Esta diretiva só cuida da aparência do texto
 * enquanto se digita - o parse do texto para `Date` é feito pelo
 * PtBrDateAdapter, e o MatDatepickerInput relê o input a cada evento `input`
 * (que esta diretiva deixa propagar normalmente).
 *
 * Roda no evento `input` (não `keydown`): teclados virtuais de celular
 * frequentemente não disparam `keydown` com a tecla real, mas `input` é
 * confiável em desktop e mobile. Reformatar depois do `input` também cobre
 * colar texto sem precisar de um listener separado de `paste`.
 */
@Directive({
  selector: 'input[appMascaraData]',
  standalone: true,
  host: {
    inputmode: 'numeric',
    autocomplete: 'off',
    placeholder: 'dd/mm/aaaa',
    maxlength: '10'
  }
})
export class MascaraDataDirective {

  constructor(private readonly el: ElementRef<HTMLInputElement>) { }

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const valorAntigo = input.value;
    const caretAntigo = input.selectionStart ?? valorAntigo.length;

    const digitos = valorAntigo.replace(/\D/g, '').slice(0, 8);
    const formatado = this.formatar(digitos);

    if (formatado === valorAntigo) {
      return;
    }

    const digitosAntesDoCaret = valorAntigo.slice(0, caretAntigo).replace(/\D/g, '').length;
    input.value = formatado;
    const novoCaret = this.posicaoAposNDigitos(formatado, digitosAntesDoCaret);
    input.setSelectionRange(novoCaret, novoCaret);
  }

  // dd -> dd/mm -> dd/mm/aaaa, adicionando a barra só quando já há um dígito do
  // próximo grupo (nunca deixa uma barra "sobrando" no fim: "15" e não "15/").
  private formatar(digitos: string): string {
    let resultado = digitos.slice(0, 2);
    if (digitos.length > 2) {
      resultado += '/' + digitos.slice(2, 4);
    }
    if (digitos.length > 4) {
      resultado += '/' + digitos.slice(4, 8);
    }
    return resultado;
  }

  // Onde colocar o caret para que fique logo depois do n-ésimo dígito do texto
  // formatado (pulando uma barra imediatamente à frente).
  private posicaoAposNDigitos(texto: string, n: number): number {
    if (n <= 0) {
      return 0;
    }
    let contados = 0;
    let i = 0;
    for (; i < texto.length && contados < n; i++) {
      if (/\d/.test(texto[i])) {
        contados++;
      }
    }
    if (texto[i] === '/') {
      i++;
    }
    return i;
  }
}
