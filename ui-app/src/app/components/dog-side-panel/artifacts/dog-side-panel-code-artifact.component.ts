import { Component, Input, ViewChild } from '@angular/core';
import { DogEntry } from '../../../models/dog-entry.model';
import { DogEditorComponent } from '../../dog-editor/dog-editor.component';
import { EditSectionComponent } from '../../edit-section/edit-section.component';

@Component({
  selector: 'app-dog-side-panel-code-artifact',
  standalone: true,
  imports: [EditSectionComponent, DogEditorComponent],
  template: `
    @if (dog?.codeTs) {
      <app-edit-section title="Code" [hideHeader]="hideHeader">
        <app-dog-editor [dog]="dog!" />
      </app-edit-section>
    }
  `,
})
export class DogSidePanelCodeArtifactComponent {
  @Input() dog: DogEntry | null = null;
  @Input() hideHeader = false;

  @ViewChild(DogEditorComponent) private dogEditor?: DogEditorComponent;

  getCurrentCode(): string | null {
    return this.dogEditor?.getCurrentCode() ?? null;
  }
}
