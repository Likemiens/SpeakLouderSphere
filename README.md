# SpeakLouderSphere

Светящаяся стеклянная сфера, которая **реагирует на голос** и показывает **живые субтитры** того, что вы говорите.
Готовый веб-компонент `<speak-louder-sphere>`: вставляется на любой сайт одним тегом, без зависимостей.

- **Сфера на WebGL.** Тёмное стекло, внутри медленно изгибается светящаяся мембрана: голубая снизу, синяя с фиолетовым переливом сверху.
- **Реакция на голос в реальном времени.** Громкость и частоты с микрофона (Web Audio API). Сфера разгорается, мембрана ускоряется и волнуется, вокруг появляется мягкое свечение, размер слегка «дышит» в такт слогам.
- **Живые субтитры** (Web Speech API). Слова появляются по мере речи и уточняются на лету. После паузы фраза плавно гаснет, длинные фразы не вылезают за 2 строки.
- **Свои цвета.** 7 пресетов и 5 цветовых ролей, принимаются любые CSS-цвета.
- **Встраивание.** Один файл (~13 КБ в gzip). Shadow DOM: стили сайта не ломают виджет, и наоборот.
- **JS API и события.** Можно подключить голос ассистента (TTS, WebRTC), свой сервис распознавания речи или управлять сферой вручную.
- **Бережно к устройству.** Вне экрана и в фоновой вкладке анимация на паузе, частота не выше 60 fps, на слабых устройствах качество снижается автоматически. Учитывается `prefers-reduced-motion`.

## Быстрый старт

```bash
npm install
npm run dev
```

Откройте <http://localhost:5173>. Там демо в стиле референса и панель «Настроить» с пресетами, цветами, размером, чувствительностью, языком, имитацией речи и готовым кодом для вставки.

Ещё примеры (после `npm run build`):

- <http://localhost:5173/examples/embed.html>: встраивание одним тегом;
- <http://localhost:5173/examples/api.html>: JS API, события, «ответ ассистента», внешний сервис распознавания.

## Встраивание на сайт

1. Возьмите готовый файл `dist/speak-louder-sphere.iife.js` (или пересоберите: `npm run build`) и положите его на свой сайт.
2. Добавьте на страницу:

```html
<script src="/assets/speak-louder-sphere.iife.js"></script>

<speak-louder-sphere
  lang="ru-RU"
  text="Привет! Я NOVA, проводник в Миссию 2027"
  listening-text="Слушаю…"
></speak-louder-sphere>
```

Так же это работает в Tilda, WordPress, Webflow и других конструкторах: вставьте код в HTML-блок.

Вариант с ES-модулем (для сборщиков):

```js
import 'speak-louder-sphere';            // регистрирует <speak-louder-sphere>
// или
import { createSphere } from 'speak-louder-sphere';
const sphere = createSphere('#assistant', { preset: 'aurora', size: 280, lang: 'ru-RU' });
```

> **Важно.** Браузеры дают доступ к микрофону только на **HTTPS** (или `localhost`).
> Если виджет стоит внутри `<iframe>`, добавьте ему `allow="microphone"`.

Если сделать репозиторий публичным, файл можно подключать прямо с CDN:
`https://cdn.jsdelivr.net/gh/Likemiens/SpeakLouderSphere@main/dist/speak-louder-sphere.iife.js`

## Атрибуты

| Атрибут | По умолчанию | Что делает |
|---|---|---|
| `preset` | `nova` | Палитра: `nova`, `aurora`, `amethyst`, `sunset`, `ember`, `ocean`, `mono` |
| `color-deep`, `color-body`, `color-glow`, `color-accent`, `color-rim` | из пресета | Переопределяют отдельные цвета (любой CSS-цвет) |
| `size` | `320` | Диаметр сферы: число в px или любая CSS-длина |
| `lang` | язык страницы | Язык распознавания: `ru-RU`, `en-US`, `uk-UA`… |
| `text` | — | Текст под сферой, пока микрофон выключен |
| `listening-text` | — | Текст, пока микрофон включён и ещё ничего не сказано |
| `captions` | включены | `captions="false"` выключает субтитры (сфера продолжает реагировать) |
| `caption-lines` | `2` | Сколько строк субтитров показывать |
| `caption-hold` | `2600` | Сколько миллисекунд держать фразу после паузы |
| `sensitivity` | `1` | Чувствительность к громкости (0.1–5) |
| `speed` | `1` | Скорость анимации (0 = стоп-кадр) |
| `quality` | `auto` | `low`, `medium`, `high`: плотность пикселей холста |
| `interactive` | `true` | `interactive="false"`: клик не включает микрофон (управление только из кода) |
| `simulate` | — | Имитация речи, пока микрофон выключен (для витрин и превью) |
| `show-errors` | — | Показывать ошибки (нет доступа к микрофону, нет связи с распознаванием) текстом под сферой. Без атрибута они уходят только в консоль и событие `sls-error` |

Пока идёт запись, у элемента есть атрибут `listening`. По нему можно стилизовать окружение: `speak-louder-sphere[listening] { … }`.

