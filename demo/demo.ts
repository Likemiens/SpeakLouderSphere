import { COLOR_ROLES, PRESETS, type ColorRole, type PresetName } from '../src/index';

const sphere = document.getElementById('sphere')!;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- Interface language (English by default, Russian on demand) -------------

const UI = {
  en: {
    title: 'SpeakLouderSphere — voice-reactive sphere with live captions',
    langGroup: 'Interface language',
    author: 'Author',
    customize: 'Customize',
    settings: 'Settings',
    close: 'Close',
    preset: 'Preset',
    colors: 'Colors',
    resetColors: 'Reset to preset',
    behavior: 'Behavior',
    size: 'Size',
    sensitivity: 'Microphone sensitivity',
    speed: 'Animation speed',
    speechLang: 'Speech recognition language',
    captions: 'Captions under the sphere',
    simulate: 'Simulate speech (no microphone)',
    texts: 'Texts',
    textIdle: 'When the microphone is off',
    textListening: 'While listening',
    background: 'Page background',
    bgBlack: 'Black',
    bgNavy: 'Dark blue',
    bgLight: 'Light',
    embed: 'Embed code',
    copy: 'Copy',
    copied: 'Copied ✓',
    copyFailed: 'Select the code and copy it manually',
    greeting: 'Hi! Tap the sphere and start talking',
    listening: 'Listening…',
    speech: 'en-US',
    roles: {
      deep: ['Glass', 'dark body'],
      body: ['Body', 'top of the sheet'],
      glow: ['Glow', 'underside and fold'],
      accent: ['Accent', 'tint on top'],
      rim: ['Rim', 'edge of the glass'],
    } as Record<ColorRole, [string, string]>,
  },
  ru: {
    title: 'SpeakLouderSphere — сфера, которая слушает и показывает субтитры',
    langGroup: 'Язык интерфейса',
    author: 'Автор',
    customize: 'Настроить',
    settings: 'Настройки',
    close: 'Закрыть',
    preset: 'Пресет',
    colors: 'Цвета',
    resetColors: 'Сбросить к пресету',
    behavior: 'Поведение',
    size: 'Размер',
    sensitivity: 'Чувствительность микрофона',
    speed: 'Скорость анимации',
    speechLang: 'Язык распознавания',
    captions: 'Субтитры под сферой',
    simulate: 'Имитация речи (без микрофона)',
    texts: 'Тексты',
    textIdle: 'Когда микрофон выключен',
    textListening: 'Пока слушает',
    background: 'Фон страницы',
    bgBlack: 'Чёрный',
    bgNavy: 'Тёмно-синий',
    bgLight: 'Светлый',
    embed: 'Код для сайта',
    copy: 'Скопировать',
    copied: 'Скопировано ✓',
    copyFailed: 'Выделите код и скопируйте вручную',
    greeting: 'Привет! Нажми на сферу и начни говорить',
    listening: 'Говорите, я слушаю…',
    speech: 'ru-RU',
    roles: {
      deep: ['Стекло', 'тёмная основа'],
      body: ['Основной', 'верх мембраны'],
      glow: ['Свечение', 'низ мембраны и сгиб'],
      accent: ['Акцент', 'перелив сверху'],
      rim: ['Ободок', 'край стекла'],
    } as Record<ColorRole, [string, string]>,
  },
};
type UiLang = keyof typeof UI;
type UiKey = Exclude<keyof (typeof UI)['en'], 'roles'>;

const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode etc. */
    }
  },
};

const isUiLang = (v: string | null): v is UiLang => v === 'en' || v === 'ru';
const fromUrl = new URLSearchParams(location.search).get('lang');
let uiLang: UiLang = isUiLang(fromUrl) ? fromUrl : isUiLang(storage.get('sls-ui-lang')) ? (storage.get('sls-ui-lang') as UiLang) : 'en';
const t = (key: UiKey) => UI[uiLang][key];

const PRESET_LABELS: Record<PresetName, string> = {
  nova: 'Nova',
  aurora: 'Aurora',
  amethyst: 'Amethyst',
  sunset: 'Sunset',
  ember: 'Ember',
  ocean: 'Ocean',
  mono: 'Mono',
};

