import { AbstractControl } from '@angular/forms';

/**
 * Habilita ou desabilita um controle de ReactiveForms de forma idempotente e
 * sem emitir `valueChanges`/`statusChanges` (`emitEvent: false`), evitando
 * reentrância quando chamado de dentro de um `subscribe`.
 *
 * Usado no lugar do binding `[disabled]="..."` no template, que o Angular
 * desaconselha em campos com `formControlName` (gera o aviso "It looks like
 * you're using the disabled attribute with a reactive form directive").
 */
export function definirHabilitado(controle: AbstractControl, habilitado: boolean): void {
  if (habilitado && controle.disabled) {
    controle.enable({ emitEvent: false });
  } else if (!habilitado && controle.enabled) {
    controle.disable({ emitEvent: false });
  }
}

/**
 * Depois de um submit barrado por validação (após `form.markAllAsTouched()`),
 * leva o cursor até o **primeiro campo inválido na ordem da tela** - rola o
 * diálogo/página até ele e dá o foco - em vez de deixar o usuário procurar a
 * mensagem de erro. Genérico: varre o DOM (`querySelectorAll` já devolve em
 * ordem de documento, que é a ordem visual) em vez de checar campo a campo.
 *
 * `raiz` é o elemento que contém o formulário (normalmente
 * `inject(ElementRef).nativeElement` do componente do diálogo).
 */
export function focarPrimeiroCampoInvalido(raiz: HTMLElement): void {
  // setTimeout: espera o Angular aplicar as classes ng-invalid/ng-touched e
  // renderizar os <mat-error> (que mudam a altura e, com ela, a rolagem) antes
  // de medir a posição do campo.
  setTimeout(() => {
    const seletor = 'input.ng-invalid, textarea.ng-invalid, select.ng-invalid, '
      + 'mat-select.ng-invalid, [formcontrolname].ng-invalid';
    const alvo = Array.from(raiz.querySelectorAll<HTMLElement>(seletor)).find((el) =>
      !el.hasAttribute('disabled') && el.offsetParent !== null && typeof el.focus === 'function');
    if (!alvo) {
      return;
    }
    alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    alvo.focus({ preventScroll: true });
  });
}
