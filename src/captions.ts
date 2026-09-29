interface Word {
  text: string;
  interim: boolean;
  el: HTMLSpanElement;
  inner: HTMLSpanElement;
  space: Text | null;
}

/**
 * Renders a caption word by word. Words that did not change keep their DOM
 * nodes, new or corrected words fade in, and when the text grows beyond
 * `maxLines` the oldest words are dropped from the front.
 */
export class CaptionView {
  maxLines = 2;

  private words: Word[] = [];
  private first = 0; // index of the first visible word
  private kind = '';

  constructor(private readonly box: HTMLElement, private readonly line: HTMLElement) {}

  get text(): string {
    return this.words.filter(Boolean).map((w) => w.text).join(' ');
  }

  /** Show a transcript: `finalText` is settled, `interimText` may still change. */
  setTranscript(finalText: string, interimText: string): void {
    this.setKind('transcript');
    const fin = split(finalText);
    const tmp = split(interimText);
    const all = [...fin.map((t) => ({ t, interim: false })), ...tmp.map((t) => ({ t, interim: true }))];
    if (all.length) all[0].t = capitalize(all[0].t);
    this.render(all);
  }

  /** Show a static message (greeting, hint, error). */
  setMessage(text: string, kind: 'text' | 'hint' | 'error' = 'text'): void {
    const sameText = this.kind === kind && this.text === text.trim().replace(/\s+/g, ' ');
    this.setKind(kind);
    if (sameText) return;
    this.reset();
    this.render(split(text).map((t) => ({ t, interim: false })));
  }

  clear(): void {
    this.setKind('');
    this.reset();
  }

  private setKind(kind: string): void {
    if (this.kind === kind) return;
    this.kind = kind;
    this.box.dataset.kind = kind;
  }

  private reset(): void {
    this.line.textContent = '';
    this.words = [];
    this.first = 0;
    this.line.classList.remove('truncated');
  }

  private render(next: Array<{ t: string; interim: boolean }>): void {
    const words = this.words;
    // Text got shorter than what we have scrolled away (e.g. a new phrase) -> start over.
    if (next.length <= this.first) this.reset();

    for (let i = this.first; i < next.length; i++) {
      const want = next[i];
      const have = words[i];
      if (have && have.text === want.t) {
        if (have.interim !== want.interim) {
          have.interim = want.interim;
          have.el.classList.toggle('interim', want.interim);
        }
        continue;
      }
      if (have) {
        // Corrected word: swap text and replay the entrance.
        have.text = want.t;
        have.interim = want.interim;
        have.inner.textContent = want.t;
        have.el.classList.toggle('interim', want.interim);
        replay(have.el);
        continue;
      }
      words[i] = this.createWord(want.t, want.interim, i > this.first);
    }
    for (let i = words.length - 1; i >= next.length; i--) this.removeWord(i);
    words.length = Math.max(this.first, next.length);
    this.fit();
  }

  private createWord(text: string, interim: boolean, withSpace: boolean): Word {
    const space = withSpace ? document.createTextNode(' ') : null;
    const el = document.createElement('span');
    el.className = interim ? 'w enter interim' : 'w enter';
    const inner = document.createElement('span');
    inner.className = 'wi';
    inner.textContent = text;
    el.appendChild(inner);
    el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
    if (space) this.line.appendChild(space);
    this.line.appendChild(el);
    return { text, interim, el, inner, space };
  }

  private removeWord(i: number): void {
    const w = this.words[i];
    if (!w) return;
    w.space?.remove();
    w.el.remove();
    delete this.words[i];
  }

  /** Drop words from the front until the text fits into maxLines. */
  private fit(): void {
    const lh = parseFloat(getComputedStyle(this.line).lineHeight) || 0;
    if (!lh) return;
    const limit = lh * this.maxLines + 2;
    while (this.first < this.words.length - 1 && this.line.getBoundingClientRect().height > limit) {
      this.removeWord(this.first);
      this.first++;
      const head = this.words[this.first];
      head?.space?.remove();
      if (head) head.space = null;
      this.line.classList.add('truncated');
    }
  }
}

function split(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase() + word.slice(1);
}

function replay(el: HTMLElement): void {
  el.classList.remove('enter');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('enter');
  el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
}
