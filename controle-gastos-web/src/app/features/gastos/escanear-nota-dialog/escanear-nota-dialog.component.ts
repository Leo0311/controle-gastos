import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';

import { NotaFiscal } from '../../../models/nota-fiscal.model';
import { NotaFiscalService } from '../../../services/nota-fiscal.service';

const ID_ELEMENTO_LEITOR = 'leitor-qr-nota-fiscal';
// Container separado (sempre presente no DOM, nunca removido por um @if) usado só
// pelo modo "Enviar foto" - a leitura de arquivo (scanFile) usa a mesma classe
// Html5Qrcode da câmera, que exige um elemento com o ID informado já existindo no
// DOM no momento da construção, mesmo com showImage desligado (sem preview visual).
const ID_ELEMENTO_ARQUIVO = 'leitor-qr-nota-fiscal-arquivo';

// O diálogo fecha devolvendo um desses três resultados, ou undefined (usuário
// simplesmente cancelou/fechou - nesse caso a tela de Gastos não abre nada):
// - "sucesso": a extração automática funcionou (tentada em segundo plano, sem
//   nenhuma indicação visual diferente pro usuário - ver onQrDecodificado) - os
//   dados já vêm prontos pra pré-preencher o formulário.
// - "abrirNota": QR Code lido com sucesso, mas a extração automática falhou (o mais
//   comum na prática, já que a SEFAZ-SC costuma exigir uma validação de segurança
//   antes de mostrar os dados da nota, que não dá pra resolver automaticamente) -
//   a tela de Gastos mostra um botão pra abrir a URL da nota, junto com o
//   formulário em branco.
// - "manual": falha na leitura em si (câmera ou arquivo, sem URL nenhuma pra abrir)
//   - só abre o formulário em branco.
export type EscanearNotaResultado =
  | { tipo: 'sucesso'; nota: NotaFiscal }
  | { tipo: 'abrirNota'; url: string }
  | { tipo: 'manual' };

type EstadoLeitura = 'iniciando' | 'lendo' | 'aguardandoArquivo' | 'consultando' | 'erro';
type ModoEntrada = 'camera' | 'arquivo';

@Component({
  selector: 'app-escanear-nota-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './escanear-nota-dialog.component.html',
  styleUrl: './escanear-nota-dialog.component.css'
})
export class EscanearNotaDialogComponent implements AfterViewInit, OnDestroy {

  private readonly dialogRef = inject(MatDialogRef<EscanearNotaDialogComponent, EscanearNotaResultado>);
  private readonly notaFiscalService = inject(NotaFiscalService);

  @ViewChild('areaLeitor') private areaLeitorRef?: ElementRef<HTMLDivElement>;
  @ViewChild('inputImagem') private inputImagemRef?: ElementRef<HTMLInputElement>;

  readonly idElementoLeitor = ID_ELEMENTO_LEITOR;
  readonly idElementoArquivo = ID_ELEMENTO_ARQUIVO;

  modoEntrada: ModoEntrada = 'camera';
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

  // Alterna entre "Usar câmera" e "Enviar foto" - troca de modo sempre para a
  // câmera (se estava rodando) e reseta o estado de erro, já que os dois modos são
  // tentativas de leitura independentes.
  alternarModo(evento: MatButtonToggleChange): void {
    const modo = evento.value as ModoEntrada;
    if (modo === this.modoEntrada) {
      return;
    }
    this.pararCamera();
    this.modoEntrada = modo;
    this.mensagemErro = '';
    this.jaProcessouLeitura = false;

    if (modo === 'camera') {
      this.estado = 'iniciando';
      setTimeout(() => this.iniciarCamera(), 0);
    } else {
      this.estado = 'aguardandoArquivo';
    }
  }

  tentarNovamente(): void {
    this.mensagemErro = '';
    this.jaProcessouLeitura = false;
    if (this.modoEntrada === 'camera') {
      this.estado = 'iniciando';
      setTimeout(() => this.iniciarCamera(), 0);
    } else {
      this.estado = 'aguardandoArquivo';
    }
  }

  abrirSeletorDeArquivo(): void {
    this.inputImagemRef?.nativeElement.click();
  }

  // Lê o QR Code de uma imagem enviada pelo usuário (scanFile do html5-qrcode) - útil
  // quando não dá pra usar a câmera direto pro papel (ex: webcam de desktop mal
  // posicionada): o usuário fotografa a nota pelo celular e envia essa foto aqui.
  async onArquivoSelecionado(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0] ?? null;
    input.value = '';
    if (!arquivo || this.jaProcessouLeitura) {
      return;
    }

    this.estado = 'consultando';
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode(ID_ELEMENTO_ARQUIVO);
    try {
      // showImage=false: não precisamos do preview da imagem com a marcação do QR
      // Code, só do texto decodificado.
      const textoDecodificado = await scanner.scanFile(arquivo, false);
      this.onQrDecodificado(textoDecodificado);
    } catch {
      this.estado = 'erro';
      this.mensagemErro =
        'Não conseguimos identificar um QR Code nessa imagem. Tente outra foto, com o QR Code inteiro e nítido '
        + 'no enquadramento.';
    } finally {
      scanner.clear();
    }
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
      this.estado = 'erro';
      this.mensagemErro =
        'Não foi possível acessar a câmera. Verifique se a permissão de câmera foi concedida para este site '
        + 'e se nenhum outro aplicativo está usando a câmera agora - ou envie uma foto pela outra opção acima.';
    }
  }

  // Tenta a extração automática como um fallback silencioso: se a SEFAZ-SC
  // devolver os dados de primeira (não é raro - só não é garantido, por causa da
  // validação de segurança que a página pública às vezes exige), o formulário já
  // fecha pré-preenchido; se falhar por qualquer motivo, fecha pedindo pra tela de
  // Gastos mostrar o botão de abrir a nota - ver GastosComponent.abrirNotaFiscalEFormulario.
  private onQrDecodificado(url: string): void {
    if (this.jaProcessouLeitura) {
      return;
    }
    this.jaProcessouLeitura = true;
    this.estado = 'consultando';
    this.pararCamera();

    this.notaFiscalService.consultar(url).subscribe({
      next: (nota) => this.dialogRef.close({ tipo: 'sucesso', nota }),
      error: () => this.dialogRef.close({ tipo: 'abrirNota', url })
    });
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
