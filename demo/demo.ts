import { COLOR_ROLES, PRESETS, type ColorRole, type PresetName } from '../src/index';

const sphere = document.getElementById('sphere')!;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ROLE_LABELS: Record<ColorRole, [string, string]> = {
  deep: ['Стекло', 'тёмная основа'],
  body: ['Основной', 'верх мембраны'],
  glow: ['Свечение', 'низ мембраны и сгиб'],
  accent: ['Акцент', 'перелив сверху'],
  rim: ['Ободок', 'край стекла и ореол'],
};

const PRESET_LABELS: Record<PresetName, string> = {
  nova: 'Nova',
  aurora: 'Aurora',
  amethyst: 'Amethyst',
  sunset: 'Sunset',
  ember: 'Ember',
  ocean: 'Ocean',
  mono: 'Mono',
};

const DEFAULTS = {
  size: '340',
  sensitivity: '1',
  speed: '1',
  lang: 'ru-RU',
  text: 'Привет! Нажми на сферу и начни говорить',
  listeningText: 'Говорите, я слушаю…',
};

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
for (const role of COLOR_ROLES) {
  const row = document.createElement('label');
  row.className = 'color-row';
  row.innerHTML = `<input type="color" /><span class="label">${ROLE_LABELS[role][0]}<span class="hint">${ROLE_LABELS[role][1]}</span></span><code></code>`;
  const input = row.querySelector('input')!;
  input.addEventListener('input', () => {
    colors[role] = input.value;
    apply();
  });
  colorInputs[role] = input;
  colorCodes[role] = row.querySelector('code')!;
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
text.value = DEFAULTS.text;
listeningText.value = DEFAULTS.listeningText;

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
    btn.textContent = 'Скопировано ✓';
  } catch {
    btn.textContent = 'Выделите код и скопируйте вручную';
  }
  setTimeout(() => (btn.textContent = 'Скопировать'), 1800);
});

size.value = DEFAULTS.size;
apply();
