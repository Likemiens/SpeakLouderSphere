export const STYLES: string = /* css */ `
:host {
  --_size: var(--sls-size, min(320px, 76vw));
  display: inline-block;
  vertical-align: top;
  max-width: 100%;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
}
:host([hidden]) { display: none; }

.root {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* The stage keeps 15% of transparent room around the sphere for the voice
   pulse, so the canvas never sticks out of the element (no stray scrollbars). */
.stage {
  position: relative;
  width: calc(var(--_size) * 1.3);
  max-width: 100%;
  aspect-ratio: 1 / 1;
}

/* Soft light around the sphere while it listens and speaks. A blurred
   box-shadow: smooth, cheap to animate (opacity), and it never creates scrollbars.
   The disc is a bit smaller than the sphere, so the light starts right under its edge. */
.glow {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 72.3%;
  height: 72.3%;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%);
  will-change: opacity, transform;
  box-shadow:
    0 0 calc(var(--_size) * 0.16) calc(var(--_size) * 0.03) var(--_glow-in, rgba(63, 230, 255, 0.5)),
    0 0 calc(var(--_size) * 0.6) calc(var(--_size) * 0.07) var(--_glow-out, rgba(53, 156, 255, 0.32));
}

canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.fallback {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 76.92%;
  height: 76.92%;
  pointer-events: none;
  border-radius: 50%;
  background:
    radial-gradient(60% 38% at 45% 62%, var(--_glow) 0%, transparent 70%),
    radial-gradient(50% 40% at 62% 36%, var(--_accent) 0%, transparent 75%),
    radial-gradient(70% 60% at 38% 35%, var(--_body) 0%, transparent 80%),
    var(--_deep);
  box-shadow: inset 0 0 0 1.5px var(--_rim), inset 0 0 24px var(--_rim), 0 0 40px -8px var(--_rim);
  transform: translate(-50%, -50%) scale(var(--_pulse, 1));
}

button {
  position: absolute;
  inset: 11.54%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  outline: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}
button:focus-visible {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9), 0 0 0 6px var(--_rim);
}
:host([interactive="false"]) button { cursor: default; }

.caption {
  box-sizing: border-box;
  margin-top: calc(var(--sls-gap, calc(var(--_size) * 0.16)) - var(--_size) * 0.15);
  max-width: min(100%, var(--sls-caption-max-width, max(calc(var(--_size) * 2.4), 18em)));
  min-height: calc(var(--_lines, 2) * 1.35em);
  padding: 0 0.5em;
  text-align: center;
  font-family: var(--sls-font-family, inherit);
  font-size: var(--sls-font-size, clamp(15px, calc(var(--_size) * 0.058), 32px));
  font-weight: var(--sls-font-weight, 400);
  line-height: 1.35;
  letter-spacing: var(--sls-letter-spacing, -0.01em);
  color: var(--sls-caption-color, inherit);
  opacity: 1;
  transition: opacity 0.6s ease;
  overflow-wrap: anywhere;
}
:host([captions="false"]) .caption,
:host([captions="off"]) .caption { display: none; }
.caption.fading { opacity: 0; }
.caption[data-kind="hint"] { opacity: var(--sls-hint-opacity, 0.55); }
.caption[data-kind="hint"].fading { opacity: 0; }
.caption[data-kind="error"] { color: var(--sls-error-color, #ff8a8a); }

.line { display: block; }
.line.truncated::before { content: "… "; opacity: 0.5; }

.w { display: inline-block; white-space: pre; }
.wi { transition: opacity 0.35s ease; }
.w.interim .wi { opacity: var(--sls-interim-opacity, 0.55); }
.w.enter { animation: sls-word 0.5s cubic-bezier(0.2, 0.75, 0.25, 1) both; }

@keyframes sls-word {
  from { opacity: 0; transform: translateY(0.35em); filter: blur(6px); }
  to   { opacity: 1; transform: none; filter: blur(0); }
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .w.enter { animation: sls-fade 0.3s ease both; }
  @keyframes sls-fade { from { opacity: 0; } to { opacity: 1; } }
}
`;
