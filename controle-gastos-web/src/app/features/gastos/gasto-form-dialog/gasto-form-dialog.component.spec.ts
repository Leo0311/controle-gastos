import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GastoFormDialogComponent } from './gasto-form-dialog.component';

describe('GastoFormDialogComponent', () => {
  let component: GastoFormDialogComponent;
  let fixture: ComponentFixture<GastoFormDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GastoFormDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GastoFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
