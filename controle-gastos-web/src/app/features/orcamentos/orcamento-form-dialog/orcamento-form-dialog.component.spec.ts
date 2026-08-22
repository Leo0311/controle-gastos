import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrcamentoFormDialogComponent } from './orcamento-form-dialog.component';

describe('OrcamentoFormDialogComponent', () => {
  let component: OrcamentoFormDialogComponent;
  let fixture: ComponentFixture<OrcamentoFormDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrcamentoFormDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrcamentoFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
