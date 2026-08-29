import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';

import { NotaFiscal } from '../../../models/nota-fiscal.model';
import { NotaFiscalService } from '../../../services/nota-fiscal.service';

const ID_ELEMENTO_LEITOR = 'leitor-qr-nota-fiscal';

// O diálogo fecha devolvendo um desses três resultados: sucesso (com os dados já
// extraídos pela API), "manual" (usuário optou por preencher à mão depois de uma
// falha na leitura/consulta), ou undefined (usuário simplesmente cancelou/fechou -
// nesse caso a tela de Gastos não abre formulário nenhum).
export type EscanearNotaResultado =
  | { tipo: 'sucesso'; nota: NotaFiscal }
  | { tipo: 'manual' };

type EstadoLeitura = 'iniciando' | 'lendo' | 'consultando' | 'erroCamera' | 'erroConsulta';

@Component({
  selector: 'app-escanear-nota-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './escanear-nota-dialog.component.html',
  styleUrl: './escanear-nota-dialog.component.css'
})
export class EscanearNotaDialogComponent implements AfterViewInit, OnDestroy {

  private readonly dialogRef = inject(MatDialogRef<EscanearNotaDialogComponent, EscanearNotaResultado>);
  private readonly notaFiscalService = inject(NotaFiscalService);

  @ViewChild('areaLeitor') private areaLeitorRef?: ElementRef<HTMLDivElement>;

  readonly idElementoLeitor = ID_ELEMENTO_LEITOR;

  estado: EstadoLeitura = 'iniciando';
  mensagemErro = '';

  private scanner: Html5QrcodeType | null = null;
  // Vários frames de vídeo podem decodificar o mesmo QR Code antes da câmera
  // terminar de parar - sem essa trava, cada frame dispararia uma consulta nova à
  // API pro mesmo QR Code.
  private jaProcessouLeitura = false;

  ngAfterViewInit(): void {
    // Espera o próximo ciclo de detecção de mudanças pra garantir que a div do
    // leitor (só renderizada no estado "iniciando"/"lendo") já está no DOM.
    setTimeout(() => this.iniciarCamera(), 0);
  }

  ngOnDestroy(): void {
    this.pararCamera();
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  preencherManualmente(): void {
    this.dialogRef.close({ tipo: 'manual' });
  }

  tentarNovamente(): void {
    this.estado = 'iniciando';
    this.mensagemErro = '';
    this.jaProcessouLeitura = false;
    setTimeout(() => this.iniciarCamera(), 0);
  }

  private async iniciarCamera(): Promise<void> {
    if (!this.areaLeitorRef) {
      return;
    }
    try {
      // Import dinâmico: html5-qrcode é uma biblioteca grande (decodificador de QR
      // Code embutido) usada só nessa tela - carregá-la sob demanda em vez de no
      // bundle inicial evita pesar o carregamento do resto do app pra quem nunca
      // escaneia uma nota.
      const { Html5Qrcode } = await import('html5-qrcode');
      this.scanner = new Html5Qrcode(ID_ELEMENTO_LEITOR);
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (textoDecodificado) => this.onQrDecodificado(textoDecodificado),
        // Callback de erro "por frame" - disparado a cada frame em que nenhum QR
        // Code é encontrado, o que é o caso normal enquanto o usuário mira a
        // câmera. Nunca deve travar a leitura nem virar um erro visível.
        () => { /* nenhum QR Code neste frame - tenta o próximo */ }
      );
      this.estado = 'lendo';
    } catch {
      this.estado = 'erroCamera';
      this.mensagemErro =
        'Não foi possível acessar a câmera. Verifique se a permissão de câmera foi concedida para este site '
        + 'e se nenhum outro aplicativo está usando a câmera agora.';
    }
  }

  private onQrDecodificado(url: string): void {
    if (this.jaProcessouLeitura) {
      return;
    }
    this.jaProcessouLeitura = true;
    this.estado = 'consultando';
    this.pararCamera();

    this.notaFiscalService.consultar(url).subscribe({
      next: (nota) => this.dialogRef.close({ tipo: 'sucesso', nota }),
      error: (erro) => {
        this.estado = 'erroConsulta';
        this.mensagemErro = this.mensagemErroConsulta(erro);
      }
    });
  }

  private mensagemErroConsulta(erro: unknown): string {
    const erroHttp = erro as { error?: { erro?: string } };
    const detalhe = erroHttp?.error?.erro;
    const base = 'Não consegui ler os dados automaticamente, mas você pode preencher manualmente.';
    return detalhe ? `${base} (${detalhe})` : base;
  }

  private pararCamera(): void {
    if (!this.scanner) {
      return;
    }
    const scanner = this.scanner;
    this.scanner = null;
    // stop() rejeita se a câmera já não estiver rodando (ex: usuário fechou o
    // diálogo antes da câmera terminar de iniciar) - erro irrelevante pro usuário,
    // só garante que clear() sempre roda pra liberar o elemento de vídeo.
    scanner.stop().catch(() => { /* já parada ou nunca chegou a iniciar */ }).finally(() => scanner.clear());
  }
}
