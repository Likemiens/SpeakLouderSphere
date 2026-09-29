const MESSAGES = {
  ru: {
    start: 'Включить микрофон',
    stop: 'Выключить микрофон',
    denied: 'Нет доступа к микрофону',
    noMic: 'Микрофон не найден',
    insecure: 'Микрофон работает только по HTTPS',
    noSpeech: 'Субтитры в этом браузере недоступны — попробуйте Chrome, Edge или Safari',
    network: 'Нет связи с сервисом распознавания речи',
    langUnsupported: 'Этот язык распознавания не поддерживается',
  },
  en: {
    start: 'Turn the microphone on',
    stop: 'Turn the microphone off',
    denied: 'Microphone access is blocked',
    noMic: 'No microphone found',
    insecure: 'The microphone only works over HTTPS',
    noSpeech: 'Live captions are not available in this browser — try Chrome, Edge or Safari',
    network: 'Speech recognition service is unreachable',
    langUnsupported: 'This recognition language is not supported',
  },
};

export type MessageKey = keyof (typeof MESSAGES)['ru'];

export function message(lang: string, key: MessageKey): string {
  return (lang.toLowerCase().startsWith('ru') ? MESSAGES.ru : MESSAGES.en)[key];
}
