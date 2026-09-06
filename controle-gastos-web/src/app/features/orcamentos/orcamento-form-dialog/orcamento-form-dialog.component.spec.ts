import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { OrcamentoFormDialogComponent, OrcamentoFormDialogData } from './orcamento-form-dialog.component';
import { provedoresDeTeste } from '../../../testing/test-providers';

describe('OrcamentoFormDialogComponent', () => {
  let component: OrcamentoFormDialogComponent;
  let fixture: ComponentFixture<OrcamentoFormDialogComponent>;

  const dados: OrcamentoFormDialogData = { mes: 9, ano: 2026, orcamento: null };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrcamentoFormDialogComponent],
      providers: [
        provedoresDeTeste(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: dados }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OrcamentoFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
