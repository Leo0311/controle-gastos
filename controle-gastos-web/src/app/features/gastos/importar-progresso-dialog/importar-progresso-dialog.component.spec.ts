import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportarProgressoDialogComponent } from './importar-progresso-dialog.component';

describe('ImportarProgressoDialogComponent', () => {
  let component: ImportarProgressoDialogComponent;
  let fixture: ComponentFixture<ImportarProgressoDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportarProgressoDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportarProgressoDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
