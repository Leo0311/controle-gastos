import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportarRevisaoDialogComponent } from './importar-revisao-dialog.component';

describe('ImportarRevisaoDialogComponent', () => {
  let component: ImportarRevisaoDialogComponent;
  let fixture: ComponentFixture<ImportarRevisaoDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportarRevisaoDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportarRevisaoDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
