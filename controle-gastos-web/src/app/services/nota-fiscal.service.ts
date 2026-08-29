import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { NotaFiscal } from '../models/nota-fiscal.model';

@Injectable({
  providedIn: 'root'
})
export class NotaFiscalService {

  private readonly baseUrl = `${API_BASE_URL}/notas-fiscais`;

  constructor(private readonly http: HttpClient) { }

  // Recebe a URL já decodificada do QR Code (lida pela câmera no navegador) e pede
  // pra API buscar e extrair os dados da nota - a API valida que a URL é mesmo da
  // SEFAZ-SC antes de acessá-la (ver NotaFiscalService no backend).
  consultar(url: string): Observable<NotaFiscal> {
    return this.http.post<NotaFiscal>(`${this.baseUrl}/consultar`, { url });
  }
}
