import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'controle_gastos_tema';
const CLASSE_ESCURO = 'tema-escuro';

@Injectable({
  providedIn: 'root'
})
export class TemaService {

  // O valor inicial é lido diretamente da classe já aplicada em <html> pelo
  // script inline no <head> do index.html (evita "flash" do tema errado: o
  // script roda antes do Angular bootstrar, então quando este serviço é
  // criado a classe certa já está no DOM - só refletimos o estado aqui).
  private readonly escuroSubject = new BehaviorSubject<boolean>(
    document.documentElement.classList.contains(CLASSE_ESCURO)
  );

  readonly escuro$ = this.escuroSubject.asObservable();

  get escuro(): boolean {
    return this.escuroSubject.value;
  }

  alternar(): void {
    this.definir(!this.escuro);
  }

  private definir(escuro: boolean): void {
    document.documentElement.classList.toggle(CLASSE_ESCURO, escuro);
    localStorage.setItem(STORAGE_KEY, escuro ? 'escuro' : 'claro');
    this.escuroSubject.next(escuro);
  }
}
