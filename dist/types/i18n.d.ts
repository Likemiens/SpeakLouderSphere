declare const MESSAGES: {
    ru: {
        start: string;
        stop: string;
        denied: string;
        noMic: string;
        insecure: string;
        noSpeech: string;
        network: string;
        langUnsupported: string;
    };
    en: {
        start: string;
        stop: string;
        denied: string;
        noMic: string;
        insecure: string;
        noSpeech: string;
        network: string;
        langUnsupported: string;
    };
};
export type MessageKey = keyof (typeof MESSAGES)['ru'];
export declare function message(lang: string, key: MessageKey): string;
export {};
