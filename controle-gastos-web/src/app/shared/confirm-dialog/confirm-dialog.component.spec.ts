import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError, Subject } from 'rxjs';

import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';
import { NotificacaoService } from '../../core/notificacao.service';

describe('ConfirmDialogComponent', () => {
  let dialogRef: jasmine.SpyObj<MatDialogRef<ConfirmDialogComponent>>;
  let notificacao: jasmine.SpyObj<NotificacaoService>;

  function criar(data: ConfirmDialogData): ConfirmDialogComponent {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    notificacao = jasmine.createSpyObj('NotificacaoService', ['erro', 'mensagemDeErro']);
    notificacao.mensagemDeErro.and.returnValue('deu ruim');

    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: NotificacaoService, useValue: notificacao }
      ]
    });
    return TestBed.createComponent(ConfirmDialogComponent).componentInstance;
  }

  it('sem `acao`: confirmar fecha com true, cancelar com false', () => {
    const c = criar({ titulo: 't', mensagem: 'm' });

    c.confirmar();
    expect(dialogRef.close).toHaveBeenCalledWith(true);

    c.cancelar();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('com `acao`: mostra processando, trava disableClose e fecha com true no sucesso', () => {
    const c = criar({ titulo: 't', mensagem: 'm', acao: () => of(undefined) });

    c.confirmar();

    expect((dialogRef as unknown as { disableClose: boolean }).disableClose).toBeTrue();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('com `acao`: enquanto roda, processando=true e os botões não reagem', () => {
    const emAndamento = new Subject<void>();
    const c = criar({ titulo: 't', mensagem: 'm', acao: () => emAndamento });

    c.confirmar();
    expect(c.processando).toBeTrue();

    // segundo clique no meio da ação não faz nada
    c.confirmar();
    c.cancelar();
    expect(dialogRef.close).not.toHaveBeenCalled();

    emAndamento.next();
    emAndamento.complete();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('com `acao`: no erro destrava (processando=false), mostra a mensagem e NÃO fecha', () => {
    const c = criar({ titulo: 't', mensagem: 'm', acao: () => throwError(() => new Error('x')) });

    c.confirmar();

    expect(c.processando).toBeFalse();
    expect((dialogRef as unknown as { disableClose: boolean }).disableClose).toBeFalse();
    expect(notificacao.erro).toHaveBeenCalledWith('deu ruim');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
