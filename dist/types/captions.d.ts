/**
 * Renders a caption word by word. Words that did not change keep their DOM
 * nodes, new or corrected words fade in, and when a transcript grows beyond
 * `maxLines` the oldest words are dropped from the front. Static messages
 * (greeting, hints, errors) are always shown in full.
 */
export declare class CaptionView {
    private readonly box;
    private readonly line;
    maxLines: number;
    private words;
    private all;
    private first;
    private fitting;
    private kind;
    constructor(box: HTMLElement, line: HTMLElement);
    /** The visible text. */
    get text(): string;
    /** Show a transcript: `finalText` is settled, `interimText` may still change. */
    setTranscript(finalText: string, interimText: string): void;
    /** Show a static message (greeting, hint, error). */
    setMessage(text: string, kind?: 'text' | 'hint' | 'error'): void;
    clear(): void;
    /** Call when the available width changed: shows more (or fewer) words, without replaying animations. */
    refit(): void;
    private setKind;
    private reset;
    private render;
    private createWord;
    private removeWord;
    /** Drop words from the front until the text fits into maxLines. */
    private fit;
}
