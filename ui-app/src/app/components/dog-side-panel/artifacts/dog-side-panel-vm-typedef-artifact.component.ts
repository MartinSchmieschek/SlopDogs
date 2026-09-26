import { Component, Input } from '@angular/core';
import { EditSectionComponent } from '../../edit-section/edit-section.component';

@Component({
  selector: 'app-dog-side-panel-vm-typedef-artifact',
  standalone: true,
  imports: [EditSectionComponent],
  template: `
    <app-edit-section title="Context (types)" [collapsed]="collapsed" [hideHeader]="hideHeader">
      @if (typeDef?.trim()) {
        <pre class="typedef-pre">{{ typeDef }}</pre>
      } @else {
        <div class="typedef-empty">No context.</div>
      }
    </app-edit-section>
  `,
  styleUrls: ['./dog-side-panel-vm-typedef-artifact.component.scss'],
})
export class DogSidePanelVmTypedefArtifactComponent {
  @Input() typeDef: string | undefined;
  @Input() collapsed = true;
  @Input() hideHeader = false;
}