## Цвета

| Роль | Где видна | `nova` |
|---|---|---|
| `deep` | тёмное тело стекла (оставляйте тёмным) | `#07154a` |
| `body` | верхняя сторона мембраны, глубина свечения | `#2f6bff` |
| `glow` | яркая нижняя сторона и линия сгиба | `#3fe6ff` |
| `accent` | перелив на верхней стороне справа | `#9747ff` |
| `rim` | край стекла | `#5f9dff` |

```html
<speak-louder-sphere preset="sunset" color-glow="#ffd166"></speak-louder-sphere>
```

```js
sphere.setColors({ glow: '#00ffa3', accent: '#00b3ff' }); // на лету
sphere.setColors(null);                                   // вернуть пресет и атрибуты
```

## Оформление субтитров (CSS)

Субтитры наследуют шрифт и цвет страницы. Подстроить можно через переменные:

```css
speak-louder-sphere {
  --sls-size: 360px;                 /* диаметр сферы */
  --sls-gap: 48px;                   /* расстояние от сферы до текста */
  --sls-font-family: "Inter", sans-serif;
  --sls-font-size: 24px;
  --sls-font-weight: 400;
  --sls-caption-color: #fff;
  --sls-interim-opacity: 0.55;       /* ещё не подтверждённые слова */
  --sls-caption-max-width: 36em;
  --sls-error-color: #ff8a8a;
}
speak-louder-sphere::part(caption) { text-shadow: 0 1px 12px rgba(0, 0, 0, 0.6); }
```

Доступные `::part`: `root`, `stage`, `glow`, `canvas`, `button`, `caption`.

## JS API

```js
const sphere = document.querySelector('speak-louder-sphere');

await sphere.start();        // включить микрофон и субтитры (вернёт false, если доступ не дали)
sphere.stop();               // выключить
await sphere.toggle();
sphere.listening;            // true, пока идёт запись
sphere.level;                // текущая громкость 0..1

// Сфера «говорит» голосом ассистента (TTS из <audio>, файл с того же домена или с CORS)
sphere.connectMediaElement(audioElement);
// …или любым MediaStream (например, удалённый голос в WebRTC)
sphere.connectStream(stream);
// …или своими значениями громкости
sphere.setLevel(0.7);

sphere.setCaption('Текст ответа ассистента');   // показать свой текст (null — убрать)
sphere.pushTranscript({ interim: 'привет как' }); // свой сервис распознавания: гипотеза
sphere.pushTranscript({ final: 'привет как дела' }); // …и итоговый текст
sphere.simulate(true);                            // имитация речи без микрофона
```

Ошибки не показываются на странице: они пишутся в консоль браузера (`[speak-louder-sphere] …`) и приходят событием `sls-error`.

События всплывают и проходят через Shadow DOM:

| Событие | `detail` |
|---|---|
| `sls-start` / `sls-stop` | `{ source }`: микрофон включён или выключен |
| `sls-transcript` | `{ text, final, interim, isFinal }`: текущая фраза, новый итоговый кусок, гипотеза |
| `sls-error` | `{ code, message }`: например `mic-NotAllowedError`, `speech-network`, `speech-unsupported` |
| `sls-sourcechange` | `{ source }`: `none`, `microphone`, `stream`, `element`, `simulation`, `manual` |

Пример: отправить сказанное в свой бэкенд или LLM.

```js
sphere.addEventListener('sls-transcript', (e) => {
  if (e.detail.final) sendToAssistant(e.detail.final);
});
```

## Браузеры

| | Сфера и реакция на голос | Живые субтитры |
|---|---|---|
| Chrome, Edge (компьютер, Android) | ✅ | ✅ |
| Safari (macOS, iOS) | ✅ | ✅ |
| Firefox | ✅ | ❌ (предупреждение в консоли) |

- Субтитры построены на встроенном в браузер Web Speech API. Chrome и Edge отправляют звук на свои серверы распознавания, поэтому нужен интернет.
- Если нужна офлайн-обработка, другая точность или один движок во всех браузерах (Whisper, Deepgram, Yandex SpeechKit и т. п.), подключите свой сервис через `pushTranscript()`. Сфера и субтитры будут работать так же.
- Без WebGL показывается упрощённая CSS-версия сферы.

## Структура

```
src/
  index.ts      точка входа: регистрация элемента, createSphere()
  element.ts    веб-компонент <speak-louder-sphere>
  shaders.ts    GLSL: мембрана, стекло, ореол
  renderer.ts   WebGL-рендер
  audio.ts      анализ микрофона/аудио: громкость и частоты
  speech.ts     Web Speech API с автоперезапуском
  captions.ts   субтитры с анимацией слов
  colors.ts     пресеты и разбор цветов
  simulator.ts  имитация речи
demo/           демо-страница с настройками (index.html)
examples/       примеры встраивания
dist/           готовые файлы для сайта
```

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | демо с горячей перезагрузкой |
| `npm run build` | проверка типов и сборка `dist/` (ES-модуль, файл для `<script>`, типы) |
| `npm run typecheck` | только проверка типов |
