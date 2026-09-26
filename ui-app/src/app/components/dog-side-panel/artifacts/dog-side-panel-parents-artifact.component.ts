import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DogEntry } from '../../../models/dog-entry.model';
import { EditSectionComponent } from '../../edit-section/edit-section.component';

@Component({
  selector: 'app-dog-side-panel-parents-artifact',
  standalone: true,
  imports: [EditSectionComponent],
  template: `
    <app-edit-section title="Parents" [hideHeader]="hideHeader">
      <div class="parents-list">
        @for (parent of availableParents; track parent.id) {
          <div class="parent-item">
            <span class="parent-name">{{ parent.name }}</span>
            <label class="parent-checkbox">
              <input type="checkbox"
                [checked]="requiredIds.includes(parent.id)"
                (click)="toggleRequired.emit(parent.id)">
              required
            </label>
            <label class="parent-checkbox">
              <input type="checkbox"
                [checked]="optionalIds.includes(parent.id)"
                (click)="toggleOptional.emit(parent.id)">
              optional
            </label>
          </div>
        }
      </div>
    </app-edit-section>
  `,
  styleUrls: ['./dog-side-panel-parents-artifact.component.scss'],
})
export class DogSidePanelParentsArtifactComponent {
  @Input({ required: true }) availableParents: DogEntry[] = [];
  @Input({ required: true }) requiredIds: string[] = [];
  @Input({ required: true }) optionalIds: string[] = [];
  @Input() hideHeader = false;

  @Output() toggleRequired = new EventEmitter<string>();
  @Output() toggleOptional = new EventEmitter<string>();
}
