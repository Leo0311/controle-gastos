import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrcamentosComponent } from './orcamentos.component';
import { provedoresDeTeste } from '../../../testing/test-providers';

describe('OrcamentosComponent', () => {
  let component: OrcamentosComponent;
  let fixture: ComponentFixture<OrcamentosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrcamentosComponent],
      providers: [provedoresDeTeste()]
    }).compileComponents();

    fixture = TestBed.createComponent(OrcamentosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
