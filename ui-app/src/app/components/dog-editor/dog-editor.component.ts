import {
  Component, Input, inject, signal,
  ElementRef, ViewChild, OnChanges, OnDestroy, SimpleChanges
} from '@angular/core';
import { DogEntry } from '../../models/dog-entry.model';
import { MonacoLoaderService } from '../../services/monaco-loader.service';
import { SdVeilComponent } from '../sd-veil/sd-veil.component';
import { INLAY_EDITOR_OPTIONS } from '../../monaco/inlay-theme';

@Component({
  selector: 'app-dog-editor',
  standalone: true,
  imports: [SdVeilComponent],
  template: `
    <div
      class="editor-wrapper dog-node-card"
      [class.dog-node-card--serialized]="!!dog.codeTs">
      <div #editorContainer class="editor-container"></div>
      @if (monacoLoading()) {
        <sd-veil label="Loading the editor" />
      }
    </div>
  `,
  styleUrls: ['../../styles/dog-node-card.scss', './dog-editor.component.scss'],
})
export class DogEditorComponent implements OnChanges, OnDestroy {
  @ViewChild('editorContainer', { static: true }) containerRef!: ElementRef;

  @Input() dog!: DogEntry;
  /** The browser preview (P6 U5) shows code, it never edits it. */
  @Input() readOnly = false;

  readonly monacoLoading = signal(false);

  private readonly monacoLoader = inject(MonacoLoaderService);
  private editor: any = null;
  private extraLib: any = null;
  private destroyed = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['dog'] && this.dog) {
      void this.initOrUpdateEditor();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.editor?.dispose();
    this.extraLib?.dispose();
  }

  getCurrentCode(): string | null {
    if (!this.editor) return null;
    return this.unwrapCode(this.editor.getValue());
  }

  private wrapCode(rawCode: string): string {
    const unwrapped = this.unwrapCode(rawCode);
    const ret = this.dog.vmExpectedReturnTypeName ?? 'any';
    return `async function run(): Promise<${ret}> {\n${unwrapped}\n}`;
  }

  private readonly RUN_SIGNATURE = /^async function run\(\)(?:\s*:\s*Promise<[^>]*>)?\s*\{/;

  private unwrapCode(code: string): string {
    let trimmed = code.trim();
    while (this.RUN_SIGNATURE.test(trimmed)) {
      let depth = 0;
      const startPos = trimmed.indexOf('{');
      if (startPos === -1) break;
      for (let i = startPos; i < trimmed.length; i++) {
        if (trimmed[i] === '{') depth++;
        if (trimmed[i] === '}') depth--;
        if (depth === 0) {
          if (i === trimmed.length - 1) {
            trimmed = trimmed.substring(startPos + 1, i).trim();
          } else {
            break;
          }
          break;
        }
      }
      if (depth !== 0) break;
    }
    return trimmed;
  }

  private async initOrUpdateEditor(): Promise<void> {
    if (!this.dog.codeTs) {
      this.editor?.dispose();
      this.editor = null;
      this.extraLib?.dispose();
      this.extraLib = null;
      return;
    }

    const monaco = await this.loadMonaco();
    if (!monaco || this.destroyed || !this.dog.codeTs) return;

    const container = this.containerRef.nativeElement as HTMLElement;

    const content = this.wrapCode(this.dog.codeTs);

    this.extraLib?.dispose();
    this.extraLib = null;
    if (this.dog.vmContextTypeDef) {
      this.extraLib = monaco.languages.typescript.typescriptDefaults.addExtraLib(
        this.dog.vmContextTypeDef,
        `ts:context/${this.dog.id}.d.ts`
      );
    }

    if (this.editor) {
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, 'typescript');
        model.setValue(content);
      }
    } else {
      this.editor = monaco.editor.create(container, {
        value: content,
        language: 'typescript',
        ...INLAY_EDITOR_OPTIONS,
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: this.readOnly,
      });
    }

    this.editor.updateOptions({ readOnly: this.readOnly });
  }

  private async loadMonaco(): Promise<any> {
    this.monacoLoading.set(true);
    try {
      return await this.monacoLoader.ensureMonaco();
    } catch {
      return null;
    } finally {
      this.monacoLoading.set(false);
    }
  }
}
