import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ImportarRevisaoDialogComponent, ImportarRevisaoDialogData } from './importar-revisao-dialog.component';

describe('ImportarRevisaoDialogComponent', () => {
  let component: ImportarRevisaoDialogComponent;
  let fixture: ComponentFixture<ImportarRevisaoDialogComponent>;

  const dados: ImportarRevisaoDialogData = { linhas: [] };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportarRevisaoDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: dados }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ImportarRevisaoDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
