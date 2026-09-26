import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-edit-section',
  standalone: true,
  template: `
    <div
      class="edit-section dog-node-card"
      [class.edit-section--no-header]="hideHeader">
      @if (!hideHeader) {
        <div class="section-header" (click)="collapsed = !collapsed">
          <span class="toggle">{{ collapsed ? '▸' : '▾' }}</span>
          <span class="section-title">{{ title }}</span>
        </div>
      }
      <div class="section-body" [class.hidden]="!hideHeader && collapsed">
        <ng-content />
      </div>
    </div>
  `,
  styleUrls: ['../../styles/dog-node-card.scss', './edit-section.component.scss'],
})
export class EditSectionComponent {
  @Input() title = '';
  @Input() collapsed = false;
  /** Nur Inhalt (Dog-Karten-Rahmen), ohne Titelzeile — für Single-Section-Panel. */
  @Input() hideHeader = false;
}
