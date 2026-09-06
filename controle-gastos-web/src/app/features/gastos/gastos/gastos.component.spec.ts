import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GastosComponent } from './gastos.component';
import { provedoresDeTeste } from '../../../testing/test-providers';

describe('GastosComponent', () => {
  let component: GastosComponent;
  let fixture: ComponentFixture<GastosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GastosComponent],
      providers: [provedoresDeTeste()]
    }).compileComponents();

    fixture = TestBed.createComponent(GastosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