const DEFAULTS = { size: '340', sensitivity: '1', speed: '1' };

let preset: PresetName = 'nova';
let colors: Record<ColorRole, string> = { ...PRESETS.nova };

// ---- Panel -----------------------------------------------------------------

const panel = $('panel');
const openBtn = $<HTMLButtonElement>('open-panel');
const setPanel = (open: boolean) => {
  panel.hidden = !open;
  document.body.classList.toggle('panel-open', open);
  openBtn.setAttribute('aria-expanded', String(open));
  if (open) $<HTMLButtonElement>('close-panel').focus();
  else openBtn.focus();
};
openBtn.addEventListener('click', () => setPanel(panel.hasAttribute('hidden')));
$('close-panel').addEventListener('click', () => setPanel(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !panel.hidden) setPanel(false);
});

// ---- Presets ---------------------------------------------------------------

const presetsEl = $('presets');
for (const name of Object.keys(PRESETS) as PresetName[]) {
  const c = PRESETS[name];
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'preset';
  btn.setAttribute('role', 'radio');
  btn.dataset.preset = name;
  btn.innerHTML = `<span class="dot"></span><span>${PRESET_LABELS[name]}</span>`;
  (btn.firstElementChild as HTMLElement).style.background = `
    radial-gradient(60% 34% at 46% 62%, ${c.glow} 0%, transparent 72%),
    radial-gradient(45% 40% at 68% 36%, ${c.accent} 0%, transparent 75%),
    radial-gradient(70% 55% at 36% 34%, ${c.body} 0%, transparent 80%),
    ${c.deep}`;
  btn.addEventListener('click', () => {
    preset = name;
    colors = { ...PRESETS[name] };
    apply();
  });
  presetsEl.appendChild(btn);
}

// ---- Colours ---------------------------------------------------------------

const colorsEl = $('colors');
const colorInputs = {} as Record<ColorRole, HTMLInputElement>;
const colorCodes = {} as Record<ColorRole, HTMLElement>;
const colorLabels = {} as Record<ColorRole, [HTMLElement, HTMLElement]>;
for (const role of COLOR_ROLES) {
  const row = document.createElement('label');
  row.className = 'color-row';
  row.innerHTML = `<input type="color" /><span class="label"><span class="name"></span><span class="hint"></span></span><code></code>`;
  const input = row.querySelector('input')!;
  input.addEventListener('input', () => {
    colors[role] = input.value;
    apply();
  });
  colorInputs[role] = input;
  colorCodes[role] = row.querySelector('code')!;
  colorLabels[role] = [row.querySelector('.name')!, row.querySelector('.hint')!];
  colorsEl.appendChild(row);
}
$('reset-colors').addEventListener('click', () => {
  colors = { ...PRESETS[preset] };
  apply();
});

// ---- Behaviour ---------------------------------------------------------------

const size = $<HTMLInputElement>('size');
const sensitivity = $<HTMLInputElement>('sensitivity');
const speed = $<HTMLInputElement>('speed');
const lang = $<HTMLSelectElement>('lang');
const captions = $<HTMLInputElement>('captions');
const simulate = $<HTMLInputElement>('simulate');
const text = $<HTMLInputElement>('text');
const listeningText = $<HTMLInputElement>('listening-text');

for (const el of [size, sensitivity, speed, lang, captions, simulate, text, listeningText]) {
  el.addEventListener('input', apply);
  el.addEventListener('change', apply);
}

// ---- Page background ---------------------------------------------------------

