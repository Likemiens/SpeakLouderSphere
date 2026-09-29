/**
 * Renders a caption word by word. Words that did not change keep their DOM
 * nodes, new or corrected words fade in, and when the text grows beyond
 * `maxLines` the oldest words are dropped from the front.
 */
export declare class CaptionView {
    private readonly box;
    private readonly line;
    maxLines: number;
    private words;
    private first;
    private kind;
    constructor(box: HTMLElement, line: HTMLElement);
    get text(): string;
    /** Show a transcript: `finalText` is settled, `interimText` may still change. */
    setTranscript(finalText: string, interimText: string): void;
    /** Show a static message (greeting, hint, error). */
    setMessage(text: string, kind?: 'text' | 'hint' | 'error'): void;
    clear(): void;
    private setKind;
    private reset;
    private render;
    private createWord;
    private removeWord;
    /** Drop words from the front until the text fits into maxLines. */
    private fit;
}
