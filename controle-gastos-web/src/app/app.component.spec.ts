import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';

import { AppComponent } from './app.component';
import { AtualizacaoService } from './services/atualizacao.service';
import { provedoresDeTeste } from './testing/test-providers';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provedoresDeTeste(),
        // Stub: o real injeta SwUpdate, que não existe sem provideServiceWorker.
        { provide: AtualizacaoService, useValue: { novaVersaoDisponivel$: EMPTY } }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
