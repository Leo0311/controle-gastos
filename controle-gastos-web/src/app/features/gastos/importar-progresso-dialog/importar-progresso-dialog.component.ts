import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-importar-progresso-dialog',
  standalone: true,
  imports: [MatDialogModule, MatProgressBarModule],
  templateUrl: './importar-progresso-dialog.component.html',
  styleUrl: './importar-progresso-dialog.component.css'
})
export class ImportarProgressoDialogComponent {
  total = 0;
  atual = 0;

  get percentual(): number {
    return this.total === 0 ? 0 : Math.round((this.atual / this.total) * 100);
  }
}
