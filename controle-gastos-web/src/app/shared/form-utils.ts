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
