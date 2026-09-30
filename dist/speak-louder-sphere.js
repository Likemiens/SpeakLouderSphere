//#region src/audio.ts
var e = [
	[
		"low",
		80,
		350
	],
	[
		"mid",
		350,
		2200
	],
	[
		"high",
		2200,
		7500
	]
], t = /* @__PURE__ */ new WeakMap(), n = class {
	constructor() {
		this.sensitivity = 1, this.ctx = null, this.analyser = null, this.source = null, this.ownedStream = null, this.timeData = /* @__PURE__ */ new Float32Array(), this.freqData = /* @__PURE__ */ new Float32Array(), this.noiseFloor = -70, this.capturedElement = !1, this.out = {
			level: 0,
			low: 0,
			mid: 0,
			high: 0
		};
	}
	get connected() {
		return !!this.source;
	}
	async useMicrophone() {
		if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Object.assign(/* @__PURE__ */ Error("Microphone requires a secure context (https or localhost)."), { name: "InsecureContextError" });
		this.context();
		let e = await navigator.mediaDevices.getUserMedia({ audio: {
			echoCancellation: !0,
			noiseSuppression: !0,
			autoGainControl: !0,
			channelCount: 1
		} });
		return this.useStream(e, !0), e;
	}
	useStream(e, t = !1) {
		this.detach();
		let n = this.context();
		this.source = n.createMediaStreamSource(e), this.source.connect(this.analyserNode()), t && (this.ownedStream = e);
	}
	useElement(e) {
		this.detach();
		let n = this.context(), r = t.get(e);
		(!r || r.ctx !== n) && (r = {
			ctx: n,
			node: n.createMediaElementSource(e)
		}, t.set(e, r), e.addEventListener("play", () => void (n.state === "suspended" && n.resume().catch(() => {})))), r.node.connect(n.destination), r.node.connect(this.analyserNode()), this.source = r.node, this.capturedElement = !0;
	}
	detach() {
		if (this.source) try {
			this.source.disconnect(), this.source instanceof MediaElementAudioSourceNode && this.ctx && this.source.connect(this.ctx.destination);
		} catch {}
		this.source = null, this.ownedStream?.getTracks().forEach((e) => e.stop()), this.ownedStream = null;
	}
	resume() {
		this.ctx?.state === "suspended" && this.ctx.resume().catch(() => {});
	}
	suspend() {
		this.capturedElement || this.ctx?.state === "running" && this.ctx.suspend().catch(() => {});
	}
	read(t) {
		let n = this.out, o = this.analyser;
		if (!o || !this.source || this.ctx?.state !== "running") {
			let e = 1 - Math.exp(-t / .25);
			return n.level -= n.level * e, n.low -= n.low * e, n.mid -= n.mid * e, n.high -= n.high * e, n;
		}
		o.getFloatTimeDomainData(this.timeData);
		let s = 0;
		for (let e = 0; e < this.timeData.length; e++) s += this.timeData[e] * this.timeData[e];
		let c = 10 * Math.log10(s / this.timeData.length + 1e-12);
		c < this.noiseFloor ? this.noiseFloor += (c - this.noiseFloor) * (1 - Math.exp(-t / .4)) : this.noiseFloor += t * 2.5, this.noiseFloor = Math.min(-30, Math.max(-95, this.noiseFloor));
		let l = 20 * Math.log10(Math.max(.05, this.sensitivity));
		r(n, "level", i((c - (Math.max(-58, this.noiseFloor + 8) - l)) / 34) ** .9, t, .035, .2), o.getFloatFrequencyData(this.freqData);
		let u = this.ctx.sampleRate / 2 / this.freqData.length, d = a(.02, .18, n.level);
		for (let [a, o, s] of e) {
			let e = Math.max(1, Math.floor(o / u)), c = Math.min(this.freqData.length - 1, Math.ceil(s / u)), f = 0;
			for (let t = e; t <= c; t++) f += 10 ** (this.freqData[t] / 10);
			r(n, a, i((10 * Math.log10(f / Math.max(1, c - e + 1) + 1e-12) + 95 + l) / 55) * d, t, .05, .25);
		}
		return n;
	}
	context() {
		if (!this.ctx || this.ctx.state === "closed") {
			let e = window.AudioContext || window.webkitAudioContext;
			this.ctx = new e(), this.analyser = null;
		}
		return this.resume(), this.ctx;
	}
	analyserNode() {
		if (!this.analyser) {
			let e = this.context().createAnalyser();
			e.fftSize = 1024, e.smoothingTimeConstant = .5, this.analyser = e, this.timeData = new Float32Array(e.fftSize), this.freqData = new Float32Array(e.frequencyBinCount);
		}
		return this.analyser;
	}
};
function r(e, t, n, r, i, a) {
	let o = e[t], s = n > o ? i : a;
	e[t] = o + (n - o) * (1 - Math.exp(-r / s));
}
function i(e) {
	return e < 0 ? 0 : e > 1 ? 1 : e;
}
function a(e, t, n) {
	let r = i((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}
//#endregion
//#region src/captions.ts
var o = class {
	constructor(e, t) {
		this.box = e, this.line = t, this.maxLines = 2, this.words = [], this.all = [], this.first = 0, this.fitting = !1, this.kind = "";
	}
	get text() {
		return this.words.filter(Boolean).map((e) => e.text).join(" ");
	}
	setTranscript(e, t) {
		this.setKind("transcript");
		let n = s(e), r = s(t), i = [...n.map((e) => ({
			t: e,
			interim: !1
		})), ...r.map((e) => ({
			t: e,
			interim: !0
		}))];
		i.length && (i[0].t = c(i[0].t)), this.fitting = !0, this.render(i);
	}
	setMessage(e, t = "text") {
		let n = s(e), r = this.kind === t && !this.fitting && n.join(" ") === this.all.map((e) => e.t).join(" ");
		this.setKind(t), !r && (this.fitting = !1, this.reset(), this.render(n.map((e) => ({
			t: e,
			interim: !1
		}))));
	}
	clear() {
		this.setKind(""), this.fitting = !1, this.all = [], this.reset();
	}
	refit() {
		if (this.fitting && this.all.length) {
			if (this.first > 0) {
				let e = this.all;
				this.reset(), this.render(e, !1);
			} else this.fit();
		}
	}
	setKind(e) {
		this.kind !== e && (this.kind = e, this.box.dataset.kind = e);
	}
	reset() {
		this.line.textContent = "", this.words = [], this.first = 0, this.line.classList.remove("truncated");
	}
	render(e, t = !0) {
		this.all = e;
		let n = this.words;
		e.length <= this.first && this.reset();
		for (let r = this.first; r < e.length; r++) {
			let i = e[r], a = n[r];
			if (a && a.text === i.t) {
				a.interim !== i.interim && (a.interim = i.interim, a.el.classList.toggle("interim", i.interim));
				continue;
			}
			if (a) {
				a.text = i.t, a.interim = i.interim, a.inner.textContent = i.t, a.el.classList.toggle("interim", i.interim), t && l(a.el);
				continue;
			}
			n[r] = this.createWord(i.t, i.interim, r > this.first, t);
		}
		for (let t = n.length - 1; t >= e.length; t--) this.removeWord(t);
		n.length = Math.max(this.first, e.length), this.fitting && this.fit();
	}
	createWord(e, t, n, r) {
		let i = n ? document.createTextNode(" ") : null, a = document.createElement("span");
		a.className = "w" + (r ? " enter" : "") + (t ? " interim" : "");
		let o = document.createElement("span");
		return o.className = "wi", o.textContent = e, a.appendChild(o), r && a.addEventListener("animationend", () => a.classList.remove("enter"), { once: !0 }), i && this.line.appendChild(i), this.line.appendChild(a), {
			text: e,
			interim: t,
			el: a,
			inner: o,
			space: i
		};
	}
	removeWord(e) {
		let t = this.words[e];
		t && (t.space?.remove(), t.el.remove(), delete this.words[e]);
	}
	fit() {
		let e = parseFloat(getComputedStyle(this.line).lineHeight) || 0;
		if (!e) return;
		let t = e * this.maxLines + 2;
		for (; this.first < this.words.length - 1 && this.line.getBoundingClientRect().height > t;) {
			this.removeWord(this.first), this.first++;
			let e = this.words[this.first];
			e?.space?.remove(), e && (e.space = null), this.line.classList.add("truncated");
		}
	}
};
function s(e) {
	return e.trim().split(/\s+/).filter(Boolean);
}
function c(e) {
	return e.charAt(0).toLocaleUpperCase() + e.slice(1);
}
function l(e) {
	e.classList.remove("enter"), e.offsetWidth, e.classList.add("enter"), e.addEventListener("animationend", () => e.classList.remove("enter"), { once: !0 });
}
//#endregion
//#region src/colors.ts
var u = [
	"deep",
	"body",
	"glow",
	"accent",
	"rim"
], d = {
	nova: {
		deep: "#07154a",
		body: "#2f6bff",
		glow: "#3fe6ff",
		accent: "#9747ff",
		rim: "#5f9dff"
	},
	aurora: {
		deep: "#03262a",
		body: "#10b3a3",
		glow: "#7dffc0",
		accent: "#3ab8ff",
		rim: "#4fe3c8"
	},
	amethyst: {
		deep: "#1a0838",
		body: "#7c3aed",
		glow: "#f07cff",
		accent: "#4f8bff",
		rim: "#b68cff"
	},
	sunset: {
		deep: "#2a0a1c",
		body: "#ff4d6d",
		glow: "#ffb45e",
		accent: "#ffe066",
		rim: "#ff8a9f"
	},
	ember: {
		deep: "#240c02",
		body: "#e8590c",
		glow: "#ffd43b",
		accent: "#ff3b30",
		rim: "#ff9b50"
	},
	ocean: {
		deep: "#021a33",
		body: "#0077ff",
		glow: "#00e5ff",
		accent: "#00ffa3",
		rim: "#4cb8ff"
	},
	mono: {
		deep: "#111318",
		body: "#7b8190",
		glow: "#f4f6fb",
		accent: "#b9bfcc",
		rim: "#d5d9e2"
	}
}, f = "nova";
function p(e) {
	return !!e && Object.prototype.hasOwnProperty.call(d, e);
}
var m;
function h(e) {
	if (!e) return null;
	let t = e.trim(), n = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
	if (n) return g(n[1]);
	if (m === void 0 && (m = document.createElement("canvas").getContext("2d")), !m) return null;
	m.fillStyle = "#010203", m.fillStyle = t;
	let r = String(m.fillStyle);
	if (r === "#010203" && !/^#?010203$/i.test(t)) return null;
	if (r.startsWith("#")) return g(r.slice(1));
	let i = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(r);
	return i ? [
		Number(i[1]) / 255,
		Number(i[2]) / 255,
		Number(i[3]) / 255
	] : null;
}
function g(e) {
	let t = e.length === 3 ? e.replace(/./g, (e) => e + e) : e, n = parseInt(t, 16);
	return [
		(n >> 16 & 255) / 255,
		(n >> 8 & 255) / 255,
		(n & 255) / 255
	];
}
function _([e, t, n]) {
	let r = (e) => e <= .04045 ? e / 12.92 : ((e + .055) / 1.055) ** 2.4;
	return [
		r(e),
		r(t),
		r(n)
	];
}
function v([e, t, n]) {
	let r = (e) => Math.round(Math.min(1, Math.max(0, e)) * 255).toString(16).padStart(2, "0");
	return `#${r(e)}${r(t)}${r(n)}`;
}
function y(e, ...t) {
	let n = d[p(e) ? e : f], r = {};
	for (let e of u) {
		let i = h(n[e]);
		for (let n of t) {
			let t = h(n?.[e]);
			t && (i = t);
		}
		r[e] = i;
	}
	return r;
}
//#endregion
//#region src/i18n.ts
var b = {
	ru: {
		start: "Включить микрофон",
		stop: "Выключить микрофон",
		denied: "Нет доступа к микрофону",
		noMic: "Микрофон не найден",
		insecure: "Микрофон работает только по HTTPS",
		noSpeech: "Субтитры в этом браузере недоступны — попробуйте Chrome, Edge или Safari",
		network: "Нет связи с сервисом распознавания речи",
		langUnsupported: "Этот язык распознавания не поддерживается"
	},
	en: {
		start: "Turn the microphone on",
		stop: "Turn the microphone off",
		denied: "Microphone access is blocked",
		noMic: "No microphone found",
		insecure: "The microphone only works over HTTPS",
		noSpeech: "Live captions are not available in this browser — try Chrome, Edge or Safari",
		network: "Speech recognition service is unreachable",
		langUnsupported: "This recognition language is not supported"
	}
};
function x(e, t) {
	return (e.toLowerCase().startsWith("ru") ? b.ru : b.en)[t];
}
//#endregion
//#region src/shaders.ts
var S = "\nattribute vec2 aPos;\nvoid main() {\n  gl_Position = vec4(aPos, 0.0, 1.0);\n}\n", C = "\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n\nuniform vec2 uRes;       // drawing buffer size, px\nuniform float uRadius;   // sphere radius as a fraction of half the shorter side\nuniform float uTime;     // animation time (runs faster while speaking)\nuniform mat3 uFrame;     // world -> sheet space rotation\nuniform float uAmp;      // sheet wave amplitude\nuniform float uOffset;   // sheet height\nuniform float uRipple;   // fine ripples (high frequencies of the voice)\nuniform float uEnergy;   // overall brightness of the light inside\nuniform vec3 uDeep;      // colours, linear RGB\nuniform vec3 uBody;\nuniform vec3 uGlow;\nuniform vec3 uAccent;\nuniform vec3 uRim;\n\nfloat hash12(vec2 p) {\n  vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n  p3 += dot(p3, p3.yzx + 33.33);\n  return fract((p3.x + p3.y) * p3.z);\n}\n\n// The sheet as an implicit surface f(p) = 0 (f > 0 above it); also returns the world-space gradient.\nfloat sheet(vec3 p, out vec3 grad) {\n  vec3 q = uFrame * p;\n  float t = uTime;\n  float a1 = 2.6 * q.x + 0.80 * t;\n  float a2 = 2.1 * q.z - 0.63 * t + 1.3;\n  float a3 = 2.19 * (q.x - q.z) + 1.07 * t + 2.0;\n  float b1 = 6.3 * q.x + 4.1 * t;\n  float b2 = 5.7 * q.z - 3.3 * t;\n  float h  = uAmp * (0.60 * sin(a1) + 0.45 * sin(a2) + 0.22 * sin(a3)) + uRipple * sin(b1) * sin(b2);\n  float hx = uAmp * (1.56 * cos(a1) + 0.482 * cos(a3)) + uRipple * 6.3 * cos(b1) * sin(b2);\n  float hz = uAmp * (0.945 * cos(a2) - 0.482 * cos(a3)) + uRipple * 5.7 * sin(b1) * cos(b2);\n  grad = vec3(-hx, 1.0, -hz) * uFrame;   // v * M == transpose(M) * v: back to world space\n  return q.y - uOffset - h;\n}\n\nvec3 toSRGB(vec3 c) {\n  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));\n}\n\n// Hue-preserving tone mapping: keeps blues blue instead of washing them out;\n// only the hottest spots burn towards white.\nvec3 tonemap(vec3 c) {\n  c *= 1.25;\n  float m = max(c.r, max(c.g, c.b));\n  return c * ((1.0 - exp(-m)) / max(m, 1e-5)) + max(m - 1.3, 0.0) * 0.06;\n}\n\nvoid main() {\n  float minRes = min(uRes.x, uRes.y);\n  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * minRes * uRadius);\n  float r = length(p);\n  float px = 2.0 / (minRes * uRadius);   // one pixel in sphere units\n  float dither = hash12(gl_FragCoord.xy);\n\n  // ---- the ball -------------------------------------------------------------\n  float cov = 1.0 - smoothstep(1.0 - px, 1.0 + px, r);\n  vec3 ball = vec3(0.0);\n\n  if (cov > 0.0) {\n    float rc = min(r, 0.9995);\n    float z = sqrt(1.0 - rc * rc);\n\n    // Ball-lens look: the middle is magnified, the edge compressed.\n    vec3 P = vec3(p * (0.85 + 0.25 * rc * rc), 0.5 * z);\n\n    vec3 g;\n    float f = sheet(P, g);\n    float gl = length(g);\n    float d = f / gl;                  // signed distance to the sheet\n    float nz = g.z / gl;               // > 0: top side faces us, < 0: underside faces us\n    float underFacing = smoothstep(-0.15, 0.55, -nz);\n    float topFacing = smoothstep(-0.15, 0.55, nz);\n    float vio = smoothstep(0.0, 1.0, P.x * 0.8 + P.y * 0.5);\n\n    float below = d < 0.0 ? exp(-d * d / 0.1444) : 0.0;               // width 0.38\n    vec3 cBelow = mix(uBody, uGlow, exp(-d * d / 0.0576));             // width 0.24\n    float above = d > 0.0 ? exp(-d * d / 0.1024) : 0.0;               // width 0.32\n    vec3 cAbove = mix(mix(uBody, uAccent, vio), uGlow, 0.45 * exp(-d * 12.0));\n    float crease = exp(-d * d / 0.0004);                               // width 0.02\n    vec3 cCrease = mix(uGlow, uAccent, vio * 0.7) + 0.08;\n\n    vec3 acc = cBelow * below * 3.2 * (0.3 + 0.7 * underFacing)\n             + cAbove * above * 2.2 * (0.3 + 0.7 * topFacing)\n             + cCrease * crease * 0.45;\n    acc *= uEnergy * mix(1.0, smoothstep(1.02, 0.55, rc), 0.5);        // frosted, dimmer edge\n\n    // Glass: dark body, darker towards the bottom, and a soft rim (a bit stronger bottom-left).\n    vec3 base = 0.6 * uDeep * (0.55 + 0.45 * z) * (0.3 + 0.9 * (0.5 + 0.5 * p.y));\n    float side = 0.8 + 0.2 * dot(p / max(r, 1e-5), vec2(-0.7071, -0.7071));\n    float rim = exp(-(1.0 - min(r, 1.0)) * 22.0) * 0.45 * side;\n\n    ball = toSRGB(tonemap(acc + uRim * rim) + base);\n  }\n\n  // Premultiplied alpha: the ball is opaque, everything around it transparent.\n  vec3 rgb = clamp(ball + (dither - 0.5) / 255.0, 0.0, 1.0);\n  gl_FragColor = vec4(rgb * cov, cov);\n}\n", w = [
	"uRes",
	"uRadius",
	"uTime",
	"uFrame",
	"uAmp",
	"uOffset",
	"uRipple",
	"uEnergy",
	"uDeep",
	"uBody",
	"uGlow",
	"uAccent",
	"uRim"
], T = {
	deep: "uDeep",
	body: "uBody",
	glow: "uGlow",
	accent: "uAccent",
	rim: "uRim"
}, E = class e {
	static create(t) {
		let n = t.getContext("webgl", {
			alpha: !0,
			premultipliedAlpha: !0,
			antialias: !1,
			depth: !1,
			stencil: !1,
			preserveDrawingBuffer: !1
		});
		if (!n) return null;
		let r = new e(t, n);
		return r.program ? r : null;
	}
	constructor(e, t) {
		this.canvas = e, this.program = null, this.buffer = null, this.loc = {}, this.colors = {}, this.lost = !1, this.onLost = (e) => {
			e.preventDefault(), this.lost = !0, this.program = null, this.buffer = null;
		}, this.onRestored = () => {
			this.lost = !1, this.init();
		}, this.gl = t, e.addEventListener("webglcontextlost", this.onLost, !1), e.addEventListener("webglcontextrestored", this.onRestored, !1), this.init();
	}
	get ready() {
		return !this.lost && !!this.program;
	}
	setColors(e) {
		for (let t of u) this.colors[t] = _(e[t]);
	}
	resize(e, t) {
		let n = Math.max(1, Math.round(e)), r = Math.max(1, Math.round(t));
		(this.canvas.width !== n || this.canvas.height !== r) && (this.canvas.width = n, this.canvas.height = r);
	}
	render(e) {
		let t = this.gl;
		if (!this.ready) return;
		t.viewport(0, 0, this.canvas.width, this.canvas.height), t.useProgram(this.program);
		let n = this.loc;
		t.uniform2f(n.uRes, this.canvas.width, this.canvas.height), t.uniform1f(n.uRadius, e.radius), t.uniform1f(n.uTime, e.time), t.uniformMatrix3fv(n.uFrame, !1, e.frame), t.uniform1f(n.uAmp, e.amp), t.uniform1f(n.uOffset, e.offset), t.uniform1f(n.uRipple, e.ripple), t.uniform1f(n.uEnergy, e.energy);
		for (let e of u) {
			let r = this.colors[e];
			r && t.uniform3f(n[T[e]], r[0], r[1], r[2]);
		}
		t.drawArrays(t.TRIANGLES, 0, 3);
	}
	dispose() {
		this.canvas.removeEventListener("webglcontextlost", this.onLost), this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
		let e = this.gl;
		this.program && e.deleteProgram(this.program), this.buffer && e.deleteBuffer(this.buffer), this.program = null, this.buffer = null, e.getExtension("WEBGL_lose_context")?.loseContext();
	}
	init() {
		let e = this.gl;
		this.program && e.deleteProgram(this.program), this.program = null;
		let t = D(e, e.VERTEX_SHADER, S), n = D(e, e.FRAGMENT_SHADER, C);
		if (!t || !n) return;
		let r = e.createProgram();
		if (r) {
			if (e.attachShader(r, t), e.attachShader(r, n), e.bindAttribLocation(r, 0, "aPos"), e.linkProgram(r), e.deleteShader(t), e.deleteShader(n), !e.getProgramParameter(r, e.LINK_STATUS)) {
				console.error("[speak-louder-sphere] link error:", e.getProgramInfoLog(r)), e.deleteProgram(r);
				return;
			}
			this.program = r;
			for (let t of w) this.loc[t] = e.getUniformLocation(r, t);
			this.buffer || (this.buffer = e.createBuffer(), e.bindBuffer(e.ARRAY_BUFFER, this.buffer), e.bufferData(e.ARRAY_BUFFER, new Float32Array([
				-1,
				-1,
				3,
				-1,
				-1,
				3
			]), e.STATIC_DRAW)), e.bindBuffer(e.ARRAY_BUFFER, this.buffer), e.enableVertexAttribArray(0), e.vertexAttribPointer(0, 2, e.FLOAT, !1, 0, 0), e.disable(e.BLEND), e.clearColor(0, 0, 0, 0);
		}
	}
};
function D(e, t, n) {
	let r = e.createShader(t);
	return r ? (e.shaderSource(r, n), e.compileShader(r), e.getShaderParameter(r, e.COMPILE_STATUS) ? r : (console.error("[speak-louder-sphere] shader error:", e.getShaderInfoLog(r)), e.deleteShader(r), null)) : null;
}
function O(e, t, n, r = /* @__PURE__ */ new Float32Array(9)) {
	let i = Math.cos(e), a = Math.sin(e), o = Math.cos(t), s = Math.sin(t), c = Math.cos(n), l = Math.sin(n), u = c * i - l * s * a, d = -l * o, f = c * a + l * s * i, p = l * i + c * s * a, m = c * o, h = l * a - c * s * i, g = -o * a, _ = s, v = o * i;
	return r[0] = u, r[1] = p, r[2] = g, r[3] = d, r[4] = m, r[5] = _, r[6] = f, r[7] = h, r[8] = v, r;
}
//#endregion
//#region src/simulator.ts
var k = class {
	constructor() {
		this.talking = !1, this.left = .4, this.syl = 0, this.rate = 4.5, this.amp = .7, this.hiss = 0, this.out = {
			level: 0,
			low: 0,
			mid: 0,
			high: 0
		};
	}
	read(e) {
		this.left -= e, this.left <= 0 && (this.talking = !this.talking, this.left = this.talking ? 1.4 + Math.random() * 2.8 : .35 + Math.random() * 1.1);
		let t = 0;
		this.talking && (this.syl += e * this.rate, this.syl >= 1 && (this.syl %= 1, this.rate = 3.2 + Math.random() * 3.4, this.amp = .4 + Math.random() * .6, this.hiss = Math.random() < .3 ? .5 + Math.random() * .5 : Math.random() * .3), t = this.amp * (.3 + .7 * Math.sin(Math.PI * this.syl)));
		let n = this.out, r = (t) => 1 - Math.exp(-e / t);
		return n.level += (t - n.level) * r(t > n.level ? .04 : .16), n.low += (t * (.8 - .4 * this.hiss) - n.low) * r(.08), n.mid += (t * .9 - n.mid) * r(.08), n.high += (t * this.hiss - n.high) * r(.06), n;
	}
};
//#endregion
//#region src/speech.ts
function A() {
	let e = window;
	return e.SpeechRecognition || e.webkitSpeechRecognition || null;
}
var j = /* @__PURE__ */ new Set([
	"not-allowed",
	"service-not-allowed",
	"language-not-supported",
	"audio-capture"
]), M = typeof navigator < "u" && /android/i.test(navigator.userAgent), N = class {
	constructor() {
		this.lang = "ru-RU", this.onupdate = null, this.onerror = null, this.rec = null, this.running = !1, this.emitted = [], this.interim = "", this.failures = 0, this.restartTimer = 0, this.sessionStart = 0;
	}
	static get supported() {
		return typeof window < "u" && !!A();
	}
	get active() {
		return this.running;
	}
	start() {
		return A() ? this.running ? !0 : (this.running = !0, this.failures = 0, this.launch(), !0) : !1;
	}
	stop() {
		this.running = !1, clearTimeout(this.restartTimer);
		try {
			this.rec?.stop();
		} catch {}
	}
	launch() {
		let e = A();
		if (!e || !this.running) return;
		let t = new e();
		t.lang = this.lang, t.continuous = !M, t.interimResults = !0, t.maxAlternatives = 1, t.onresult = (e) => t === this.rec && this.handleResult(e), t.onerror = (e) => t === this.rec && this.handleError(e.error), t.onend = () => t === this.rec && this.handleEnd(), this.rec = t, this.emitted = [], this.interim = "", this.sessionStart = performance.now();
		try {
			t.start();
		} catch {
			this.handleEnd();
		}
	}
	handleResult(e) {
		let t = "", n = "";
		for (let r = 0; r < e.results.length; r++) {
			let i = e.results[r], a = i[0]?.transcript ?? "";
			i.isFinal ? this.emitted[r] || (this.emitted[r] = !0, t += " " + a) : n += " " + a;
		}
		this.interim = n.trim(), this.failures = 0, this.onupdate?.({
			final: t.trim(),
			interim: this.interim
		});
	}
	handleError(e) {
		if (e !== "no-speech" && e !== "aborted") {
			if (j.has(e)) {
				this.running = !1, this.onerror?.(e);
				return;
			}
			this.failures++, e === "network" && this.failures === 1 && this.onerror?.(e), this.failures > 4 && (this.running = !1, this.onerror?.(e));
		}
	}
	handleEnd() {
		if (this.interim) {
			let e = this.interim;
			this.interim = "", this.onupdate?.({
				final: e,
				interim: ""
			});
		}
		if (this.rec = null, !this.running) return;
		let e = performance.now() - this.sessionStart < 1e3 ? Math.min(5e3, 250 * 2 ** this.failures) : 60;
		this.restartTimer = window.setTimeout(() => this.launch(), e);
	}
}, P = "\n:host {\n  --_size: var(--sls-size, min(320px, 76vw));\n  display: inline-block;\n  vertical-align: top;\n  max-width: 100%;\n  color: inherit;\n  -webkit-tap-highlight-color: transparent;\n}\n:host([hidden]) { display: none; }\n\n.root {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n}\n\n/* The stage keeps 15% of transparent room around the sphere for the voice\n   pulse, so the canvas never sticks out of the element (no stray scrollbars). */\n.stage {\n  position: relative;\n  width: calc(var(--_size) * 1.3);\n  max-width: 100%;\n  aspect-ratio: 1 / 1;\n}\n\n/* Soft light around the sphere while it listens and speaks. A blurred\n   box-shadow: smooth, cheap to animate (opacity), and it never creates scrollbars.\n   The disc is a bit smaller than the sphere, so the light starts right under its edge. */\n.glow {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  width: 72.3%;\n  height: 72.3%;\n  border-radius: 50%;\n  pointer-events: none;\n  opacity: 0;\n  transform: translate(-50%, -50%);\n  will-change: opacity, transform;\n  box-shadow:\n    0 0 calc(var(--_size) * 0.16) calc(var(--_size) * 0.03) var(--_glow-in, rgba(63, 230, 255, 0.5)),\n    0 0 calc(var(--_size) * 0.6) calc(var(--_size) * 0.07) var(--_glow-out, rgba(53, 156, 255, 0.32));\n}\n\ncanvas {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n.fallback {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  width: 76.92%;\n  height: 76.92%;\n  pointer-events: none;\n  border-radius: 50%;\n  background:\n    radial-gradient(60% 38% at 45% 62%, var(--_glow) 0%, transparent 70%),\n    radial-gradient(50% 40% at 62% 36%, var(--_accent) 0%, transparent 75%),\n    radial-gradient(70% 60% at 38% 35%, var(--_body) 0%, transparent 80%),\n    var(--_deep);\n  box-shadow: inset 0 0 0 1.5px var(--_rim), inset 0 0 24px var(--_rim), 0 0 40px -8px var(--_rim);\n  transform: translate(-50%, -50%) scale(var(--_pulse, 1));\n}\n\nbutton {\n  position: absolute;\n  inset: 11.54%;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  border-radius: 50%;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n  outline: none;\n  -webkit-user-select: none;\n  user-select: none;\n  touch-action: manipulation;\n}\nbutton:focus-visible {\n  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9), 0 0 0 6px var(--_rim);\n}\n:host([interactive=\"false\"]) button { cursor: default; }\n\n.caption {\n  box-sizing: border-box;\n  margin-top: calc(var(--sls-gap, calc(var(--_size) * 0.16)) - var(--_size) * 0.15);\n  max-width: min(100%, var(--sls-caption-max-width, max(calc(var(--_size) * 2.4), 18em)));\n  min-height: calc(var(--_lines, 2) * 1.35em);\n  padding: 0 0.5em;\n  text-align: center;\n  font-family: var(--sls-font-family, inherit);\n  font-size: var(--sls-font-size, clamp(15px, calc(var(--_size) * 0.058), 32px));\n  font-weight: var(--sls-font-weight, 400);\n  line-height: 1.35;\n  letter-spacing: var(--sls-letter-spacing, -0.01em);\n  color: var(--sls-caption-color, inherit);\n  opacity: 1;\n  transition: opacity 0.6s ease;\n  overflow-wrap: anywhere;\n}\n:host([captions=\"false\"]) .caption,\n:host([captions=\"off\"]) .caption { display: none; }\n.caption.fading { opacity: 0; }\n.caption[data-kind=\"hint\"] { opacity: var(--sls-hint-opacity, 0.55); }\n.caption[data-kind=\"hint\"].fading { opacity: 0; }\n.caption[data-kind=\"error\"] { color: var(--sls-error-color, #ff8a8a); }\n\n.line { display: block; }\n.line.truncated::before { content: \"… \"; opacity: 0.5; }\n\n.w { display: inline-block; white-space: pre; }\n.wi { transition: opacity 0.35s ease; }\n.w.interim .wi { opacity: var(--sls-interim-opacity, 0.55); }\n.w.enter { animation: sls-word 0.5s cubic-bezier(0.2, 0.75, 0.25, 1) both; }\n\n@keyframes sls-word {\n  from { opacity: 0; transform: translateY(0.35em); filter: blur(6px); }\n  to   { opacity: 1; transform: none; filter: blur(0); }\n}\n\n.sr {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  clip-path: inset(50%);\n  white-space: nowrap;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .w.enter { animation: sls-fade 0.3s ease both; }\n  @keyframes sls-fade { from { opacity: 0; } to { opacity: 1; } }\n}\n", F = 1.3, I = {
	low: 1,
	medium: 1.5,
	high: 2
}, L = {
	high: "medium",
	medium: "low",
	low: "low"
}, R = {
	"color-deep": "deep",
	"color-body": "body",
	"color-glow": "glow",
	"color-accent": "accent",
	"color-rim": "rim"
}, z = [
	"preset",
	...Object.keys(R),
	"size",
	"lang",
	"text",
	"listening-text",
	"captions",
	"caption-lines",
	"caption-hold",
	"sensitivity",
	"speed",
	"quality",
	"interactive",
	"simulate"
], B = `
<style>${P}</style>
<div class="root" part="root">
  <div class="stage" part="stage">
    <div class="glow" part="glow" aria-hidden="true"></div>
    <canvas part="canvas" aria-hidden="true"></canvas>
    <div class="fallback" part="fallback" hidden></div>
    <button type="button" part="button" aria-pressed="false"></button>
  </div>
  <div class="caption" part="caption"><span class="line"></span></div>
  <div class="sr" role="status" aria-live="polite"></div>
</div>`, V = class extends HTMLElement {
	static get observedAttributes() {
		return z;
	}
	constructor() {
		super(), this.renderer = null, this.canvasUsed = !1, this.quality = "high", this.analyser = new n(), this.transcriber = null, this.simulator = null, this.src = "none", this.manualLevel = 0, this.starting = !1, this.colorOverrides = {}, this.rgb = y(null), this.raf = 0, this.last = 0, this.lastDraw = 0, this.time = Math.random() * 100, this.onScreen = !0, this.features = {
			level: 0,
			low: 0,
			mid: 0,
			high: 0
		}, this.listen = 0, this.hover = 0, this.hovering = !1, this.pressed = !1, this.pulse = 0, this.pulseV = 0, this.glowLevel = 0, this.glowShown = -1, this.perfTime = 0, this.perfSlow = 0, this.matrix = /* @__PURE__ */ new Float32Array(9), this.reducedMotion = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, this.resizeObserver = null, this.intersectionObserver = null, this.hostWidth = -1, this.refitRaf = 0, this.phrase = "", this.interim = "", this.override = null, this.notice = null, this.holdTimer = 0, this.noticeTimer = 0, this.fadeTimer = 0, this.updateLoop = () => {
			let e = this.isConnected && this.onScreen && document.visibilityState !== "hidden";
			e && !this.raf ? (this.last = 0, this.raf = requestAnimationFrame(this.tick)) : e || this.stopLoop();
		}, this.tick = (e) => {
			if (this.raf = requestAnimationFrame(this.tick), this.lastDraw && e - this.lastDraw < 9.5) return;
			let t = this.last ? Math.min(.1, (e - this.last) / 1e3) : 1 / 60;
			this.last = e, this.lastDraw = e, this.step(t, e / 1e3), this.watchPerformance(t);
		};
		let e = this.attachShadow({ mode: "open" });
		e.innerHTML = B;
		let t = (t) => e.querySelector(t);
		this.rootEl = t(".root"), this.stage = t(".stage"), this.canvas = t("canvas"), this.fallback = t(".fallback"), this.glow = t(".glow"), this.button = t("button"), this.captionBox = t(".caption"), this.status = t(".sr"), this.captions = new o(this.captionBox, t(".line")), this.button.addEventListener("click", () => {
			this.analyser.resume(), this.interactive && this.toggle();
		}), this.button.addEventListener("pointerenter", () => this.hovering = !0), this.button.addEventListener("pointerleave", () => {
			this.hovering = !1, this.pressed = !1;
		}), this.button.addEventListener("pointerdown", () => this.pressed = this.interactive), this.button.addEventListener("pointerup", () => this.pressed = !1), this.button.addEventListener("pointercancel", () => this.pressed = !1);
	}
	get listening() {
		return this.src === "microphone";
	}
	get source() {
		return this.src;
	}
	get level() {
		return this.features.level;
	}
	get colors() {
		let e = {};
		for (let t of u) e[t] = v(this.rgb[t]);
		return e;
	}
	set colors(e) {
		this.setColors(e);
	}
	setColors(e) {
		this.colorOverrides = e ? {
			...this.colorOverrides,
			...e
		} : {}, this.applyColors();
	}
	async start() {
		if (this.src === "microphone") return !0;
		if (this.starting) return !1;
		this.starting = !0, this.analyser.sensitivity = this.sensitivity;
		try {
			return await this.analyser.useMicrophone(), this.isConnected ? (this.simulator = null, this.setSource("microphone"), this.startTranscriber(), !0) : (this.analyser.detach(), !1);
		} catch (e) {
			return this.onMicError(e), !1;
		} finally {
			this.starting = !1;
		}
	}
	stop() {
		this.transcriber?.stop(), this.analyser.detach(), this.simulator = null, this.setSource("none"), this.flag("simulate") && this.simulate(!0);
	}
	async toggle() {
		return this.listening ? (this.stop(), !1) : this.start();
	}
	connectStream(e) {
		this.transcriber?.stop(), this.simulator = null, this.analyser.sensitivity = this.sensitivity, this.analyser.useStream(e), this.setSource("stream");
	}
	connectMediaElement(e) {
		this.transcriber?.stop(), this.simulator = null, this.analyser.sensitivity = this.sensitivity, this.analyser.useElement(e), this.setSource("element");
	}
	simulate(e = !0) {
		if (e) {
			if (this.src === "microphone" || this.src === "simulation") return;
			this.analyser.detach(), this.simulator = new k(), this.setSource("simulation");
		} else this.src === "simulation" && (this.simulator = null, this.setSource("none"));
	}
	setLevel(e) {
		this.src !== "manual" && (this.transcriber?.stop(), this.analyser.detach(), this.simulator = null, this.setSource("manual")), this.manualLevel = Math.min(1, Math.max(0, Number(e) || 0));
	}
	setCaption(e) {
		this.override = e, this.phrase = "", this.interim = "", clearTimeout(this.holdTimer), this.swapCaption();
	}
	clearCaption() {
		this.setCaption(null);
	}
	pushTranscript(e) {
		let t = (e.final ?? "").trim(), n = (e.interim ?? "").trim();
		if (!t && !n && !this.interim) return;
		this.override = null, clearTimeout(this.fadeTimer), this.captionBox.classList.remove("fading"), t && (this.phrase = (this.phrase + " " + t).trim()), this.interim = n, this.notice || this.captions.setTranscript(this.phrase, this.interim);
		let r = (this.phrase + " " + this.interim).trim();
		this.emit("sls-transcript", {
			text: r,
			final: t,
			interim: n,
			isFinal: !n
		}), clearTimeout(this.holdTimer);
		let i = this.interim ? Math.max(6e3, this.captionHold * 2) : this.captionHold;
		this.holdTimer = window.setTimeout(() => {
			this.phrase = "", this.interim = "", this.swapCaption();
		}, i);
	}
	connectedCallback() {
		this.applyColors(), this.applyLayout(), this.setupRenderer(), this.button.setAttribute("aria-label", x(this.speechLang, "start")), this.resizeObserver = new ResizeObserver((e) => {
			for (let t of e) t.target === this.stage ? this.resizeCanvas() : this.onHostResize(t.contentRect.width);
		}), this.resizeObserver.observe(this.stage), this.resizeObserver.observe(this), this.intersectionObserver = new IntersectionObserver((e) => {
			this.onScreen = e.some((e) => e.isIntersecting), this.updateLoop();
		}), this.intersectionObserver.observe(this), document.addEventListener("visibilitychange", this.updateLoop), this.flag("simulate") && this.simulate(!0), this.refreshCaption(), this.updateLoop();
	}
	disconnectedCallback() {
		this.transcriber?.stop(), this.analyser.detach(), this.analyser.suspend(), this.simulator = null, this.src = "none", this.removeAttribute("listening"), this.stopLoop(), this.resizeObserver?.disconnect(), this.hostWidth = -1, cancelAnimationFrame(this.refitRaf), this.intersectionObserver?.disconnect(), document.removeEventListener("visibilitychange", this.updateLoop), this.renderer?.dispose(), this.renderer = null, clearTimeout(this.holdTimer), clearTimeout(this.noticeTimer), clearTimeout(this.fadeTimer);
	}
	attributeChangedCallback(e, t, n) {
		t !== n && this.isConnected && (e === "preset" || e in R ? this.applyColors() : e === "size" || e === "caption-lines" ? this.applyLayout() : e === "quality" ? (this.quality = this.pickQuality(), this.resizeCanvas()) : e === "sensitivity" ? this.analyser.sensitivity = this.sensitivity : e === "text" || e === "listening-text" ? !this.phrase && !this.interim && this.override === null && this.swapCaption() : e === "lang" ? (this.button.setAttribute("aria-label", x(this.speechLang, this.listening ? "stop" : "start")), this.transcriber?.active && (this.transcriber.stop(), this.startTranscriber())) : e === "captions" ? this.captionsEnabled ? this.listening && this.startTranscriber() : this.transcriber?.stop() : e === "simulate" && this.simulate(this.flag("simulate")));
	}
	get speechLang() {
		return this.getAttribute("lang") || this.parentElement?.closest("[lang]")?.getAttribute("lang") || navigator.language || "ru-RU";
	}
	get interactive() {
		return this.getAttribute("interactive") !== "false";
	}
	get captionsEnabled() {
		let e = this.getAttribute("captions");
		return e !== "false" && e !== "off";
	}
	get sensitivity() {
		return this.num("sensitivity", 1, .1, 5);
	}
	get speed() {
		return this.num("speed", 1, 0, 5);
	}
	get captionHold() {
		return this.num("caption-hold", 2600, 300, 6e4);
	}
	num(e, t, n, r) {
		let i = this.getAttribute(e), a = i === null || i.trim() === "" ? NaN : Number(i);
		return Number.isFinite(a) ? Math.min(r, Math.max(n, a)) : t;
	}
	flag(e) {
		let t = this.getAttribute(e);
		return t !== null && t !== "false" && t !== "off";
	}
	applyColors() {
		let e = {};
		for (let [t, n] of Object.entries(R)) {
			let r = this.getAttribute(t);
			r && (e[n] = r);
		}
		this.rgb = y(this.getAttribute("preset"), e, this.colorOverrides), this.renderer?.setColors(this.rgb);
		for (let e of u) this.rootEl.style.setProperty(`--_${e}`, v(this.rgb[e]));
		let t = ([e, t, n], r) => `rgba(${Math.round(e * 255)}, ${Math.round(t * 255)}, ${Math.round(n * 255)}, ${r})`, { glow: n, body: r } = this.rgb, i = [
			0,
			1,
			2
		].map((e) => r[e] * .6 + n[e] * .4);
		this.rootEl.style.setProperty("--_glow-in", t(n, .5)), this.rootEl.style.setProperty("--_glow-out", t(i, .32));
	}
	applyLayout() {
		let e = this.getAttribute("size");
		e ? this.rootEl.style.setProperty("--_size", /^\d+(\.\d+)?$/.test(e.trim()) ? `${e.trim()}px` : e) : this.rootEl.style.removeProperty("--_size");
		let t = Math.round(this.num("caption-lines", 2, 1, 10));
		this.captions.maxLines = t, this.rootEl.style.setProperty("--_lines", String(t));
	}
	pickQuality() {
		let e = this.getAttribute("quality");
		return e === "low" || e === "medium" ? e : "high";
	}
	setupRenderer() {
		if (!this.renderer) {
			if (this.canvasUsed) {
				let e = document.createElement("canvas");
				e.setAttribute("part", "canvas"), e.setAttribute("aria-hidden", "true"), this.canvas.replaceWith(e), this.canvas = e;
			}
			this.canvasUsed = !0, this.quality = this.pickQuality(), this.renderer = E.create(this.canvas), this.canvas.hidden = !this.renderer, this.fallback.hidden = !!this.renderer, this.renderer?.setColors(this.rgb), this.resizeCanvas();
		}
	}
	resizeCanvas() {
		if (!this.renderer) return;
		let e = Math.min(window.devicePixelRatio || 1, I[this.quality]), t = this.stage.clientWidth * e;
		this.renderer.resize(t, t);
	}
	onHostResize(e) {
		Math.abs(e - this.hostWidth) < 1 || (this.hostWidth = e, cancelAnimationFrame(this.refitRaf), this.refitRaf = requestAnimationFrame(() => this.captions.refit()));
	}
	setSource(e) {
		if (this.src === e) return;
		let t = this.src === "microphone";
		this.src = e;
		let n = e === "microphone";
		this.toggleAttribute("listening", n), this.button.setAttribute("aria-pressed", String(n)), this.button.setAttribute("aria-label", x(this.speechLang, n ? "stop" : "start")), n !== t && (this.emit(n ? "sls-start" : "sls-stop", { source: e }), !this.phrase && !this.interim && this.override === null && this.swapCaption()), this.emit("sls-sourcechange", { source: e });
	}
	startTranscriber() {
		if (!this.captionsEnabled) return;
		if (!N.supported) {
			this.report("speech-unsupported", "noSpeech", "hint");
			return;
		}
		let e = this.transcriber ?? (this.transcriber = new N());
		e.lang = this.speechLang, e.onupdate = (e) => this.pushTranscript(e), e.onerror = (e) => {
			let t = e === "not-allowed" || e === "service-not-allowed" ? "denied" : e === "language-not-supported" ? "langUnsupported" : e === "audio-capture" ? "noMic" : "network";
			this.report(`speech-${e}`, t, "error");
		}, e.start();
	}
	onMicError(e) {
		let t = e?.name ?? "", n = t === "NotAllowedError" || t === "SecurityError" ? "denied" : t === "InsecureContextError" ? "insecure" : "noMic";
		this.report(`mic-${t || "error"}`, n, "error", e);
	}
	report(e, t, n, r) {
		let i = x(this.speechLang, t), a = n === "error" ? console.warn : console.info;
		r ? a(`[speak-louder-sphere] ${e}: ${i}`, r) : a(`[speak-louder-sphere] ${e}: ${i}`), this.status.textContent = i, this.emit("sls-error", {
			code: e,
			message: i,
			error: r
		}), this.flag("show-errors") && this.showNotice(i, n, n === "error" ? 4500 : 5e3);
	}
	showNotice(e, t, n) {
		this.notice = {
			text: e,
			kind: t
		}, clearTimeout(this.noticeTimer), this.swapCaption(), this.noticeTimer = window.setTimeout(() => {
			this.notice = null, this.swapCaption();
		}, n);
	}
	swapCaption() {
		if (clearTimeout(this.fadeTimer), !(this.captions.text.length > 0)) {
			this.captionBox.classList.remove("fading"), this.refreshCaption();
			return;
		}
		this.captionBox.classList.add("fading"), this.fadeTimer = window.setTimeout(() => {
			this.refreshCaption(), this.captionBox.classList.remove("fading");
		}, 420);
	}
	refreshCaption() {
		if (this.notice) return this.captions.setMessage(this.notice.text, this.notice.kind);
		if (this.phrase || this.interim) return this.captions.setTranscript(this.phrase, this.interim);
		if (this.override !== null) return this.captions.setMessage(this.override, "text");
		let e = this.listening ? this.getAttribute("listening-text") : this.getAttribute("text");
		e ? this.captions.setMessage(e, this.listening ? "hint" : "text") : this.captions.clear();
	}
	emit(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0
		}));
	}
	stopLoop() {
		this.raf && cancelAnimationFrame(this.raf), this.raf = 0;
	}
	step(e, t) {
		let n = this.readFeatures(e), r = (t) => 1 - Math.exp(-e / t);
		this.listen += ((this.src === "none" ? 0 : 1) - this.listen) * r(.5), this.hover += ((this.hovering && this.interactive ? 1 : 0) - this.hover) * r(.18);
		let i = n.level + this.hover * .22 - (this.pressed ? .55 : 0);
		this.pulseV += (170 * (i - this.pulse) - 14 * this.pulseV) * e, this.pulse += this.pulseV * e;
		let a = this.reducedMotion?.matches ? .35 : 1;
		this.time += e * this.speed * a * (.42 + .18 * this.listen + .95 * n.level);
		let o = this.time, s = 1 + .045 * this.pulse * a, c = Math.min(1, .3 * this.listen + .12 * this.hover + .85 * n.level);
		if (this.glowLevel += (c - this.glowLevel) * r(.12), Math.abs(this.glowLevel - this.glowShown) > .003 && (this.glowShown = this.glowLevel, this.glow.style.opacity = this.glowLevel.toFixed(3), this.glow.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`), !this.renderer) {
			this.fallback.style.setProperty("--_pulse", s.toFixed(4));
			return;
		}
		O(.42 * o, .3 + .3 * Math.sin(.21 * o + .7), .25 * Math.sin(.17 * o + 1.9), this.matrix), this.renderer.render({
			time: o,
			frame: this.matrix,
			amp: .3 + .05 * Math.sin(.37 * o) + .12 * n.level + .06 * n.low,
			offset: -.05 + .1 * Math.sin(.29 * o + .4),
			ripple: .045 * n.high + .012 * n.level,
			energy: (.94 + .06 * Math.sin(t * 1.3)) * (1 + .24 * n.level + .08 * n.mid) * (1 + .08 * this.listen + .08 * this.hover),
			radius: s / F
		});
	}
	readFeatures(e) {
		let t = this.features, n;
		if (this.src === "simulation" && this.simulator) n = this.simulator.read(e);
		else if (this.src === "manual") {
			let e = this.manualLevel;
			n = {
				level: e,
				low: e * .8,
				mid: e * .7,
				high: e * .4
			};
		} else n = this.analyser.read(e);
		let r = 1 - Math.exp(-e / .05);
		return t.level += (n.level - t.level) * r, t.low += (n.low - t.low) * r, t.mid += (n.mid - t.mid) * r, t.high += (n.high - t.high) * r, t;
	}
	watchPerformance(e) {
		let t = this.getAttribute("quality");
		t && t !== "auto" || this.quality === "low" || (this.perfTime += e, e > 1 / 38 && (this.perfSlow += e), !(this.perfTime < 4) && (this.perfSlow / this.perfTime > .5 && (this.quality = L[this.quality], this.resizeCanvas()), this.perfTime = 0, this.perfSlow = 0));
	}
}, H = "speak-louder-sphere";
function U(e = H) {
	typeof customElements > "u" || customElements.get(e) || customElements.define(e, e === "speak-louder-sphere" ? V : class extends V {});
}
function W(e, t = {}) {
	U();
	let n = typeof e == "string" ? document.querySelector(e) : e;
	if (!n) throw Error(`speak-louder-sphere: target "${String(e)}" not found`);
	let r = document.createElement(H), i = {
		preset: t.preset,
		size: t.size,
		lang: t.lang,
		text: t.text,
		"listening-text": t.listeningText,
		captions: t.captions === !1 ? "false" : void 0,
		"caption-lines": t.captionLines,
		"caption-hold": t.captionHold,
		sensitivity: t.sensitivity,
		speed: t.speed,
		quality: t.quality,
		interactive: t.interactive === !1 ? "false" : void 0,
		simulate: t.simulate ? "" : void 0
	};
	for (let [e, t] of Object.entries(i)) t != null && r.setAttribute(e, String(t));
	for (let [e, n] of Object.entries(t.colors ?? {})) n && r.setAttribute(`color-${e}`, n);
	return n.appendChild(r), r;
}
U();
//#endregion
export { u as COLOR_ROLES, d as PRESETS, V as SpeakLouderSphereElement, N as SpeechTranscriber, H as TAG_NAME, W as createSphere, U as define, h as parseColor };

//# sourceMappingURL=speak-louder-sphere.js.map