const bgButtons = [...$('backgrounds').querySelectorAll<HTMLButtonElement>('button')];
for (const btn of bgButtons) {
  btn.style.background = btn.dataset.bg!;
  btn.addEventListener('click', () => {
    document.documentElement.style.setProperty('--bg', btn.dataset.bg!);
    document.documentElement.style.setProperty('--fg', btn.dataset.fg!);
    bgButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
}

// ---- Language switch -----------------------------------------------------------

const langButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-ui-lang]')];
for (const btn of langButtons) btn.addEventListener('click', () => setUiLang(btn.dataset.uiLang as UiLang));

function setUiLang(next: UiLang, initial = false): void {
  const prev = UI[uiLang];
  uiLang = next;
  const dict = UI[next];
  document.documentElement.lang = next;
  document.title = dict.title;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = dict[el.dataset.i18n as UiKey];
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', dict[el.dataset.i18nAria as UiKey]);
  });
  for (const role of COLOR_ROLES) {
    colorLabels[role][0].textContent = dict.roles[role][0];
    colorLabels[role][1].textContent = dict.roles[role][1];
  }
  langButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.uiLang === next)));
  // Texts and recognition language follow the interface unless they were customised.
  if (initial || !text.value || text.value === prev.greeting) text.value = dict.greeting;
  if (initial || !listeningText.value || listeningText.value === prev.listening) listeningText.value = dict.listening;
  if (initial || lang.value === prev.speech) lang.value = dict.speech;
  storage.set('sls-ui-lang', next);
  apply();
}

// ---- Apply + snippet ---------------------------------------------------------

function setAttr(name: string, value: string | null): void {
  if (value === null) sphere.removeAttribute(name);
  else if (sphere.getAttribute(name) !== value) sphere.setAttribute(name, value);
}

function apply(): void {
  setAttr('preset', preset);
  for (const role of COLOR_ROLES) {
    const changed = colors[role].toLowerCase() !== PRESETS[preset][role].toLowerCase();
    setAttr(`color-${role}`, changed ? colors[role] : null);
    colorInputs[role].value = colors[role];
    colorCodes[role].textContent = colors[role];
  }
  sphere.style.setProperty('--sls-size', `${size.value}px`);
  $('size-out').textContent = `${size.value}px`;
  setAttr('sensitivity', sensitivity.value);
  $('sensitivity-out').textContent = `×${Number(sensitivity.value).toFixed(1)}`;
  setAttr('speed', speed.value);
  $('speed-out').textContent = `×${Number(speed.value).toFixed(1)}`;
  setAttr('lang', lang.value);
  setAttr('captions', captions.checked ? null : 'false');
  setAttr('simulate', simulate.checked ? '' : null);
  setAttr('text', text.value || null);
  setAttr('listening-text', listeningText.value || null);

  presetsEl.querySelectorAll<HTMLElement>('.preset').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.preset === preset));
  });
  $('snippet').textContent = snippet();
}

function snippet(): string {
  const attrs: Array<[string, string]> = [];
  if (preset !== 'nova') attrs.push(['preset', preset]);
  for (const role of COLOR_ROLES) {
    if (colors[role].toLowerCase() !== PRESETS[preset][role].toLowerCase()) attrs.push([`color-${role}`, colors[role]]);
  }
  if (size.value !== '320') attrs.push(['size', size.value]);
  attrs.push(['lang', lang.value]);
  if (text.value) attrs.push(['text', text.value]);
  if (listeningText.value) attrs.push(['listening-text', listeningText.value]);
  if (sensitivity.value !== DEFAULTS.sensitivity) attrs.push(['sensitivity', sensitivity.value]);
  if (speed.value !== DEFAULTS.speed) attrs.push(['speed', speed.value]);
  if (!captions.checked) attrs.push(['captions', 'false']);

  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const lines = attrs.map(([k, v]) => `  ${k}="${esc(v)}"`).join('\n');
  // The widget file is published next to this page (e.g. on Vercel), so the snippet works on any site.
  const src = new URL('/dist/speak-louder-sphere.iife.js', location.href).href;
  return `<script src="${src}"></script>\n\n<speak-louder-sphere\n${lines}\n></speak-louder-sphere>`;
}

$('copy').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('copy');
  try {
    await navigator.clipboard.writeText(snippet());
    btn.textContent = t('copied');
  } catch {
    btn.textContent = t('copyFailed');
  }
  setTimeout(() => (btn.textContent = t('copy')), 1800);
});

size.value = DEFAULTS.size;
setUiLang(uiLang, true);
