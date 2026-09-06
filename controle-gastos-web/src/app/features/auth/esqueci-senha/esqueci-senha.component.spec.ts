import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EsqueciSenhaComponent } from './esqueci-senha.component';
import { provedoresDeTeste } from '../../../testing/test-providers';

describe('EsqueciSenhaComponent', () => {
  let component: EsqueciSenhaComponent;
  let fixture: ComponentFixture<EsqueciSenhaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EsqueciSenhaComponent],
      providers: [provedoresDeTeste()]
    }).compileComponents();

    fixture = TestBed.createComponent(EsqueciSenhaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
