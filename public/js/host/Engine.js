/* =========================================================
   NEBULA PARTY — Engine.js (Host)
   Índice:
   1. Constantes y paleta
   2. Utils (Lerp, easings, texto)
   3. AudioManager (Web Audio procedural)
   4. SpriteAnimator (8 personajes con formas de Canvas)
   5. Entradas: InputHub (Socket.io) + TecladoLocal (demo sin servidor)
   6. Transición de escena (Pixel Wipe / fade al azul)
   7. Componentes de UI (Boton, Menu, Ventana)
   8. Estados: Título (0), Lobby (1), Tablero (2), Podio (4)
      (el estado 3, el minijuego, está en Minigame.js)
   9. GameManager (bucle a 60 FPS y cambio de estados)
   10. Arranque
   ========================================================= */
'use strict';

// 1. Constantes y paleta ------------------------------------------------------
const ANCHO = 640;                 // resolución lógica (se escala a la pantalla)
const ALTO = 360;
const PASO_MS = 1000 / 60;         // paso fijo: 60 actualizaciones por segundo
const TRANSICION_MS = 800;
const MAX_JUGADORES = 8;
const PALETA = Object.freeze({
  fondo: '#1c1147',   // violeta muy oscuro: contornos, ojos y paneles
  cielo: '#33228a',   // fondo del espacio (ya no es negro)
  azul: '#4f7bff', cian: '#22d3ee', hielo: '#ffffff', laser: '#ff2055',
  amarillo: '#ffd23f', rosa: '#ff5fa2', verde: '#3ee07a', naranja: '#ff8c3a', morado: '#a26bff',
});
const FUENTE = '"Press Start 2P", ui-monospace, "Courier New", monospace';
const ESTADO = Object.freeze({ TITULO: 0, LOBBY: 1, TABLERO: 2, MINIJUEGO: 3, PODIO: 4 });

// 2. Utils ---------------------------------------------------------------------
const Utils = {
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  azar: (a, b) => a + Math.random() * (b - a),
  entero: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  /** progreso 0..1 de algo que empezó en `inicio` y dura `dur` ms */
  progreso: (inicio, dur, ahora = Date.now()) => Utils.clamp((ahora - inicio) / dur, 0, 1),
  /** grilla lógica de 100x100 unidades sobre la pantalla */
  gx: (u) => (u * ANCHO) / 100,
  gy: (u) => (u * ALTO) / 100,

  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },

  texto(ctx, txt, x, y, o = {}) {
    const { tam = 8, color = PALETA.hielo, alin = 'center', base = 'middle', borde = null, grosor = 3, alfa = 1 } = o;
    ctx.save();
    ctx.globalAlpha *= alfa;
    ctx.font = `${tam}px ${FUENTE}`;
    ctx.textAlign = alin;
    ctx.textBaseline = base;
    if (borde) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = grosor;
      ctx.strokeStyle = borde;
      ctx.strokeText(txt, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(txt, x, y);
    ctx.restore();
  },

  panel(ctx, x, y, w, h, relleno = PALETA.fondo, borde = PALETA.cian, grosor = 2) {
    ctx.fillStyle = relleno;
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = grosor;
    ctx.strokeStyle = borde;
    ctx.strokeRect(x + grosor / 2, y + grosor / 2, w - grosor, h - grosor);
  },
};

// 3. AudioManager ------------------------------------------------------------------
class AudioManager {
  constructor() {
    this.ctx = null;
    this.activo = true;
    this.musica = null;
    this.paso = 0;
  }

  /** El navegador solo deja crear audio después de un clic o una tecla. */
  iniciar() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5 * (this.volumen === undefined ? 0.7 : this.volumen);
      this.master.connect(this.ctx.destination);
      // buffer de ruido blanco para la percusión
      this.ruido = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const datos = this.ruido.getChannelData(0);
      for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get listo() { return this.activo && this.ctx && this.ctx.state === 'running'; }

  alternar() { this.activo = !this.activo; }

  /** Oscilador genérico: va de f1 a f2 en `dur` segundos. */
  tono(tipo, f1, f2, dur, vol = 0.2, retraso = 0) {
    if (!this.listo) return;
    const t = this.ctx.currentTime + retraso;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.linearRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Botón de UI: onda cuadrada de 440 Hz a 880 Hz en 0.1 s. */
  blip() { this.tono('square', 440, 880, 0.1, 0.18); }

  /** Derrota: sierra de 200 Hz a 50 Hz en 0.4 s con filtro pasa-bajos. */
  derrota() {
    if (!this.listo) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, t);
    o.frequency.linearRampToValueAtTime(50, t + 0.4);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.linearRampToValueAtTime(250, t + 0.4);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.45);
  }

  exito() {
    [523, 659, 784, 1046].forEach((f, i) => this.tono('square', f, f, 0.09, 0.14, i * 0.09));
  }

  golpe(t, dur, vol, tipoFiltro, frecuencia) {
    const s = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    s.buffer = this.ruido;
    f.type = tipoFiltro;
    f.frequency.value = frecuencia;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  nota(tipo, midi, t, dur, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Volumen general de 0 a 1. */
  setVolumen(v) {
    this.volumen = v;
    if (this.master) this.master.gain.value = 0.5 * v;
  }

  /**
   * Música en bucle con 3 voces (bajo, arpegio y ruido blanco).
   * Cada perfil cambia tempo, acordes e instrumentos: 'minijuego' y uno por mundo.
   */
  iniciarMusica(perfil = 'minijuego') {
    if (this.musica && this.perfil === perfil) return;
    this.detenerMusica();
    if (this.musicaApagada) return;
    this.perfil = perfil;
    this.paso = 0;
    const bpm = (PERFILES_MUSICA[perfil] || PERFILES_MUSICA.minijuego).bpm;
    this.musica = setInterval(() => this._tick(), 60000 / bpm / 4);
  }

  detenerMusica() {
    clearInterval(this.musica);
    this.musica = null;
  }

  _tick() {
    const p = this.paso % 16;
    const compas = Math.floor(this.paso / 16) % 4;
    this.paso++;
    if (!this.listo) return;
    const pf = PERFILES_MUSICA[this.perfil] || PERFILES_MUSICA.minijuego;
    const t = this.ctx.currentTime + 0.02;
    const raiz = pf.raices[compas];
    const tercera = pf.terceras[compas];
    // 1) bajo rítmico
    if (p % 2 === 0) this.nota(pf.bajo, raiz + (p % 8 === 6 ? 12 : 0), t, 0.11, 0.3 * pf.vol);
    // 2) arpegio
    if (!pf.lento || p % 2 === 0) {
      const arpegio = [0, tercera, 7, 12, 7, tercera, 12, 7];
      this.nota(pf.arp, raiz + 24 + arpegio[p % 8], t, pf.lento ? 0.14 : 0.07, 0.06 * pf.vol);
    }
    // 3) percusión con ruido blanco
    if (p % 4 === 0) this.golpe(t, 0.09, 0.55 * pf.vol, 'lowpass', 160);
    if (p === 4 || p === 12) this.golpe(t, 0.12, 0.28 * pf.vol, 'bandpass', 1800);
    else if (p % 2 === 1 && !pf.lento) this.golpe(t, 0.03, 0.1 * pf.vol, 'highpass', 7000);
  }
}

/** Música: tempo, acordes (notas MIDI), terceras (3 menor / 4 mayor) e instrumentos. */
const PERFILES_MUSICA = {
  minijuego: { bpm: 160, raices: [45, 45, 41, 43], terceras: [3, 3, 4, 4], bajo: 'triangle', arp: 'square', vol: 1 },
  hielo: { bpm: 100, raices: [52, 48, 50, 47], terceras: [4, 4, 3, 3], bajo: 'sine', arp: 'triangle', vol: 0.7, lento: true },
  selva: { bpm: 116, raices: [50, 50, 45, 48], terceras: [3, 3, 4, 4], bajo: 'triangle', arp: 'sine', vol: 0.75 },
  lava: { bpm: 132, raices: [40, 40, 43, 38], terceras: [3, 3, 3, 4], bajo: 'sawtooth', arp: 'sawtooth', vol: 0.55 },
  neon: { bpm: 124, raices: [45, 41, 48, 43], terceras: [3, 4, 4, 4], bajo: 'square', arp: 'square', vol: 0.6 },
};

// 4. SpriteAnimator ----------------------------------------------------------------------
const PERSONAJES = Object.freeze([
  // color = color principal de su sprite · cuadros del atlas para cada estado
  { id: 'scrap', nombre: 'SCRAP-E', color: '#6b7a90', desc: 'ROBOT DE CHATARRA', idle: [0], mover: [1], victoria: [2] },
  { id: 'plasmo', nombre: 'PLASMO', color: '#a64dff', desc: 'ORBE DE PLASMA', idle: [0, 3], mover: [1, 4], victoria: [2, 5], flota: true },
  { id: 'astro', nombre: 'ASTRO-MAX', color: '#3fe0f0', desc: 'ASTRONAUTA', idle: [0], mover: [1], victoria: [2] },
  { id: 'nova', nombre: 'NOVA', color: '#e23cc8', desc: 'PILOTO JETPACK', idle: [0], mover: [1], victoria: [2] },
  { id: 'laika', nombre: 'LAIKA-X', color: '#7cc4f0', desc: 'PERRITA ROBOT', idle: [1], mover: [0], victoria: [2] },
  { id: 'zorblax', nombre: 'ZORBLAX', color: '#8cf03c', desc: 'BABOSA ALIEN', idle: [0, 4], mover: [2, 6], victoria: [3, 7] },
  { id: 'octo', nombre: 'OCTO-Z', color: '#e0353b', desc: 'PULPO CIBORG', idle: [0, 3], mover: [1, 4], victoria: [2, 5], flota: true },
  { id: 'zim', nombre: 'LIL-ZIM', color: '#4fd3c4', desc: 'ALIEN EN OVNI', idle: [0, 3], mover: [1, 4], victoria: [5], flota: true },
]);

/** Los sprites en pixel art están en js/Sprites.js (SpritesPixel), compartido con el celular. */
const HAY_SPRITES = typeof SpritesPixel !== 'undefined';


/**
 * Dibuja un personaje dentro de una caja de 100x100 unidades (el cuerpo mide 50x50).
 * `tam` es el tamaño en píxeles lógicos de esa caja. Estados: 'idle', 'victoria', 'derrota'.
 * Cuando existan PNG, solo hay que cambiar _cuerpo() por un drawImage.
 */
class SpriteAnimator {
  constructor(tipo) {
    this.def = PERSONAJES.find((p) => p.id === tipo) || PERSONAJES[0];
    this.tipo = this.def.id;
    this.estado = 'idle';
    this.t0 = Date.now();
    this.particulas = [];
    this.ultimaEmision = 0;
  }

  setEstado(estado) {
    if (this.estado === estado) return;
    this.estado = estado;
    this.t0 = Date.now();
    this.ultimaEmision = 0;
  }

  /** op.moviendo usa el cuadro de caminar; op.mirar = -1 voltea el sprite hacia la izquierda. */
  dibujar(ctx, x, y, tam = 40, ahora = Date.now(), op = {}) {
    this.op = op;
    const u = tam / 100;
    const t = ahora - this.t0;
    this._emitir(x, y, u, ahora);
    this._dibujarParticulas(ctx, ahora);
    ctx.save();
    ctx.translate(x, y);
    const r = this._transformar(ctx, u, t, ahora);
    if (r !== false) this._cuerpo(ctx, u, r === 'gris');
    ctx.restore();
  }

  /** Aplica la animación del estado actual. Devuelve false si ya dibujó, 'gris' para derrota genérica. */
  _transformar(ctx, u, t, ahora) {
    const sen = Math.sin;
    const pr = (dur) => Utils.clamp(t / dur, 0, 1);

    if (this.estado === 'idle') {
      switch (this.tipo) {
        case 'scrap': {                                                              // chispazo corto cada 1.8 s
          const c = (ahora + this.t0 % 900) % 1800;
          if (c < 160) ctx.translate(Math.round(Math.sin(c / 18)) * 1.5, 0);
          break;
        }
        case 'plasmo': { const k = 1 + 0.1 * sen(ahora / 180); ctx.scale(k, k); break; } // 0.9 a 1.1
        case 'astro': ctx.translate(0, 5 * sen(ahora / 350)); break;                       // flota 5px
        case 'laika': ctx.scale(1 + 0.1 * sen(ahora / 220), 1); break;                     // estira 10%
        case 'zorblax': {                                                                   // squash 400ms
          const k = sen(((ahora % 400) / 400) * Math.PI * 2);
          ctx.translate(0, 25 * u);
          ctx.scale(1 - 0.15 * k, 1 + 0.15 * k);
          ctx.translate(0, -25 * u);
          break;
        }
        case 'octo':                                                                         // péndulo
          ctx.translate(0, -40 * u);
          ctx.rotate(0.22 * sen(ahora / 380));
          ctx.translate(0, 40 * u);
          break;
        case 'zim':                                                                          // zig-zag
          ctx.translate(8 * Math.cos(ahora / 260), 0);
          ctx.rotate(-0.12 * sen(ahora / 260));
          break;
        default: break; // nova: sus partículas salen en _emitir
      }
      return true;
    }

    if (this.estado === 'victoria') {
      switch (this.tipo) {
        case 'scrap': ctx.rotate(Utils.easeOutCubic(Utils.clamp((t % 1100) / 500, 0, 1)) * Math.PI * 2); break; // 360° en 500 ms
        case 'plasmo': {
          const c = t % 1400;
          if (c < 700) {
            const p = c / 700;
            const k = Utils.lerp(1, 3, Utils.easeOutCubic(p));
            ctx.scale(k, k);
            ctx.globalAlpha *= 1 - p;
          } else {
            const k = Math.max(0.001, Utils.easeOutBack((c - 700) / 700));
            ctx.scale(k, k);
          }
          break;
        }
        case 'nova': { const p = Utils.clamp((t % 1200) / 600, 0, 1); ctx.scale(1, Math.cos(p * Math.PI * 2)); break; }
        case 'octo':
          ctx.translate(0, -40 * u);
          ctx.rotate(0.35 * sen(ahora / 150));
          ctx.translate(0, 40 * u);
          break;
        default: { const c = (t % 600) / 600; ctx.translate(0, -Math.abs(sen(c * Math.PI)) * 28 * u); } // saltito
      }
      return true;
    }

    // derrota
    switch (this.tipo) {
      case 'scrap': {                                           // se divide en 4 cuadrados
        const k = Utils.easeOutCubic(pr(500));
        const lado = 25 * u;
        if (HAY_SPRITES) {                                      // con sprite: 4 trozos del dibujo
          const img = SpritesPixel.obtener('scrap', 'idle', 0), T = SpritesPixel.TAM, lado2 = (76 * u) / 2;
          ctx.imageSmoothingEnabled = false;
          [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([cx, cy], i) => {
            ctx.save();
            ctx.translate((cx ? 1 : -1) * (lado2 / 2 + k * 20 * u), (cy ? 1 : -1) * (lado2 / 2 + k * 20 * u) + k * 12 * u - 10 * u);
            ctx.rotate(k * (i % 2 ? 0.9 : -0.9));
            ctx.drawImage(img, (cx * T) / 2, (cy * T) / 2, T / 2, T / 2, -lado2 / 2, -lado2 / 2, lado2, lado2);
            ctx.restore();
          });
          return false;
        }
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy], i) => {
          ctx.save();
          ctx.translate(dx * (12.5 * u + k * 20 * u), dy * (12.5 * u + k * 20 * u) + k * 12 * u);
          ctx.rotate(k * (i % 2 ? 0.9 : -0.9));
          ctx.fillStyle = this.def.color;
          ctx.fillRect(-lado / 2, -lado / 2, lado, lado);
          ctx.lineWidth = 2 * u;
          ctx.strokeStyle = PALETA.fondo;
          ctx.strokeRect(-lado / 2, -lado / 2, lado, lado);
          ctx.restore();
        });
        return false;
      }
      case 'astro': ctx.translate(0, -t * 0.3); ctx.rotate(t * 0.012); return true;  // gira y se va arriba
      case 'laika': {                                                                  // altura a la mitad
        const k = Utils.lerp(1, 0.5, Utils.easeOutCubic(pr(300)));
        ctx.translate(0, 15 * u);
        ctx.scale(1, k);
        ctx.translate(0, -15 * u);
        return true;
      }
      case 'zim': ctx.translate(0, 0.0009 * t * t); ctx.rotate(Math.min(t / 400, 1) * 0.6); return true; // cae
      default: {                                                                       // derrota genérica
        const k = Utils.easeOutCubic(pr(400));
        ctx.translate(0, 25 * u);
        ctx.scale(1 + 0.3 * k, 1 - 0.65 * k);
        ctx.translate(0, -25 * u);
        ctx.globalAlpha *= 1 - 0.5 * k;
        return 'gris';
      }
    }
  }

  _emitir(x, y, u, ahora) {
    // Nova (idle): 2 partículas rojas de 3x3 cada 100ms hacia abajo
    if (this.tipo === 'nova' && this.estado === 'idle' && ahora - this.ultimaEmision >= 100) {
      this.ultimaEmision = ahora;
      for (let i = 0; i < 2; i++) {
        this.particulas.push({ x: x + Utils.azar(-14, 14) * u, y: y + 25 * u, vx: Utils.azar(-0.01, 0.01), vy: Utils.azar(0.04, 0.08), nac: ahora, vida: 500, tam: 3, color: PALETA.laser, circulo: false });
      }
    }
    // Octo-Z (victoria): 10 círculos hacia afuera
    if (this.tipo === 'octo' && this.estado === 'victoria' && ahora - this.ultimaEmision >= 1000) {
      this.ultimaEmision = ahora;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.particulas.push({ x, y, vx: Math.cos(a) * 0.09, vy: Math.sin(a) * 0.09, nac: ahora, vida: 800, tam: Math.max(2, 7 * u), color: this.def.color, circulo: true });
      }
    }
  }

  _dibujarParticulas(ctx, ahora) {
    if (!this.particulas.length) return;
    this.particulas = this.particulas.filter((p) => ahora - p.nac < p.vida);
    ctx.save();
    for (const p of this.particulas) {
      const e = ahora - p.nac;
      ctx.globalAlpha = 1 - e / p.vida;
      ctx.fillStyle = p.color;
      const px = p.x + p.vx * e, py = p.y + p.vy * e;
      if (p.circulo) {
        ctx.beginPath();
        ctx.arc(px, py, p.tam / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(Math.round(px), Math.round(py), p.tam, p.tam);
      }
    }
    ctx.restore();
  }

  /** Formas geométricas de cada personaje (centradas en 0,0; cuerpo de 50x50 unidades). */
  /** Dibuja el cuadro de pixel art que toca (2 cuadros por estado). */
  _imagen(ctx, u, gris) {
    const moviendo = this.op && this.op.moviendo;
    const estado = this.estado === 'victoria' ? 'victoria' : moviendo ? 'mover' : 'idle';
    const cuadro = Math.floor(Date.now() / (moviendo ? 160 : estado === 'victoria' ? 300 : 500)) % 2;
    const img = SpritesPixel.obtener(this.tipo, estado, cuadro);
    const lado = 76 * u;
    ctx.save();
    if (this.op && this.op.mirar < 0) ctx.scale(-1, 1);
    if (gris) ctx.filter = 'grayscale(1) brightness(0.8)';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -lado / 2, -lado / 2 - (this.def.flota ? 0 : 10 * u), lado, lado);
    ctx.restore();
  }

  _cuerpo(ctx, u, gris) {
    if (HAY_SPRITES) { this._imagen(ctx, u, gris); return; }
    const color = gris ? '#5a606b' : this.def.color;
    const F = PALETA.fondo;
    const R = (x, y, w, h) => ctx.fillRect(x * u, y * u, w * u, h * u);
    const ojos = (y = -6, sep = 9, t = 6, c = F) => {
      ctx.fillStyle = c;
      R(-sep - t / 2, y - t / 2, t, t);
      R(sep - t / 2, y - t / 2, t, t);
    };
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = F;
    ctx.fillStyle = color;

    switch (this.tipo) {
      case 'scrap':
        R(-25, -25, 50, 50);
        ctx.strokeRect(-25 * u, -25 * u, 50 * u, 50 * u);
        ctx.fillStyle = '#c9ced6';
        R(-21, -21, 5, 5); R(16, -21, 5, 5); R(-21, 16, 5, 5); R(16, 16, 5, 5);
        ojos(-4, 9, 7);
        ctx.fillStyle = F; R(-10, 9, 20, 4);
        break;
      case 'plasmo':
        ctx.beginPath(); ctx.arc(0, 0, 25 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = PALETA.hielo; R(-15, -17, 6, 6);
        ojos(-2, 8, 6);
        break;
      case 'astro':
        R(-18, -25, 36, 50);
        ctx.lineWidth = 3 * u; ctx.strokeStyle = PALETA.cian;
        ctx.strokeRect(-18 * u, -25 * u, 36 * u, 50 * u);
        ctx.fillStyle = F; R(-12, -17, 24, 13);
        ctx.fillStyle = PALETA.cian; R(-8, -13, 4, 4); R(4, -13, 4, 4);
        ctx.fillStyle = PALETA.azul; R(-10, 4, 20, 6);
        break;
      case 'nova':
        ctx.fillStyle = gris ? color : PALETA.hielo;
        R(-20, -25, 40, 50);
        ctx.strokeRect(-20 * u, -25 * u, 40 * u, 50 * u);
        ctx.fillStyle = color; R(-20, -14, 40, 11); R(-20, 18, 40, 7);
        ojos(-8, 8, 5, PALETA.hielo);
        break;
      case 'laika':
        R(-25, -15, 50, 30);
        ctx.strokeRect(-25 * u, -15 * u, 50 * u, 30 * u);
        ctx.beginPath();                                    // orejas
        ctx.moveTo(8 * u, -15 * u); ctx.lineTo(13 * u, -26 * u); ctx.lineTo(18 * u, -15 * u); ctx.closePath();
        ctx.moveTo(16 * u, -15 * u); ctx.lineTo(21 * u, -24 * u); ctx.lineTo(25 * u, -15 * u); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = F; R(12, -7, 5, 5); R(21, 1, 5, 4);
        ctx.fillStyle = color; R(-31, -12, 7, 4);           // cola
        break;
      case 'zorblax':
        ctx.beginPath(); ctx.ellipse(0, 0, 22 * u, 25 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color; R(-2, -33, 4, 9); R(-4, -37, 8, 6);
        ctx.fillStyle = PALETA.hielo; ctx.beginPath(); ctx.arc(0, -5 * u, 9 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = F; R(-3, -8, 6, 6);
        break;
      case 'octo':
        ctx.fillStyle = color;
        R(-18, 12, 6, 13); R(-7, 14, 6, 12); R(2, 14, 6, 12); R(12, 12, 6, 13);
        ctx.beginPath(); ctx.arc(0, -3 * u, 22 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ojos(-4, 8, 6);
        ctx.fillStyle = PALETA.hielo; R(-12, -18, 5, 5);
        break;
      case 'zim':
        ctx.beginPath();
        ctx.moveTo(-12 * u, -20 * u); ctx.lineTo(12 * u, -20 * u);
        ctx.lineTo(25 * u, 20 * u); ctx.lineTo(-25 * u, 20 * u);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = PALETA.cian; ctx.beginPath(); ctx.arc(0, -6 * u, 8 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = F; R(-3, -8, 6, 4);
        ctx.fillStyle = PALETA.laser; R(-20, 20, 8, 4); R(12, 20, 8, 4);
        break;
      default: break;
    }
  }
}

/** Tecla dibujada (para los tutoriales). */
function tecla2(ctx, txt, x, y, color = PALETA.hielo) {
  const w = Math.max(24, txt.length * 6 + 12);
  ctx.fillStyle = PALETA.fondo;
  ctx.fillRect(x - w / 2 + 2, y - 7, w, 17);
  Utils.panel(ctx, x - w / 2, y - 9, w, 17, color, PALETA.fondo, 2);
  Utils.texto(ctx, txt, x, y, { tam: 5, color: PALETA.fondo });
}

/** Estrella de 5 puntas plana (para HUD y la estrella del tablero). */
function dibujarEstrellita(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = PALETA.fondo;
  ctx.lineWidth = Math.max(1, r / 5);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Burbuja de emote/reacción sobre un jugador: 0 risa, 1 corazón, 2 enojo, 3 aplauso, 4 triste. */
function dibujarBurbuja(ctx, j, x, y) {
  const b = j.burbuja;
  if (!b) return;
  const t = Date.now() - b.t0;
  if (t > 1800) { j.burbuja = null; return; }
  const k = Utils.easeOutBack(Utils.clamp(t / 250, 0, 1)) * (t > 1500 ? 1 - (t - 1500) / 300 : 1);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y - Math.min(t / 100, 4)));
  ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
  ctx.fillStyle = PALETA.hielo;
  ctx.strokeStyle = PALETA.fondo;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-10, 15); ctx.lineTo(-1, 10); ctx.fill();
  const R = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(px, py, w, h); };
  const F = PALETA.fondo;
  switch (b.tipo) {
    case 0: R(-6, -4, 2, 2, F); R(-7, -3, 1, 1, F); R(4, -4, 2, 2, F); R(6, -3, 1, 1, F); R(-5, 2, 10, 2, F); R(-4, 4, 8, 2, PALETA.rosa); break;   // risa
    case 1: R(-6, -5, 4, 3, PALETA.laser); R(2, -5, 4, 3, PALETA.laser); R(-7, -3, 14, 3, PALETA.laser); R(-5, 0, 10, 2, PALETA.laser); R(-3, 2, 6, 2, PALETA.laser); R(-1, 4, 2, 1, PALETA.laser); break;
    case 2: R(-6, -5, 4, 2, PALETA.laser); R(2, -5, 4, 2, PALETA.laser); R(-5, -2, 2, 2, F); R(3, -2, 2, 2, F); R(-4, 3, 8, 2, F); break;   // enojo
    case 3: R(-7, -6, 3, 8, PALETA.amarillo); R(4, -6, 3, 8, PALETA.amarillo); R(-1, -8, 2, 3, PALETA.amarillo); R(-1, 3, 2, 3, PALETA.amarillo); break; // aplauso
    default: R(-6, -3, 3, 1, F); R(3, -3, 3, 1, F); R(-5, -1, 2, 5, PALETA.cian); R(-3, 4, 6, 1, F); R(-4, 3, 1, 1, F); R(3, 3, 1, 1, F); break;   // triste
  }
  ctx.restore();
}

// 5. Entradas --------------------------------------------------------------------------------
/** Junta todas las fuentes de entrada (celulares por Socket.io, teclado y bots). */
class InputHub {
  constructor() {
    this.oyentes = {};
    this.socket = null;
    this.local = typeof io === 'undefined'; // sin servidor = demo con teclado
    this.alSolicitar = null;
    this.teclado = new TecladoLocal(this);
  }

  on(evento, fn) { (this.oyentes[evento] = this.oyentes[evento] || []).push(fn); }
  emitir(evento, datos) { (this.oyentes[evento] || []).forEach((fn) => fn(datos)); }
  pedirEntrada(datos) { return this.alSolicitar ? this.alSolicitar(datos) : { ok: false, error: 'Sin juego' }; }

  conectar() {
    if (this.local) {
      setTimeout(() => this.emitir('sala', { codigo: 'DEMO', url: null }), 0);
      return;
    }
    this.socket = io();
    this.socket.on('connect', () => {
      this.emitir('conexion', true);
      this.socket.emit('host:crear', (r) => this.emitir('sala', r));
    });
    this.socket.on('disconnect', () => this.emitir('conexion', false));
    this.socket.on('jugador:solicitud', (d, responder) => {
      const r = this.pedirEntrada({ id: d.id, nombre: d.nombre, remoto: true, token: d.token, reconectar: d.reconectar });
      if (typeof responder === 'function') responder(r);
    });
    this.socket.on('jugador:entro', (d) => this.emitir('entro', d));
    this.socket.on('jugador:salio', (d) => this.emitir('salir', d));
    this.socket.on('jugador:input', (d) => this.emitir('input', d));
  }

  enviarEstado(estado, datos) { if (this.socket) this.socket.emit('host:estado', { estado, datos }); }

  enviarA(id, evento, datos) {
    if (this.socket && !String(id).startsWith('local') && !String(id).startsWith('bot')) {
      this.socket.emit('host:aJugador', { id, evento, datos });
    }
  }

  bloquear(valor) { if (this.socket) this.socket.emit('host:bloquear', valor); }
}

/** Código físico de la tecla; si el navegador no lo manda, se deduce de e.key. */
const TECLAS_POR_LETRA = { ' ': 'Space', enter: 'Enter', escape: 'Escape', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight' };
function codigoTecla(e) {
  if (e.code && e.code !== 'Unidentified') return e.code;
  const k = String(e.key || '').toLowerCase();
  if (TECLAS_POR_LETRA[k]) return TECLAS_POR_LETRA[k];
  if (/^[a-zñ]$/.test(k)) return 'Key' + k.toUpperCase();
  if (/^[0-9]$/.test(k)) return 'Digit' + k;
  return k;
}

/**
 * Teclado del PC. Con 1 jugador: FLECHAS (o WASD) + ESPACIO (A) + B (B).
 * Con 2 jugadores: J1 = WASD + ESPACIO (A) + Q (B) · J2 = FLECHAS + ENTER (A) + SHIFT DERECHO (B).
 */
const TECLAS = {
  solo: { dirs: { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r' },
    A: ['Space', 'Enter'], B: ['KeyB'], emote: ['KeyE'] },
  j1: { dirs: { KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r' }, A: ['Space'], B: ['KeyQ'], emote: ['KeyE'] },
  j2: { dirs: { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r' }, A: ['Enter'], B: ['ShiftRight'], emote: ['Period'] },
};
/** Nombre de cada tecla para mostrar en pantalla, según si hay 1 o 2 jugadores en el teclado. */
function nombreTecla(id, accion, solo) {
  const t = {
    local1: solo ? { mover: 'FLECHAS', A: 'ESPACIO', B: 'B', AB: 'ESPACIO Y B' } : { mover: 'WASD', A: 'ESPACIO', B: 'Q', AB: 'ESPACIO Y Q' },
    local2: { mover: 'FLECHAS', A: 'ENTER', B: 'SHIFT DER.', AB: 'ENTER Y SHIFT' },
  };
  return (t[id] || t.local1)[accion];
}

class TecladoLocal {
  constructor(hub) {
    this.hub = hub;
    this.unirse = { Digit1: ['local1', 'TECLADO 1'], Digit2: ['local2', 'TECLADO 2'] };
    this.activos = new Set();
    this.dirs = { local1: new Set(), local2: new Set() };
    addEventListener('keydown', (e) => this._tecla(e, true));
    addEventListener('keyup', (e) => this._tecla(e, false));
    addEventListener('blur', () => this.activos.forEach((id) => { this.dirs[id].clear(); this._dir(id); }));
  }

  get solo() { return !this.activos.has('local2'); }
  mapa(id) { return id === 'local2' ? TECLAS.j2 : this.solo ? TECLAS.solo : TECLAS.j1; }

  /** ¿Esta tecla la está usando algún jugador del teclado? (así no hace dos cosas a la vez) */
  ocupa(code) {
    for (const id of this.activos) {
      const m = this.mapa(id);
      if (m.dirs[code] || m.A.includes(code) || m.B.includes(code) || m.emote.includes(code)) return true;
    }
    return false;
  }

  _tecla(e, abajo) {
    const code = codigoTecla(e);
    if (this.unirse[code]) {
      const [id, nombre] = this.unirse[code];
      if (abajo && !e.repeat && !this.activos.has(id)) {
        const r = this.hub.pedirEntrada({ id, nombre, remoto: false });
        if (r.ok) { this.activos.add(id); this.hub.emitir('entro', { id }); }
      }
      return;
    }
    for (const id of this.activos) {
      const m = this.mapa(id);
      if (m.dirs[code]) {
        if (abajo) this.dirs[id].add(m.dirs[code]); else this.dirs[id].delete(m.dirs[code]);
        this._dir(id);
      } else if ((m.A.includes(code) || m.B.includes(code)) && !e.repeat) {
        this.hub.emitir('input', { id, t: 'btn', b: m.A.includes(code) ? 'A' : 'B', d: abajo });
      } else if (m.emote.includes(code) && abajo && !e.repeat) {
        this.hub.emitir('input', { id, t: 'emote', e: Utils.entero(0, 3) });
      }
    }
  }

  _dir(id) {
    const d = this.dirs[id];
    this.hub.emitir('input', { id, t: 'dir', x: (d.has('r') ? 1 : 0) - (d.has('l') ? 1 : 0), y: (d.has('d') ? 1 : 0) - (d.has('u') ? 1 : 0) });
  }

  quitar(id) { this.activos.delete(id); if (this.dirs[id]) this.dirs[id].clear(); }
}

// 6. Transición de escena -------------------------------------------------------------------------
/** 'wipe' = cuadros negros desde la izquierda · 'fade' = fundido al azul base. Dura 800 ms. */
class Transicion {
  constructor() { this.activa = false; }

  iniciar(tipo, alCambiar) {
    this.tipo = tipo;
    this.t0 = Date.now();
    this.activa = true;
    this.cambiado = false;
    this.alCambiar = alCambiar;
  }

  actualizar() {
    if (!this.activa) return;
    const p = Utils.progreso(this.t0, TRANSICION_MS);
    if (!this.cambiado && p >= 0.5) { this.cambiado = true; this.alCambiar(); }
    if (p >= 1) this.activa = false;
  }

  dibujar(ctx) {
    if (!this.activa) return;
    const p = Utils.progreso(this.t0, TRANSICION_MS);
    if (this.tipo === 'fade') {
      ctx.save();
      ctx.globalAlpha = p < 0.5 ? Utils.easeOutCubic(p * 2) : 1 - Utils.easeOutCubic((p - 0.5) * 2);
      ctx.fillStyle = PALETA.azul;
      ctx.fillRect(0, 0, ANCHO, ALTO);
      ctx.restore();
      return;
    }
    const C = 40, cols = ANCHO / C, filas = ALTO / C;
    const cubriendo = p < 0.5;
    const q = Utils.easeOutCubic(cubriendo ? p * 2 : (p - 0.5) * 2);
    ctx.fillStyle = PALETA.fondo;
    for (let c = 0; c < cols; c++) {
      for (let f = 0; f < filas; f++) {
        const umbral = (c / cols) * 0.7 + ((f * 3 + c) % 4) * 0.025;
        let k = Utils.clamp((q - umbral) / 0.22, 0, 1);
        if (!cubriendo) k = 1 - k;
        if (k <= 0) continue;
        if (k >= 1) { ctx.fillRect(c * C, f * C, C + 1, C + 1); continue; }
        const s = Math.ceil(C * k);
        ctx.fillRect(c * C + (C - s) / 2, f * C + (C - s) / 2, s, s);
      }
    }
  }
}

// 7. Componentes de UI --------------------------------------------------------------------------
class Boton {
  constructor(texto, x, y, w, h, accion, color = PALETA.cian) {
    Object.assign(this, { texto, x, y, w, h, accion, color });
    this.escala = 1;
    this.hover = false;
    this.habilitado = true;
    this.borde = 2;
  }

  contiene(px, py) { return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h; }

  dibujar(ctx, dx = 0, dy = 0, alfa = 1) {
    const activo = this.hover && this.habilitado;
    this.borde = Utils.lerp(this.borde, activo ? 4 : 2, 0.3);   // hover: el borde crece a 4px
    this.escala = Utils.lerp(this.escala, activo ? 1.06 : 1, 0.25);
    ctx.save();
    ctx.globalAlpha *= alfa * (this.habilitado ? 1 : 0.4);
    ctx.translate(this.x + dx + this.w / 2, this.y + dy + this.h / 2);
    ctx.scale(this.escala, this.escala);
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(-this.w / 2 + 3, -this.h / 2 + 3, this.w, this.h);             // sombra plana
    Utils.panel(ctx, -this.w / 2, -this.h / 2, this.w, this.h, this.color, activo ? PALETA.hielo : PALETA.fondo, this.borde);
    Utils.texto(ctx, this.texto, 0, 1, { tam: 8, color: PALETA.fondo });
    ctx.restore();
  }
}

/** Lista de botones navegable con ratón y con teclado. */
class Menu {
  constructor(botones, horizontal = false, sel = 0) {
    this.botones = botones;
    this.horizontal = horizontal;
    this.sel = sel;
    this.marcar();
  }

  marcar() { this.botones.forEach((b, i) => { b.hover = i === this.sel; }); }

  mover(px, py) {
    const i = this.botones.findIndex((b) => b.contiene(px, py));
    if (i >= 0 && i !== this.sel) { this.sel = i; this.marcar(); }
  }

  click(px, py, audio) {
    const b = this.botones.find((bt) => bt.contiene(px, py));
    if (b && b.habilitado) { audio.blip(); b.accion(); return true; }
    return false;
  }

  tecla(e, audio) {
    const [sig, ant] = this.horizontal ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    const n = this.botones.length;
    if (e.code === sig || e.code === ant) {
      this.sel = (this.sel + (e.code === sig ? 1 : -1) + n) % n;
      this.marcar();
      audio.tono('square', 660, 660, 0.03, 0.08);
      return true;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      const b = this.botones[this.sel];
      if (b && b.habilitado) { audio.blip(); b.accion(); }
      return true;
    }
    return false;
  }
}

/** Ventana emergente con aparición Ease-Out-Back (overshoot). */
class Ventana {
  constructor(titulo, lineas) {
    this.titulo = titulo;
    this.lineas = lineas;
    this.t0 = Date.now();
    this.cerrando = false;
  }

  cerrar() { if (!this.cerrando) { this.cerrando = true; this.tc = Date.now(); } }
  get terminada() { return this.cerrando && Date.now() - this.tc > 260; }

  dibujar(ctx) {
    let k = Utils.easeOutBack(Utils.progreso(this.t0, 500));
    let fondo = Utils.progreso(this.t0, 300);
    if (this.cerrando) {
      const c = Utils.easeOutCubic(Utils.progreso(this.tc, 250));
      k *= 1 - c;
      fondo *= 1 - c;
    }
    ctx.save();
    ctx.globalAlpha = 0.75 * fondo;
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.globalAlpha = 1;
    ctx.translate(ANCHO / 2, ALTO / 2);
    ctx.scale(Math.max(0.001, k), Math.max(0.001, k));
    const w = 460, h = 40 + this.lineas.length * 20 + 40;
    Utils.panel(ctx, -w / 2, -h / 2, w, h, PALETA.fondo, PALETA.cian, 3);
    Utils.texto(ctx, this.titulo, 0, -h / 2 + 22, { tam: 12, color: PALETA.cian });
    this.lineas.forEach((l, i) => Utils.texto(ctx, l, 0, -h / 2 + 52 + i * 20, { tam: 7 }));
    Utils.texto(ctx, 'ENTER O CLIC PARA CERRAR', 0, h / 2 - 16, { tam: 6, color: PALETA.cian });
    ctx.restore();
  }
}

/** Ventana "¿Cómo quieres jugar?": solo contra bots, 2 en el mismo PC o con celulares. */
class VentanaModo extends Ventana {
  constructor(gm) {
    super('¿CÓMO QUIERES JUGAR?', []);
    this.gm = gm;
    this.bots = 3;
    const w = 300, h = 26, x = (ANCHO - w) / 2;
    this.bSolo = new Boton('PRUEBA CON BOTS', x, 78, w, h, () => this.elegir('solo'), PALETA.verde);
    this.bCel = new Boton('MULTIJUGADOR', x, 128, w, h, () => this.elegir('celulares'), PALETA.rosa);
    this.bPc = new Boton('TODOS EN UNA PANTALLA', x, 178, w, h, () => this.elegir('pc'), PALETA.amarillo);
    this.bBots = new Boton('', x + 50, 232, w - 100, h, () => this.cambiarBots(1), PALETA.cian);
    this.bVolver = new Boton('VOLVER', (ANCHO - 120) / 2, 284, 120, 22, () => this.cerrar(), PALETA.azul);
    this.menu = new Menu([this.bSolo, this.bCel, this.bPc, this.bBots, this.bVolver]);
    this.cambiarBots(0);
  }

  cambiarBots(d) {
    this.bots = ((this.bots - 1 + d + 7) % 7) + 1;   // de 1 a 7
    this.bBots.texto = `< BOTS: ${this.bots} >`;
  }

  elegir(modo) {
    if (this.cerrando) return;
    if (modo === 'celulares' && this.gm.hub.local) {
      this.gm.aviso('ESTA DEMO NO TIENE SERVIDOR: USA npm start O LOS OTROS MODOS');
      return;
    }
    this.gm.iniciarModo(modo, this.bots);
  }

  onTecla(e) {
    if (e.code === 'Escape') { this.cerrar(); return; }
    if (this.menu.botones[this.menu.sel] === this.bBots && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      this.cambiarBots(e.code === 'ArrowRight' ? 1 : -1);
      this.gm.audio.tono('square', 660, 660, 0.03, 0.08);
      return;
    }
    this.menu.tecla(e, this.gm.audio);
  }

  dibujar(ctx) {
    let k = Utils.easeOutBack(Utils.progreso(this.t0, 500));
    let fondo = Utils.progreso(this.t0, 300);
    if (this.cerrando) {
      const c = Utils.easeOutCubic(Utils.progreso(this.tc, 250));
      k *= 1 - c;
      fondo *= 1 - c;
    }
    ctx.save();
    ctx.globalAlpha = 0.7 * fondo;
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.globalAlpha = 1;
    ctx.translate(ANCHO / 2, ALTO / 2);
    ctx.scale(Math.max(0.001, k), Math.max(0.001, k));
    ctx.translate(-ANCHO / 2, -ALTO / 2);
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(146, 34, 360, 292);
    Utils.panel(ctx, 140, 28, 360, 292, PALETA.morado, PALETA.hielo, 3);
    Utils.texto(ctx, this.titulo, ANCHO / 2, 52, { tam: 11, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 4 });
    const subs = [
      [this.bSolo, 'ENTRENA TÚ SOLO CONTRA LA MÁQUINA (TECLADO O TÁCTIL)'],
      [this.bCel, this.gm.hub.local ? 'CADA UNO CON SU CELULAR · NECESITA npm start' : 'CADA UNO JUEGA DESDE SU CELULAR CON UN CÓDIGO'],
      [this.bPc, 'J1: WASD + ESPACIO   ·   J2: FLECHAS + ENTER'],
      [this.bBots, 'CANTIDAD DE BOTS (CLIC O FLECHAS)'],
    ];
    this.menu.botones.forEach((b) => b.dibujar(ctx));
    subs.forEach(([b, t]) => Utils.texto(ctx, t, ANCHO / 2, b.y + b.h + 10, { tam: 5, color: PALETA.hielo }));
    ctx.restore();
  }
}

/** Ajustes de la partida: se guardan en el navegador. */
class VentanaAjustes extends Ventana {
  constructor(gm) {
    super('AJUSTES', []);
    this.gm = gm;
    const w = 300, h = 22, x = (ANCHO - w) / 2;
    const a = gm.ajustes;
    const opciones = [
      ['rondas', 'RONDAS', [3, 5, 10], (v) => String(v)],
      ['bots', 'NIVEL DE BOTS', ['FÁCIL', 'NORMAL', 'DIFÍCIL'], (v) => v],
      ['especiales', 'CASILLAS ESPECIALES', [true, false], (v) => (v ? 'SÍ' : 'NO')],
      ['rapido', 'VELOCIDAD', [false, true], (v) => (v ? 'RÁPIDA' : 'NORMAL')],
      ['volumen', 'VOLUMEN', [0, 0.25, 0.5, 0.75, 1], (v) => `${Math.round(v * 100)}%`],
      ['musica', 'MÚSICA', [true, false], (v) => (v ? 'SÍ' : 'NO')],
      ['tutoriales', 'TUTORIALES', [true, false], (v) => (v ? 'SÍ' : 'NO')],
    ];
    const colores = [PALETA.verde, PALETA.cian, PALETA.amarillo, PALETA.rosa, PALETA.naranja, PALETA.morado, PALETA.verde];
    const botones = opciones.map(([clave, nombre, valores, txt], i) => {
      const b = new Boton('', x, 58 + i * 28, w, h, () => {
        const k = valores.indexOf(a[clave]);
        a[clave] = valores[(k + 1) % valores.length];
        b.texto = `${nombre}: ${txt(a[clave])}`;
        gm.guardarAjustes();
      }, colores[i]);
      b.texto = `${nombre}: ${txt(a[clave])}`;
      return b;
    });
    botones.push(new Boton('LISTO', (ANCHO - 120) / 2, 262, 120, 22, () => this.cerrar(), PALETA.azul));
    this.menu = new Menu(botones);
  }

  onTecla(e) {
    if (e.code === 'Escape') { this.cerrar(); return; }
    this.menu.tecla(e, this.gm.audio);
  }

  dibujar(ctx) {
    let k = Utils.easeOutBack(Utils.progreso(this.t0, 500));
    if (this.cerrando) k *= 1 - Utils.easeOutCubic(Utils.progreso(this.tc, 250));
    ctx.save();
    ctx.globalAlpha = 0.7 * Math.min(1, k);
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.globalAlpha = 1;
    ctx.translate(ANCHO / 2, ALTO / 2);
    ctx.scale(Math.max(0.001, k), Math.max(0.001, k));
    ctx.translate(-ANCHO / 2, -ALTO / 2);
    Utils.panel(ctx, 150, 22, 340, 280, PALETA.fondo, PALETA.cian, 3);
    Utils.texto(ctx, this.titulo, ANCHO / 2, 42, { tam: 12, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 4 });
    this.menu.botones.forEach((b) => b.dibujar(ctx));
    Utils.texto(ctx, 'CLIC O ENTER PARA CAMBIAR CADA OPCIÓN', ANCHO / 2, 294, { tam: 5, color: PALETA.hielo });
    ctx.restore();
  }
}

/** Menú de pausa: seguir, ajustes o salir al menú (con confirmación). */
class VentanaPausa extends Ventana {
  constructor(gm) {
    super('PAUSA', []);
    this.gm = gm;
    this.confirmar = false;
    this.sub = null;
    this._botones();
  }

  _botones() {
    const gm = this.gm, w = 220, h = 24, x = (ANCHO - w) / 2;
    this.menu = this.confirmar
      ? new Menu([
        new Boton('NO, SEGUIR JUGANDO', x, 168, w, h, () => { this.confirmar = false; this._botones(); }, PALETA.verde),
        new Boton('SÍ, SALIR AL MENÚ', x, 202, w, h, () => gm.salirAlMenu(), PALETA.rosa),
      ])
      : new Menu([
        new Boton('SEGUIR JUGANDO', x, 134, w, h, () => gm.reanudar(), PALETA.verde),
        new Boton('AJUSTES', x, 168, w, h, () => { this.sub = new VentanaAjustes(gm); }, PALETA.amarillo),
        new Boton('SALIR AL MENÚ', x, 202, w, h, () => { this.confirmar = true; this._botones(); }, PALETA.rosa),
      ]);
  }

  onTecla(e) {
    if (this.sub) { this.sub.onTecla(e); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.confirmar) { this.confirmar = false; this._botones(); } else this.gm.reanudar();
      return;
    }
    this.menu.tecla(e, this.gm.audio);
  }

  onClick(x, y) {
    if (this.sub) { if (!this.sub.cerrando) this.sub.menu.click(x, y, this.gm.audio); return; }
    this.menu.click(x, y, this.gm.audio);
  }

  onMover(x, y) { (this.sub || this).menu.mover(x, y); }

  dibujar(ctx) {
    if (this.sub && this.sub.terminada) this.sub = null;
    const k = Utils.easeOutBack(Utils.progreso(this.t0, 400));
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.globalAlpha = 1;
    ctx.translate(ANCHO / 2, ALTO / 2);
    ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
    ctx.translate(-ANCHO / 2, -ALTO / 2);
    Utils.panel(ctx, 190, 84, 260, 186, PALETA.fondo, this.confirmar ? PALETA.rosa : PALETA.cian, 3);
    Utils.texto(ctx, this.confirmar ? '¿SALIR DEL JUEGO?' : 'PAUSA', ANCHO / 2, 106, { tam: this.confirmar ? 9 : 14, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 4 });
    if (this.confirmar) Utils.texto(ctx, 'SE PIERDE LA PARTIDA ACTUAL', ANCHO / 2, 134, { tam: 6, color: PALETA.hielo });
    this.menu.botones.forEach((b) => b.dibujar(ctx));
    Utils.texto(ctx, 'P O ESC: SEGUIR', ANCHO / 2, 254, { tam: 5, color: PALETA.cian });
    ctx.restore();
    if (this.sub) this.sub.dibujar(ctx);
  }
}

/** Cruceta y botones A/B dibujados en el canvas para jugar con el dedo (jugador "local1"). */
class ControlesTactiles {
  constructor(gm) {
    this.gm = gm;
    this.activo = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    this.dedos = new Map();                       // pointerId -> { zona, p }
    this.dpad = { x: 76, y: 284, r: 52 };
    this.bA = { x: 580, y: 268, r: 28 };
    this.bB = { x: 518, y: 314, r: 22 };
    this.dir = { x: 0, y: 0 };
  }

  get visible() {
    const j = this.gm.jugadores.find((p) => p.id === 'local1');
    return this.activo && !!j && this.gm.estadoId === ESTADO.MINIJUEGO && !this.gm.transicion.activa;
  }

  _zona(p) {
    const d = (c) => Math.hypot(p.x - c.x, p.y - c.y);
    if (d(this.dpad) <= this.dpad.r * 1.35) return 'dpad';
    if (d(this.bA) <= this.bA.r * 1.4) return 'A';
    if (d(this.bB) <= this.bB.r * 1.4) return 'B';
    return null;
  }

  tomar(id, p) {
    if (!this.visible) return false;
    const zona = this._zona(p);
    if (!zona) return false;
    this.dedos.set(id, { zona, p });
    if (zona === 'dpad') this._enviarDir(); else this._boton(zona, true);
    if (navigator.vibrate) navigator.vibrate(50);
    return true;
  }

  mover(id, p) {
    const d = this.dedos.get(id);
    if (!d) return false;
    d.p = p;
    if (d.zona === 'dpad') this._enviarDir();
    return true;
  }

  soltar(id) {
    const d = this.dedos.get(id);
    if (!d) return;
    this.dedos.delete(id);
    if (d.zona === 'dpad') this._enviarDir(); else this._boton(d.zona, false);
  }

  _enviarDir() {
    let x = 0, y = 0;
    for (const d of this.dedos.values()) {
      if (d.zona !== 'dpad') continue;
      const dx = d.p.x - this.dpad.x, dy = d.p.y - this.dpad.y;
      const L = Math.hypot(dx, dy);
      if (L > 8) {
        x = Math.abs(dx / L) > 0.38 ? Math.sign(dx) : 0;
        y = Math.abs(dy / L) > 0.38 ? Math.sign(dy) : 0;
      }
    }
    this.dir = { x, y };
    this.gm.hub.emitir('input', { id: 'local1', t: 'dir', x, y });
  }

  _boton(b, d) { this.gm.hub.emitir('input', { id: 'local1', t: 'btn', b, d }); }

  _pulsado(zona) { return [...this.dedos.values()].some((d) => d.zona === zona); }

  dibujar(ctx) {
    if (!this.visible) {
      if (this.dedos.size) { [...this.dedos.keys()].forEach((id) => this.soltar(id)); }
      return;
    }
    const { x, y, r } = this.dpad;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = PALETA.fondo;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = PALETA.cian; ctx.stroke();
    const flecha = (ang, activa) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = activa ? PALETA.hielo : PALETA.cian;
      ctx.beginPath(); ctx.moveTo(0, -r + 8); ctx.lineTo(12, -r + 24); ctx.lineTo(-12, -r + 24); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    flecha(0, this.dir.y < 0); flecha(Math.PI / 2, this.dir.x > 0); flecha(Math.PI, this.dir.y > 0); flecha(-Math.PI / 2, this.dir.x < 0);
    ctx.fillStyle = PALETA.azul;
    ctx.beginPath(); ctx.arc(x + this.dir.x * 14, y + this.dir.y * 14, 12, 0, Math.PI * 2); ctx.fill();
    [[this.bA, 'A', PALETA.amarillo], [this.bB, 'B', PALETA.rosa]].forEach(([b, t, c]) => {
      const p = this._pulsado(t);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(p ? 0.9 : 1, p ? 0.9 : 1);
      ctx.fillStyle = p ? PALETA.hielo : c;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = PALETA.fondo; ctx.stroke();
      Utils.texto(ctx, t, 0, 1, { tam: 12, color: PALETA.fondo });
      ctx.restore();
    });
    ctx.restore();
  }
}

// 8. Estados ------------------------------------------------------------------------------------------
/* Cada estado puede tener: entrar, salir, actualizar (60 veces por segundo), dibujar,
   onMover, onClick, onTecla, onBoton(jugador, 'A'|'B'), alSalir(jugador) y datosMando(). */

/* ---------- State 0: Título ---------- */
class EstadoTitulo {
  constructor(gm) {
    this.gm = gm;
    this.capa = document.createElement('canvas');
    this.capa.width = ANCHO;
    this.capa.height = 130;
    if (document.fonts && document.fonts.load) {
      document.fonts.load(`40px "Press Start 2P"`).then(() => this._pintarTitulo()).catch(() => {});
    }
  }

  entrar() {
    const gm = this.gm;
    this.t0 = Date.now();
    this.proxGlitch = this.t0 + 3000;
    this.glitchHasta = 0;
    this.cortes = [];
    this.ventana = null;
    const w = 180, h = 22, x = (ANCHO - w) / 2;
    const bAjustes = new Boton('AJUSTES', x, 0, w, h, () => { this.ventana = new VentanaAjustes(gm); }, PALETA.amarillo);
    const bRecords = new Boton('RÉCORDS', x, 0, w, h, () => {
      const r = gm.records;
      const top = Object.entries(r.victorias).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${n}: ${v}`).join('  ·  ') || 'AÚN NADIE';
      this.ventana = new Ventana('RÉCORDS', [
        `PARTIDAS JUGADAS: ${r.partidas}`,
        `MÁS GANADOR: ${top}`,
        `MEJOR TIEMPO EN LÁSER: ${(r.mejorLaser / 60).toFixed(1)} S`,
        `MÁS ESTRELLAS EN UNA PARTIDA: ${r.maxEstrellas}`,
      ]);
    }, PALETA.morado);
    const botones = [
      new Boton('JUGAR', x, 0, w, h, () => { this.ventana = new VentanaModo(gm); }, PALETA.verde),
      new Boton('CÓMO JUGAR', x, 0, w, h, () => {
        this.ventana = new Ventana('CÓMO JUGAR', [
          '1. ABRE EL MANDO EN TU CELULAR',
          '2. ESCRIBE EL CÓDIGO DE LA SALA',
          '3. CON 1 JUGADOR: FLECHAS + ESPACIO + B',
          '4. SOBREVIVE A LOS LÁSERES DEL MINIJUEGO',
          '5. COMPRA ESTRELLAS: GANA QUIEN TENGA MÁS',
        ]);
      }, PALETA.cian),
      bAjustes,
      bRecords,
      new Boton('CRÉDITOS', x, 0, w, h, () => {
        this.ventana = new Ventana('CRÉDITOS', [
          'NEBULA PARTY v1.0',
          'IDEA Y DISEÑO: SANTISARM',
          'INGENIERÍA MULTIMEDIA · USB CÚCUTA',
          'CANVAS · WEB AUDIO · SOCKET.IO',
        ]);
      }, PALETA.rosa),
    ];
    botones.forEach((b, i) => { b.y = 188 + i * 28; });
    this.menu = new Menu(botones);
    this._pintarTitulo();
  }


  /** Título "3D isométrico": capas extruidas en azul + frente hielo con borde cian. */
  _pintarTitulo() {
    const c = this.capa.getContext('2d');
    c.clearRect(0, 0, ANCHO, 130);
    c.save();
    c.translate(ANCHO / 2, 60);
    c.transform(1, -0.08, 0.25, 1, 0, 0); // inclinación isométrica
    c.font = `40px ${FUENTE}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const [txt, yy] of [['NEBULA', -24], ['PARTY', 26]]) {
      for (let d = 8; d >= 1; d--) {
        c.fillStyle = PALETA.azul;
        c.fillText(txt, d, yy + d);
      }
      c.lineWidth = 2;
      c.strokeStyle = PALETA.cian;
      c.strokeText(txt, 8, yy + 8);
      c.lineJoin = 'round';
      c.lineWidth = 5;
      c.strokeText(txt, 0, yy);
      c.fillStyle = PALETA.hielo;
      c.fillText(txt, 0, yy);
    }
    c.restore();
  }

  actualizar() {
    const ahora = Date.now();
    if (ahora >= this.proxGlitch) {             // glitch cada 3 segundos
      this.glitchHasta = ahora + 220;
      this.proxGlitch = ahora + 3000;
    }
    if (ahora < this.glitchHasta && (!this.ultimoCorte || ahora - this.ultimoCorte > 40)) {
      this.ultimoCorte = ahora;
      this.cortes = [];
      for (let y = 0; y < 130; y += 6) this.cortes.push({ y, dx: Math.random() < 0.5 ? Utils.azar(-16, 16) : 0 });
    }
    if (this.ventana && this.ventana.terminada) this.ventana = null;
  }

  dibujar(ctx) {
    const ahora = Date.now();
    const e = Utils.easeOutCubic(Utils.progreso(this.t0, TRANSICION_MS));
    const yT = Utils.lerp(-140, 22, e);
    if (ahora < this.glitchHasta) {
      for (const c of this.cortes) {
        ctx.drawImage(this.capa, 0, c.y, ANCHO, 6, c.dx, yT + c.y, ANCHO, 6);
        if (c.dx) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.drawImage(this.capa, 0, c.y, ANCHO, 6, -c.dx * 0.5, yT + c.y, ANCHO, 6);
          ctx.restore();
        }
      }
    } else {
      ctx.drawImage(this.capa, 0, yT);
    }
    Utils.texto(ctx, 'PARTY GAME GALÁCTICO · PC + CELULARES', ANCHO / 2, 168, { tam: 7, color: PALETA.amarillo, borde: PALETA.fondo, alfa: e });

    // botones: entran deslizándose (Ease-Out-Cubic, 800 ms, escalonados)
    this.menu.botones.forEach((b, i) => {
      const p = Utils.easeOutCubic(Utils.progreso(this.t0 + i * 80, TRANSICION_MS));
      b.dibujar(ctx, Utils.lerp(-ANCHO, 0, p), 0, p);
    });
    Utils.texto(ctx, 'FLECHAS PARA MOVERTE  ·  ENTER PARA ELEGIR  ·  O USA EL RATÓN', ANCHO / 2, 342, { tam: 6, color: PALETA.hielo, alfa: 0.7 });
    if (this.ventana) this.ventana.dibujar(ctx);
  }

  onMover(x, y) {
    if (this.ventana) { if (this.ventana.menu) this.ventana.menu.mover(x, y); return; }
    this.menu.mover(x, y);
  }

  onClick(x, y) {
    if (this.ventana) {
      if (!this.ventana.menu) this.ventana.cerrar();
      else if (!this.ventana.cerrando) this.ventana.menu.click(x, y, this.gm.audio);
      return;
    }
    this.menu.click(x, y, this.gm.audio);
  }

  onTecla(e) {
    if (this.ventana && this.ventana.onTecla) { this.ventana.onTecla(e); return; }
    if (this.ventana) {
      if (['Enter', 'Escape', 'Space'].includes(e.code)) { this.gm.audio.blip(); this.ventana.cerrar(); }
      return;
    }
    this.menu.tecla(e, this.gm.audio);
  }
}

/* ---------- State 1: Lobby = Elegir personaje ---------- */
class EstadoLobby {
  constructor(gm) {
    this.gm = gm;
    this.previas = PERSONAJES.map((p) => new SpriteAnimator(p.id));
    this.coloresCursor = [PALETA.amarillo, PALETA.rosa, PALETA.verde, PALETA.cian, PALETA.naranja, PALETA.hielo, PALETA.morado, PALETA.azul];
  }

  entrar() {
    const gm = this.gm;
    this.t0 = Date.now();
    this.cuenta = 0;
    this.fase = 'personajes';                       // 'personajes' y luego 'mundo'
    this.selMundo = gm.mundo || 0;
    gm.hub.bloquear(false);
    gm.reiniciarPartida();
    if ((gm.modo === 'solo' || gm.modo === 'pc') && !gm.jugadores.length) {     // llena la sala según el modo
      gm.unirLocal('local1', gm.modo === 'solo' ? 'TÚ' : 'JUGADOR 1');
      if (gm.modo === 'pc') gm.unirLocal('local2', 'JUGADOR 2');
      for (let i = 0; i < gm.botsPendientes; i++) gm.agregarBot(true);
    }
    gm.jugadores.forEach((j) => { j.listo = j.esBot; j.sel = j.personaje; });
    const y = 320, h = 22;
    this.bMenos = new Boton('- BOT', 96, y, 84, h, () => this.quitarBot(), PALETA.cian);
    this.bMas = new Boton('+ BOT', 190, y, 84, h, () => gm.agregarBot(), PALETA.cian);
    this.bEmpezar = new Boton('SIGUIENTE', 290, y, 130, h, () => this.irAMundos(), PALETA.verde);
    this.bVolver = new Boton('VOLVER', 436, y, 100, h, () => gm.cambiarEstado(ESTADO.TITULO), PALETA.rosa);
    this.menu = new Menu([this.bMenos, this.bMas, this.bEmpezar, this.bVolver], true, 2);
    this.menuMundo = new Menu([
      new Boton('< ATRÁS', 120, 314, 110, 24, () => this.atras(), PALETA.rosa),
      new Boton('AL AZAR', 245, 314, 110, 24, () => this.elegirMundo(Utils.entero(0, MUNDOS.length - 1)), PALETA.cian),
      new Boton('¡JUGAR AQUÍ!', 370, 314, 150, 24, () => this.jugar(), PALETA.verde),
    ], true, 2);
  }

  datosMando() { return { faseLobby: this.fase, mundo: MUNDOS[this.selMundo].nombre }; }

  /** Paso 2: elegir el mundo. Quien no confirmó personaje se queda con el que tenía marcado. */
  irAMundos() {
    const gm = this.gm;
    if (!gm.jugadores.length) { gm.aviso('PRIMERO DEBE UNIRSE ALGUIEN'); return; }
    this.humanos.forEach((j) => {
      if (j.listo) return;
      if (this.ocupado(j.sel, j)) j.sel = this._primerLibre(j);
      gm.setPersonaje(j, j.sel);
      j.listo = true;
    });
    this.cuenta = 0;
    this.fase = 'mundo';
    this.t1 = Date.now();
    gm.audio.exito();
    gm.difundir();
  }

  atras() {
    this.fase = 'personajes';
    this.cuenta = 0;
    this.humanos.forEach((j) => { j.listo = false; });
    this.gm.difundir();
  }

  elegirMundo(i) {
    this.selMundo = (i + MUNDOS.length) % MUNDOS.length;
    this.gm.audio.tono('square', 660, 880, 0.05, 0.1);
    this.gm.difundir();
  }

  jugar() {
    const gm = this.gm;
    gm.mundo = this.selMundo;
    gm.repartirBots();
    gm.hub.bloquear(true);
    gm.cambiarEstado(ESTADO.TABLERO);
  }

  /** En el paso del mundo eligen los jugadores del PC o el líder desde su celular. */
  _puedeElegirMundo(j) { return !j.esBot && (!j.remoto || j.id === this.gm.liderId()); }

  _cartaMundo(px, py) {
    const w = 148, gap = 6, x0 = (ANCHO - (4 * w + 3 * gap)) / 2;
    for (let i = 0; i < MUNDOS.length; i++) {
      const x = x0 + i * (w + gap);
      if (px >= x && px <= x + w && py >= 44 && py <= 300) return i;
    }
    return -1;
  }

  _dibujarMundos(ctx) {
    const ahora = Date.now();
    const e = Utils.easeOutCubic(Utils.progreso(this.t1, TRANSICION_MS));
    const tablero = this.gm.estados[ESTADO.TABLERO];
    Utils.texto(ctx, 'ELIGE EL MUNDO', ANCHO / 2, Utils.lerp(-20, 16, e), { tam: 13, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 5 });
    Utils.texto(ctx, 'FLECHAS: ELEGIR MUNDO  ·  ESPACIO: ¡JUGAR!  ·  B: ATRÁS  ·  O HAZ CLIC', ANCHO / 2, 32, { tam: 5, color: PALETA.hielo, alfa: e });
    const w = 148, h = 252, gap = 6, x0 = (ANCHO - (4 * w + 3 * gap)) / 2;
    MUNDOS.forEach((m, i) => {
      const sel = i === this.selMundo;
      const p = Utils.easeOutBack(Utils.progreso(this.t1 + i * 70, 600));
      const x = x0 + i * (w + gap), y = 46 + (sel ? -4 : 0);
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(Math.max(0.01, p), Math.max(0.01, p));
      ctx.translate(-(x + w / 2), -(y + h / 2));
      Utils.panel(ctx, x, y, w, h, PALETA.fondo, sel ? PALETA.amarillo : m.borde, sel ? 4 : 2);
      ctx.globalAlpha = sel ? 0.45 : 0.22;
      ctx.fillStyle = m.cielo;
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.globalAlpha = 1;
      Utils.texto(ctx, m.nombre, x + w / 2, y + 18, { tam: 7, color: m.borde, borde: PALETA.fondo, grosor: 4 });
      tablero.dibujarMiniatura(ctx, i, x + w / 2, y + 100 + (sel ? Math.sin(ahora / 400) * 3 : 0), w - 18, ahora);
      Utils.texto(ctx, `${tablero.mapas[i].casillas.length} CASILLAS`, x + w / 2, y + 168, { tam: 5, color: PALETA.hielo });
      // casilla especial del mundo
      const cx = x + w / 2, cy = y + 196, info = CASILLAS[m.especial];
      ctx.fillStyle = info.color; ctx.strokeStyle = PALETA.fondo; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 20, cy); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 20, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
      Utils.texto(ctx, info.marca, cx, cy + 1, { tam: 7, color: info.tinta });
      Utils.texto(ctx, m.desc[0], cx, y + 220, { tam: 5, color: PALETA.amarillo });
      Utils.texto(ctx, m.desc[1], cx, y + 232, { tam: 5, color: PALETA.hielo });
      ctx.restore();
    });
    this.menuMundo.botones.forEach((b) => b.dibujar(ctx, 0, Utils.lerp(40, 0, e), e));
  }

  get humanos() { return this.gm.jugadores.filter((j) => !j.esBot); }

  /** ¿Otro jugador ya confirmó este personaje? */
  ocupado(i, yo) { return this.humanos.some((o) => o !== yo && o.listo && o.personaje === i); }

  _primerLibre(yo) {
    for (let i = 0; i < PERSONAJES.length; i++) if (!this.ocupado(i, yo)) return i;
    return 0;
  }

  confirmar(j) {
    if (j.listo || j.esBot) return;
    if (this.ocupado(j.sel, j)) { this.gm.aviso(`${PERSONAJES[j.sel].nombre} YA ESTÁ ELEGIDO`); this.gm.audio.derrota(); return; }
    this.gm.setPersonaje(j, j.sel);
    j.listo = true;
    this.gm.audio.exito();
    this.gm.difundir();
  }

  cancelar(j) {
    if (!j.listo || j.esBot) return;
    j.listo = false;
    this.cuenta = 0;
    this.gm.audio.blip();
    this.gm.difundir();
  }

  quitarBot() {
    const bots = this.gm.jugadores.filter((j) => j.esBot);
    if (bots.length) this.gm.quitarJugador(bots[bots.length - 1].id);
  }

  actualizar() {
    const gm = this.gm;
    this.bEmpezar.habilitado = gm.jugadores.length > 0;
    this.bMas.habilitado = gm.jugadores.length < MAX_JUGADORES;
    this.bMenos.habilitado = gm.jugadores.some((j) => j.esBot);
    const h = this.humanos;
    const todos = h.length > 0 && h.every((j) => j.listo);
    if (todos && !this.cuenta) this.cuenta = Date.now();
    if (!todos) this.cuenta = 0;
    if (this.fase !== 'personajes') { this.cuenta = 0; return; }
    if (this.cuenta && Date.now() - this.cuenta > 1500 && !gm.transicion.activa) this.irAMundos();
    this.previas.forEach((p, i) => p.setEstado(h.some((j) => j.listo && j.personaje === i) ? 'victoria' : 'idle'));
  }

  dibujar(ctx) {
    if (this.fase === 'mundo') { this._dibujarMundos(ctx); return; }
    const gm = this.gm;
    const ahora = Date.now();
    const e = Utils.easeOutCubic(Utils.progreso(this.t0, TRANSICION_MS));
    Utils.texto(ctx, 'ELIGE TU PERSONAJE', ANCHO / 2, Utils.lerp(-20, 16, e), { tam: 13, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 5 });
    const nb = gm.jugadores.filter((j) => j.esBot).length;
    let ayuda;
    if (gm.modo === 'celulares' && !gm.hub.local) ayuda = `SALA ${gm.sala.codigo} · ${gm.sala.url || 'CONECTANDO...'}`;
    else if (gm.modo === 'pc') ayuda = 'J1: WASD + ESPACIO   ·   J2: FLECHAS + ENTER   ·   (Q / SHIFT: CAMBIAR)';
    else ayuda = 'FLECHAS: ELEGIR  ·  ESPACIO: CONFIRMAR  ·  B: CAMBIAR  ·  O HAZ CLIC';
    Utils.texto(ctx, ayuda, ANCHO / 2, 30, { tam: 5, color: PALETA.hielo, alfa: e });
    if (gm.modo === 'celulares' && gm.qr) {                    // QR para entrar sin escribir el código
      Utils.panel(ctx, 4, 2, 52, 52, PALETA.hielo, PALETA.fondo, 2);
      ctx.drawImage(gm.qr, 8, 6, 44, 44);
    }
    Utils.texto(ctx, `JUGADORES ${this.humanos.length} · BOTS ${nb} (SE LES DA UN PERSONAJE AL AZAR)`, ANCHO / 2, 39, { tam: 5, color: PALETA.cian, alfa: e });

    const w = 140, h = 124, gap = 8, x0 = (ANCHO - (4 * w + 3 * gap)) / 2, y0 = 58;
    PERSONAJES.forEach((def, i) => {
      const col = i % 4, fila = Math.floor(i / 4);
      const p = Utils.easeOutCubic(Utils.progreso(this.t0 + i * 50, TRANSICION_MS));
      const x = x0 + col * (w + gap);
      const y = y0 + fila * (h + 4) + Utils.lerp(50, 0, p);
      const dueno = this.humanos.find((j) => j.listo && j.personaje === i);
      const cursores = this.humanos.filter((j) => !j.listo && j.sel === i);
      ctx.save();
      ctx.globalAlpha = p;
      Utils.panel(ctx, x, y, w, h, PALETA.fondo, dueno ? PALETA.hielo : def.color, dueno ? 5 : 3);
      ctx.globalAlpha = p * (dueno ? 0.45 : 0.18);         // brillo de fondo del color del personaje
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(x + w / 2, y + 52, dueno ? 46 + Math.sin(ahora / 200) * 3 : 38, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = p;
      this.previas[i].dibujar(ctx, x + w / 2, y + 58, 96, ahora);
      const duenoEmote = this.humanos.find((j) => (j.listo ? j.personaje : j.sel) === i && j.burbuja);
      if (duenoEmote) dibujarBurbuja(ctx, duenoEmote, x + w - 24, y + 24);
      Utils.panel(ctx, x + 3, y + h - 30, w - 6, 27, PALETA.fondo, PALETA.fondo, 1);
      Utils.texto(ctx, def.nombre, x + w / 2, y + h - 21, { tam: 7, color: def.color });
      Utils.texto(ctx, def.desc, x + w / 2, y + h - 10, { tam: 5, color: PALETA.hielo });
      if (dueno) {
        Utils.panel(ctx, x + 6, y + 6, w - 12, 16, PALETA.fondo, PALETA.hielo, 2);
        Utils.texto(ctx, `${dueno.nombre} · LISTO`, x + w / 2, y + 15, { tam: 5, color: PALETA.amarillo });
      }
      cursores.forEach((j, k) => {                        // marco de cada jugador que está mirando este personaje
        const c = this.coloresCursor[this.humanos.indexOf(j) % this.coloresCursor.length];
        const pulso = 1 + Math.sin(ahora / 150) * 1;
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 3 - k * 4 - pulso, y - 3 - k * 4 - pulso, w + 6 + k * 8 + pulso * 2, h + 6 + k * 8 + pulso * 2);
        Utils.panel(ctx, x + 4 + k * 46, y - 8, 44, 13, c, PALETA.fondo, 2);
        Utils.texto(ctx, j.nombre.slice(0, 6), x + 26 + k * 46, y - 1, { tam: 5, color: PALETA.fondo });
      });
      if (cursores.length && this.ocupado(i, cursores[0])) Utils.texto(ctx, 'OCUPADO', x + w / 2, y + 58, { tam: 8, color: PALETA.laser, borde: PALETA.fondo, grosor: 4 });
      ctx.restore();
    });

    this.menu.botones.forEach((b) => b.dibujar(ctx, 0, Utils.lerp(40, 0, e), e));
    if (this.cuenta) {
      const s = 3 - Math.floor((ahora - this.cuenta) / 1000);
      Utils.panel(ctx, ANCHO / 2 - 110, 150, 220, 40, PALETA.verde, PALETA.fondo, 4);
      Utils.texto(ctx, s > 1 ? '¡TODOS LISTOS!' : '¡A ELEGIR MUNDO!', ANCHO / 2, 171, { tam: 10, color: PALETA.fondo });
    }
  }

  _cartaEn(px, py) {
    const w = 140, h = 124, gap = 8, x0 = (ANCHO - (4 * w + 3 * gap)) / 2, y0 = 58;
    for (let i = 0; i < PERSONAJES.length; i++) {
      const x = x0 + (i % 4) * (w + gap), y = y0 + Math.floor(i / 4) * (h + 4);
      if (px >= x && px <= x + w && py >= y && py <= y + h) return i;
    }
    return -1;
  }

  onMover(x, y) { (this.fase === 'mundo' ? this.menuMundo : this.menu).mover(x, y); }

  onClick(x, y) {
    if (this.fase === 'mundo') {
      if (this.menuMundo.click(x, y, this.gm.audio)) return;
      const i = this._cartaMundo(x, y);
      if (i < 0) return;
      if (i === this.selMundo) this.jugar(); else this.elegirMundo(i);
      return;
    }
    if (this.menu.click(x, y, this.gm.audio)) return;
    const i = this._cartaEn(x, y);
    const j = this.humanos.find((p) => !p.remoto);          // el ratón/toque es del jugador local
    if (i < 0 || !j) return;
    if (j.listo) this.cancelar(j);
    j.sel = i;
    this.confirmar(j);
  }

  onTecla(e) {
    if (this.fase === 'mundo') {
      if (e.code === 'Escape') this.atras();
      else if (e.code === 'Enter') this.jugar();
      else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !this.gm.jugadores.some((j) => j.id.startsWith('local'))) this.elegirMundo(this.selMundo + (e.code === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (e.code === 'Escape') { this.gm.cambiarEstado(ESTADO.TITULO); return; }
    if (e.code === 'KeyB') { this.gm.agregarBot(); return; }
    if (e.code === 'Enter') { this.gm.audio.blip(); this.irAMundos(); return; }
    const hayLocal = this.gm.jugadores.some((j) => j.id.startsWith('local'));
    if (!hayLocal || !e.code.startsWith('Arrow')) this.menu.tecla(e, this.gm.audio);
  }

  /** Cruceta (teclado o celular): mueve el cursor por la grilla de personajes. */
  onDir(j, x, y) {
    if (this.fase === 'mundo') { if (x && this._puedeElegirMundo(j)) this.elegirMundo(this.selMundo + x); return; }
    if (j.esBot || j.listo || (!x && !y)) return;
    const n = PERSONAJES.length;
    if (x) j.sel = (j.sel + x + n) % n;
    if (y) j.sel = (j.sel + y * 4 + n) % n;
    this.gm.audio.tono('square', 660, 660, 0.03, 0.08);
    this.gm.difundir();
  }

  onBoton(j, b) {
    if (this.fase === 'mundo') {
      if (!this._puedeElegirMundo(j)) return;
      if (b === 'A') this.jugar(); else this.atras();
      return;
    }
    if (b === 'A') this.confirmar(j);
    if (b === 'B') this.cancelar(j);
  }
}

/* ---------- State 2: Tablero (un mundo a elegir) ---------- */
/** Tipos de casilla: color, marca y tinta del texto. */
const CASILLAS = {
  inicio: { color: PALETA.hielo, marca: 'GO', tinta: PALETA.fondo },
  normal: { color: PALETA.azul, marca: '+2', tinta: PALETA.hielo },
  estrella: { color: PALETA.amarillo, marca: '+5', tinta: PALETA.fondo },
  trampa: { color: PALETA.laser, marca: '-3', tinta: PALETA.hielo },
  turbo: { color: PALETA.verde, marca: '>>', tinta: PALETA.fondo },
  portal: { color: PALETA.morado, marca: '', tinta: PALETA.hielo },
  cofre: { color: PALETA.naranja, marca: '?', tinta: PALETA.fondo },
  agujero: { color: PALETA.fondo, marca: '', tinta: PALETA.morado },
  cambio: { color: PALETA.rosa, marca: '<>', tinta: PALETA.fondo },
  tienda: { color: '#ffffff', marca: 'SHOP', tinta: PALETA.morado },
  // casillas propias de cada mundo
  hielo: { color: '#d9f7ff', marca: '~', tinta: '#2f7fb8' },
  liana: { color: '#2fb84a', marca: '^4', tinta: PALETA.hielo },
  erupcion: { color: '#ff5a2a', marca: '!', tinta: PALETA.amarillo },
  casino: { color: '#00e5c0', marca: '$', tinta: PALETA.fondo },
};

/** Objetos de la tienda: se usan antes de lanzar el dado (máximo 3 por jugador). */
const OBJETOS = {
  doble: { nombre: 'DADO DOBLE', desc: 'TIRAS 2 DADOS', precio: 6, color: PALETA.amarillo },
  turbo: { nombre: 'DADO +3', desc: 'SUMA 3 AL DADO', precio: 4, color: PALETA.verde },
  escudo: { nombre: 'ESCUDO', desc: 'BLOQUEA LA PRÓXIMA TRAMPA', precio: 5, color: PALETA.cian },
  ladron: { nombre: 'LADRÓN', desc: 'ROBA 5 AL MÁS RICO', precio: 8, color: PALETA.rosa },
  tele: { nombre: 'TELETRANSPORTE', desc: 'VIAJAS A LA ESTRELLA', precio: 14, color: PALETA.morado },
};
const PRECIO_ESTRELLA = 20;
const FRASES = {
  trampa: ['¡UY, ESO DOLIÓ!', '¡AUCH! ESA TRAMPA ESTABA AHÍ', '¡QUÉ MALA SUERTE!'],
  estrella: ['¡UNA ESTRELLA! QUÉ CRACK', '¡BRILLA, BRILLA, ESTRELLITA!', '¡ESO SÍ ES JUGAR!'],
  pobre: ['¿Y LAS MONEDAS? ¡A AHORRAR!', 'SIN PLATA NO HAY ESTRELLA'],
  portal: ['¡WOOOSH! ¿DÓNDE ESTOY?', '¡VIAJE INTERGALÁCTICO GRATIS!'],
  agujero: ['¡EL AGUJERO NEGRO TE COMIÓ!', '¡PA TRÁS COMO EL CANGREJO!'],
  casinoGana: ['¡LA SUERTE ESTÁ DE TU LADO!'],
  casinoPierde: ['LA CASA SIEMPRE GANA...'],
  erupcion: ['¡CORRAN, QUE QUEMA!', '¡LAVA PARA TODOS!'],
  tienda: ['¡BIENVENIDO A LA TIENDA ESPACIAL!'],
  ronda: ['¡QUE EMPIECE LA FIESTA!', '¡A JUGAR, CRACKS!', '¡OTRA RONDA, OTRA AVENTURA!'],
  final: ['¡ÚLTIMAS RONDAS! TODO VALE DOBLE'],
  ladron: ['¡LADRÓN ESPACIAL!'],
  escudo: ['¡EL ESCUDO TE SALVÓ!'],
  atajo: ['¿ATAJO? ¡QUÉ VALIENTE!'],
  minijuego: ['¡HORA DEL MINIJUEGO!', '¡A DEMOSTRAR QUIÉN MANDA!'],
};
/** Eventos sorpresa al empezar cada ronda (desde la 2). */
const EVENTOS = [
  { id: 'lluvia', nombre: 'LLUVIA DE MONEDAS', desc: 'TODOS GANAN 3 MONEDAS' },
  { id: 'meteoritos', nombre: 'LLUVIA DE METEORITOS', desc: 'DOS JUGADORES PIERDEN 3' },
  { id: 'estrella', nombre: '¡LA ESTRELLA SE MUDA!', desc: 'APARECE EN OTRO LUGAR' },
  { id: 'agujero', nombre: 'AGUJERO VIAJERO', desc: 'UNA CASILLA SE VUELVE AGUJERO' },
];

/**
 * Mundos que se pueden elegir. La forma del camino es una curva cerrada:
 * forma(t) da la distancia al centro para cada ángulo t (en el suelo) y `ancho` lo estira.
 */
const MUNDOS = [
  { id: 'hielo', nombre: 'GLACIAR CRISTAL', desc: ['HIELO RESBALOSO:', 'TE DESLIZAS 2 MÁS'], especial: 'hielo',
    suelo: '#bfeeff', suelo2: '#a6def5', lado: '#3a8fc4', borde: '#e8fbff', cielo: '#5ab8ff',
    adornos: ['cristal', 'pino', 'cristal', 'roca', 'pino'], forma: (t) => 470 + 170 * Math.sin(5 * t), ancho: 1.25,        // flor de 5 pétalos
    patron: ['normal', 'hielo', 'normal', 'estrella', 'trampa', 'normal', 'hielo', 'cofre', 'normal', 'turbo', 'normal', 'agujero'] },
  { id: 'selva', nombre: 'JUNGLA ALIEN', desc: ['LIANAS:', 'SALTAS 4 DE UNA VEZ'], especial: 'liana',
    suelo: '#6fd25c', suelo2: '#5cc04e', lado: '#2e7a3a', borde: '#b9ff8a', cielo: '#2fb84a',
    adornos: ['arbol', 'hongo', 'arbol', 'flor', 'arbol'], forma: (t) => 480 + 150 * Math.sin(3 * t + 1) + 60 * Math.sin(2 * t), ancho: 1.3,   // río con curvas
    patron: ['normal', 'liana', 'normal', 'cofre', 'trampa', 'normal', 'estrella', 'normal', 'cambio', 'liana', 'normal', 'agujero'] },
  { id: 'lava', nombre: 'VOLCÁN MAGMA', desc: ['ERUPCIONES:', 'LOS DEMÁS PIERDEN 2'], especial: 'erupcion',
    suelo: '#5a3a3a', suelo2: '#4a2e30', lado: '#2a1418', borde: '#ffb15a', cielo: '#ff5a2a',
    adornos: ['roca', 'charco', 'roca', 'charco'], forma: (t) => 500 + 170 * Math.cos(2 * t) + 50 * Math.sin(3 * t), ancho: 1.15,   // maní alrededor del volcán
    patron: ['normal', 'trampa', 'erupcion', 'normal', 'estrella', 'trampa', 'normal', 'cofre', 'turbo', 'normal', 'erupcion', 'agujero'] },
  { id: 'neon', nombre: 'CIUDAD NEÓN', desc: ['CASINO:', 'GANAS 6 O PIERDES 4'], especial: 'casino',
    suelo: '#3a2a7a', suelo2: '#33256c', lado: '#1c1147', borde: '#ff8ad8', cielo: '#e23cc8',
    adornos: ['torre', 'cartel', 'torre', 'torre'], forma: (t) => 500 + 95 * Math.sin(6 * t) + 40 * Math.cos(2 * t), ancho: 1.3,   // engranaje de 6 cuadras
    patron: ['normal', 'casino', 'normal', 'cambio', 'estrella', 'normal', 'trampa', 'casino', 'normal', 'cofre', 'normal', 'turbo'] },
];

class EstadoTablero {
  constructor(gm) {
    this.gm = gm;
    this.TW = 46;                 // ancho del rombo de cada casilla
    this.TH = 23;                 // alto del rombo
    this.mapas = MUNDOS.map((m, k) => this._crearMapa(m, k));
    this.pantalla = { x: ANCHO / 2, y: 190 };     // dónde queda el foco en la pantalla
    this.dadoPos = { x: 598, y: 310, r: 30 };
    this.usar(0);
  }

  usar(k) {
    this.mapa = this.mapas[k] || this.mapas[0];
    this.mundo = MUNDOS[this.mapa.k];
    this.casillas = this.mapa.casillas;
    this.cam = { ...this.mapa.vista };
  }

  /** Convierte la forma del mundo en casillas, isla, atajos y adornos (todo orgánico, sin grilla). */
  _crearMapa(m, k) {
    const PASO = 50, APLASTE = 0.55;                    // distancia entre casillas y aplastado isométrico
    // 1) la curva cerrada y casillas repartidas a la misma distancia
    const curva = [];
    for (let i = 0; i < 1500; i++) {
      const t = (i / 1500) * Math.PI * 2, r = m.forma(t);
      curva.push([Math.cos(t) * r * m.ancho, Math.sin(t) * r]);
    }
    const largo = [0];
    for (let i = 1; i <= curva.length; i++) largo.push(largo[i - 1] + Math.hypot(curva[i % curva.length][0] - curva[i - 1][0], curva[i % curva.length][1] - curva[i - 1][1]));
    const total = largo[largo.length - 1], n = Math.round(total / PASO);
    const suelo2d = [];
    for (let q = 0, s2 = 0; q < n; q++) {
      const d = (q * total) / n;
      while (largo[s2 + 1] < d) s2++;
      const a = curva[s2], b = curva[(s2 + 1) % curva.length], u = (d - largo[s2]) / (largo[s2 + 1] - largo[s2]);
      suelo2d.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    const proyectar = (gx, gy) => ({ x: gx, y: gy * APLASTE, gx, gy });
    const portales = [Math.round(n * 0.3), Math.round(n * 0.72)];
    const tiendas = [Math.round(n * 0.15), Math.round(n * 0.55), Math.round(n * 0.88)];
    const casillas = suelo2d.map(([gx, gy], t) => {
      let tipo = t === 0 ? 'inicio' : m.patron[(t - 1) % m.patron.length];
      if (portales.includes(t)) tipo = 'portal';
      if (tiendas.includes(t)) tipo = 'tienda';
      return { ...proyectar(gx, gy), tipo, base: tipo, k: t, rebote: 0, sig: [(t + 1) % n], ant: (t - 1 + n) % n };
    });
    const dist = (a, b) => Math.hypot(a.gx - b.gx, a.gy - b.gy);
    // 2) atajos: líneas rectas por dentro de la isla entre dos partes lejanas del camino
    const usados = new Set([0, ...portales, ...tiendas]);
    for (let intento = 0; intento < 3; intento++) {
      let mejor = null;
      for (let a = 3; a < n - 20; a += 2) {
        if (usados.has(a) || casillas[a].sig.length > 1) continue;
        for (let b = a + 18; b < n - 2; b++) {
          if (usados.has(b)) continue;
          const d = dist(casillas[a], casillas[b]);
          if (d < 120 || d > 560) continue;
          const cuantas = Math.floor(d / PASO) - 1;
          const puntos = [];
          for (let q = 1; q <= cuantas; q++) {
            const u = q / (cuantas + 1);
            puntos.push([Utils.lerp(casillas[a].gx, casillas[b].gx, u), Utils.lerp(casillas[a].gy, casillas[b].gy, u)]);
          }
          const libre = puntos.every(([gx, gy]) => casillas.every((c) => c.k === a || c.k === b || Math.hypot(c.gx - gx, c.gy - gy) > 55));
          if (!libre) continue;
          const ahorro = b - a - cuantas;
          if (ahorro < 8) continue;
          if (!mejor || ahorro > mejor.ahorro) mejor = { a, b, puntos, ahorro };
        }
      }
      if (!mejor) break;
      const inicio = casillas.length;
      mejor.puntos.forEach(([gx, gy], q) => {
        const tipo = q % 2 === 0 ? 'trampa' : 'cofre';
        casillas.push({ ...proyectar(gx, gy), tipo, base: tipo, k: inicio + q, rebote: 0, atajo: true,
          sig: [q === mejor.puntos.length - 1 ? mejor.b : inicio + q + 1], ant: q === 0 ? mejor.a : inicio + q - 1 });
      });
      casillas[mejor.a].sig.push(inicio);
      casillas[mejor.a].cruce = true;
      for (let q = mejor.a - 6; q <= mejor.a + 6; q++) usados.add(q);
      for (let q = mejor.b - 6; q <= mejor.b + 6; q++) usados.add(q);
    }
    // 3) la isla: manchas redondas alrededor del camino y por todo el interior
    const dentro = (gx, gy) => {                          // punto dentro de la curva (ray casting)
      let si = false;
      for (let i = 0, j2 = suelo2d.length - 1; i < suelo2d.length; j2 = i++) {
        const [xi, yi] = suelo2d[i], [xj, yj] = suelo2d[j2];
        if ((yi > gy) !== (yj > gy) && gx < ((xj - xi) * (gy - yi)) / (yj - yi) + xi) si = !si;
      }
      return si;
    };
    const manchas = casillas.filter((c, i) => i % 2 === 0 || c.atajo).map((c) => ({ ...proyectar(c.gx, c.gy), r: 78 }));
    const xs = suelo2d.map((p) => p[0]), ys = suelo2d.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (let gx = x0; gx <= x1; gx += 95) for (let gy = y0; gy <= y1; gy += 95) if (dentro(gx, gy)) manchas.push({ ...proyectar(gx, gy), r: 88 });
    // 4) adornos en lugares libres (lejos del camino)
    let semilla = 7 + k * 13;
    const azar = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
    const adornos = [];
    for (let gx = x0 - 60; gx <= x1 + 60; gx += 58) {
      for (let gy = y0 - 60; gy <= y1 + 60; gy += 58) {
        const px = gx + (azar() - 0.5) * 30, py = gy + (azar() - 0.5) * 30;
        const cerca = Math.min(...casillas.map((c) => Math.hypot(c.gx - px, c.gy - py)));
        if (cerca < 52 || (!dentro(px, py) && cerca > 70)) continue;
        if (azar() < 0.5) adornos.push({ ...proyectar(px, py), tipo: m.adornos[Math.floor(azar() * m.adornos.length)], fase: azar() * 6 });
      }
    }
    if (m.id === 'lava') {                                 // un gran volcán en el centro
      const c = proyectar(0, 0);
      adornos.splice(0, adornos.length, ...adornos.filter((a) => Math.hypot(a.gx, a.gy) > 170), { ...c, tipo: 'volcan', fase: 0 });
    }
    // 5) vista general
    const sx = casillas.map((c) => c.x), sy = casillas.map((c) => c.y);
    const bx0 = Math.min(...sx) - 80, bx1 = Math.max(...sx) + 80, by0 = Math.min(...sy) - 70, by1 = Math.max(...sy) + 70;
    const z = Math.min(1.1, 590 / (bx1 - bx0), 270 / (by1 - by0));
    return { k, casillas, principales: n, manchas, adornos, caja: { x0: bx0, x1: bx1, y0: by0, y1: by1 }, vista: { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2 + 8, z } };
  }

  /** Velocidad: en modo rápido todo dura menos. */
  ms(v) { return v * this.gm.vel; }

  entrar() {
    const gm = this.gm;
    const primera = gm.ronda === 0;
    if (primera) gm.ronda = 1;
    this.usar(gm.mundo || 0);
    if (primera) {
      // casillas especiales activadas o no (ajustes)
      const quitables = ['hielo', 'liana', 'erupcion', 'casino', 'portal', 'agujero', 'cambio', 'turbo'];
      this.casillas.forEach((c) => { c.tipo = !gm.ajustes.especiales && quitables.includes(c.base) ? 'normal' : c.base; });
      this.estrellaK = -1;
      this._moverEstrella(false);
    }
    this.orden = gm.jugadores.slice();
    this.orden.forEach((j) => j.sprite.setEstado('idle'));
    this.turno = 0;
    this.dado = { valor: 1, mostrado: 1, ultimoCambio: 0 };
    this.textos = [];
    this.particulas = [];
    this.salto = null;
    this.portal = null;
    this.cambio = null;
    this.siguiente = null;
    this.saliendo = false;
    this.opciones = null;
    this.modDado = null;
    this.vuelo = null;
    this.multi = gm.ronda > gm.rondas - (gm.rondas >= 5 ? 3 : 1) ? 2 : 1;   // últimas rondas: todo vale doble
    this.evento = !primera ? EVENTOS[Utils.entero(0, EVENTOS.length - 1)] : null;
    this.cambiarFase('intro');
    if (primera && gm.ajustes.tutoriales) {             // tutorial del tablero en la primera ronda
      this.listosTuto = new Set(this.orden.filter((j) => j.esBot).map((j) => j.id));
      this.cambiarFase('tutorial');
    }
    gm.audio.iniciarMusica(this.mundo.id);
    gm.narrar(this.multi > 1 ? 'final' : 'ronda');
  }

  salir() { this.gm.audio.detenerMusica(); }

  /** Pone la estrella en una casilla normal lejos de los jugadores. */
  _moverEstrella(animar = true) {
    const js = this.orden || this.gm.jugadores;
    const ocupadas = new Set(js.map((j) => j.casilla));
    const n = this.mapa.principales;
    // se pone entre 10 y 28 casillas delante de algún jugador, para que siempre se pueda alcanzar
    const ref = js.length ? js[Utils.entero(0, js.length - 1)].casilla : 0;
    const base = ref < n ? ref : this.casillas[ref].sig[0] % n;
    const adelante = (c) => (c.k - base + n) % n;
    let libres = this.casillas.filter((c) => !c.atajo && c.tipo === 'normal' && c.k !== this.estrellaK && !ocupadas.has(c.k) && adelante(c) >= 10 && adelante(c) <= 28);
    if (!libres.length) libres = this.casillas.filter((c) => !c.atajo && c.tipo === 'normal' && c.k !== this.estrellaK);
    const nueva = libres[Utils.entero(0, libres.length - 1)] || this.casillas[1];
    if (animar && this.estrellaK >= 0) this.vuelo = { desde: this.estrellaK, hasta: nueva.k, t0: Date.now() };
    this.estrellaK = nueva.k;
  }

  _aplicarEvento() {
    const ev = this.evento;
    if (!ev) return;
    if (ev.id === 'lluvia') this.orden.forEach((j) => this._monedas(j, 3, true));
    if (ev.id === 'meteoritos') this.orden.slice().sort(() => Math.random() - 0.5).slice(0, 2).forEach((j) => this._monedas(j, -3, true));
    if (ev.id === 'estrella') this._moverEstrella(true);
    if (ev.id === 'agujero') {
      const libres = this.casillas.filter((c) => c.tipo === 'normal' && !c.atajo && c.k !== this.estrellaK);
      const c = libres[Utils.entero(0, libres.length - 1)];
      if (c) { c.tipo = 'agujero'; c.rebote = Date.now(); }
    }
    if (ev.id === 'meteoritos') this.gm.sacudida = 16;
    this.evento = null;
  }

  get actual() { return this.orden[this.turno]; }

  cambiarFase(f) {
    this.fase = f;
    this.tFase = Date.now();
    if (f === 'espera' || f === 'rodando') this.gm.difundir();
  }

  datosMando() {
    const j = this.actual;
    const d = { turnoDe: j ? j.id : null, fase: this.fase, ronda: this.gm.ronda, mundo: this.mundo.nombre };
    if (this.fase === 'tutorial') { d.etiquetaA = '¡ENTENDIDO!'; d.listos = [...this.listosTuto]; }
    if (this.fase === 'espera') { d.etiquetaA = 'LANZAR DADO'; d.etiquetaB = j && j.objetos.length ? 'OBJETOS' : ''; }
    if (this.opciones) {
      d.etiquetaA = this.opciones.etiquetaA;
      d.etiquetaB = this.opciones.etiquetaB;
      d.opcion = this.opciones.lista[this.opciones.sel].txt;
      d.flechas = this.opciones.lista.length > 1;
    }
    return d;
  }

  lanzar() {
    if (this.fase !== 'espera') return;
    const m = this.modDado;
    this.dado.v1 = Utils.entero(1, 10);
    this.dado.v2 = m === 'doble' ? Utils.entero(1, 10) : 0;
    this.dado.valor = this.dado.v1 + this.dado.v2 + (m === 'turbo' ? 3 : 0);
    this.cambiarFase('rodando');
  }

  // --- menús de decisión (objetos, tienda, cruce, estrella) ---
  /** Abre opciones para el jugador del turno; elegir(i) se llama con A, cancelar con B. */
  _abrirOpciones(titulo, lista, elegir, cancelar, etiquetaA = 'ELEGIR', etiquetaB = 'SALIR') {
    this.opciones = { titulo, lista, sel: 0, elegir, cancelar, etiquetaA, etiquetaB, t0: Date.now() };
    this.gm.difundir();
  }

  _decidir(i) {
    const o = this.opciones;
    if (!o) return;
    this.opciones = null;
    this.gm.audio.blip();
    o.elegir(i);
    this.gm.difundir();
  }

  _cancelar() {
    const o = this.opciones;
    if (!o || !o.cancelar) return;
    this.opciones = null;
    this.gm.audio.tono('square', 500, 300, 0.06, 0.1);
    o.cancelar();
    this.gm.difundir();
  }

  _abrirObjetos(j) {
    const lista = j.objetos.map((id) => ({ txt: OBJETOS[id].nombre, sub: OBJETOS[id].desc, color: OBJETOS[id].color, id }));
    this.cambiarFase('objetos');
    this._abrirOpciones('TUS OBJETOS', lista, (i) => this._usarObjeto(j, lista[i].id), () => this.cambiarFase('espera'), 'USAR', 'VOLVER');
  }

  _usarObjeto(j, id) {
    j.objetos.splice(j.objetos.indexOf(id), 1);
    j.stats.objetos++;
    const c = this.casillas[j.casilla];
    this._texto(`¡${OBJETOS[id].nombre}!`, c, OBJETOS[id].color);
    this.gm.audio.tono('square', 520, 1040, 0.15, 0.12);
    if (id === 'doble' || id === 'turbo') { this.modDado = id; this.cambiarFase('espera'); return; }
    if (id === 'escudo') { j.escudo = true; this.cambiarFase('espera'); return; }
    if (id === 'ladron') {
      const rico = this.orden.filter((o) => o !== j).sort((a, b) => b.monedas - a.monedas)[0];
      if (rico) {
        const n = Math.min(5, rico.monedas);
        rico.monedas -= n;
        j.monedas += n;
        this._texto(`¡ROBAS ${n} A ${rico.nombre}!`, c, PALETA.rosa);
        this.gm.burbuja(rico, 2);
        this.gm.narrar('ladron');
      }
      this.cambiarFase('espera');
      return;
    }
    if (id === 'tele') {
      this.portal = { j, hasta: this.estrellaK, t0: Date.now(), cambiado: false, alFinal: () => this._preguntarEstrella(j, () => this.cambiarFase('espera')) };
      this.cambiarFase('portal');
    }
  }

  _abrirTienda(j) {
    this.gm.narrar('tienda');
    const lista = Object.entries(OBJETOS).map(([id, o]) => ({ txt: `${o.nombre} · ${o.precio}`, sub: o.desc, color: o.color, id }));
    this.cambiarFase('tienda');
    this._abrirOpciones(`TIENDA ESPACIAL · TIENES ${j.monedas} MONEDAS`, lista, (i) => {
      const o = OBJETOS[lista[i].id];
      if (j.monedas < o.precio) { this._texto('NO TE ALCANZA', this.casillas[j.casilla], PALETA.laser); this.gm.burbuja(j, 4); }
      else if (j.objetos.length >= 3) this._texto('YA TIENES 3 OBJETOS', this.casillas[j.casilla], PALETA.hielo);
      else { j.monedas -= o.precio; j.objetos.push(lista[i].id); this._texto(`COMPRASTE ${o.nombre}`, this.casillas[j.casilla], o.color); this.gm.audio.exito(); }
      this.cambiarFase('efecto');
    }, () => this.cambiarFase('efecto'), 'COMPRAR', 'SALIR');
  }

  /** Al pasar por la estrella: comprarla por 20 monedas. `seguir` continúa el movimiento. */
  _preguntarEstrella(j, seguir) {
    const c = this.casillas[j.casilla];
    if (j.monedas < PRECIO_ESTRELLA) {
      this._texto(`TE FALTAN ${PRECIO_ESTRELLA - j.monedas} MONEDAS`, c, PALETA.hielo);
      this.gm.narrar('pobre');
      this.cambiarFase('pausa');
      this.siguientePausa = seguir;
      return;
    }
    this.cambiarFase('estrella');
    this._abrirOpciones(`¿COMPRAR LA ESTRELLA POR ${PRECIO_ESTRELLA}?`, [{ txt: '¡SÍ, LA QUIERO!', sub: 'GANA QUIEN TENGA MÁS ESTRELLAS', color: PALETA.amarillo }], () => {
      j.monedas -= PRECIO_ESTRELLA;
      j.estrellas++;
      this._texto('¡+1 ESTRELLA!', c, PALETA.amarillo);
      this.gm.burbuja(j, 1);
      this.gm.narrar('estrella');
      this.gm.audio.exito();
      this.gm.audio.tono('square', 1046, 1568, 0.3, 0.12, 0.35);
      for (let i = 0; i < 30; i++) this.particulas.push({ x: c.x, y: c.y - 30, vx: Utils.azar(-3, 3), vy: Utils.azar(-4, 0), vida: 50, color: i % 2 ? PALETA.amarillo : PALETA.hielo });
      j.sprite.setEstado('victoria');
      this._moverEstrella(true);
      this.cambiarFase('pausa');
      this.siguientePausa = () => { j.sprite.setEstado('idle'); seguir(); };
    }, () => { this.cambiarFase('pausa'); this.siguientePausa = seguir; }, 'COMPRAR', 'NO');
  }

  _abrirCruce(j) {
    const c = this.casillas[j.casilla];
    this.cambiarFase('cruce');
    this.gm.narrar('atajo');
    const lista = [
      { txt: 'CAMINO NORMAL', sub: 'EL DE SIEMPRE', color: PALETA.azul, k: c.sig[0] },
      { txt: 'ATAJO PELIGROSO', sub: 'MÁS CORTO, CON TRAMPAS', color: PALETA.laser, k: c.sig[1] },
    ];
    this._abrirOpciones('¿POR DÓNDE SIGUES?', lista, (i) => { this.eleccion = i; this._siguienteSalto(j); }, null, 'IR', '');
  }

  // --- movimiento ---
  /** Mueve a j `pasos` casillas (dir 1 adelante, -1 atrás). `largo` = un solo salto grande de varias casillas. */
  mover(j, pasos, dir, aplicar, largo = 0) {
    this.pasos = largo ? 1 : pasos;
    this.dir = dir;
    this.largo = largo;
    this.aplicarAlFinal = aplicar;
    this._siguienteSalto(j);
  }

  /** Prepara el próximo salto siguiendo el camino (o pregunta en un cruce). */
  _siguienteSalto(j) {
    const c = this.casillas[j.casilla];
    let hasta;
    if (this.dir < 0) hasta = c.ant;
    else if (this.largo) {
      hasta = j.casilla;
      for (let q = 0; q < this.largo; q++) hasta = this.casillas[hasta].sig[0];
    } else if (c.sig.length > 1 && this.eleccion === undefined) {
      if (!j.esBot) { this._abrirCruce(j); return; }
      hasta = c.sig[Math.random() < 0.4 ? 1 : 0];
    } else {
      hasta = c.sig[this.eleccion || 0];
    }
    this.eleccion = undefined;
    this.salto = { j, desde: j.casilla, hasta, t0: Date.now(), dur: this.ms(this.largo ? 650 : 300), H: this.largo ? 70 : 26 };
    this.fase = 'saltando';
  }

  /** Después de cada salto: sigue, o termina y aplica la casilla. */
  _continuar(j) {
    if (this.pasos > 0) { this._siguienteSalto(j); return; }
    this.salto = null;
    this.largo = 0;
    if (this.aplicarAlFinal) this._aplicarCasilla(j);
    else this.cambiarFase('efecto');
  }

  _aterrizar(c, color) {
    c.rebote = Date.now();
    for (let i = 0; i < 8; i++) {
      this.particulas.push({ x: c.x, y: c.y, vx: Utils.azar(-1.6, 1.6), vy: Utils.azar(-2.4, -0.6), vida: 30, color: color || CASILLAS[c.tipo].color });
    }
  }

  _texto(txt, c, color) { this.textos.push({ txt, x: c.x, y: c.y - 54, color, t0: Date.now() }); }

  _monedas(j, delta, silencio = false) {
    const c = this.casillas[j.casilla];
    if (delta < 0 && j.escudo) {
      j.escudo = false;
      this._texto('¡ESCUDO!', c, PALETA.cian);
      this.gm.narrar('escudo');
      return;
    }
    delta *= this.multi;
    j.monedas = Math.max(0, j.monedas + delta);
    if (delta < 0) { j.stats.trampas++; this.gm.burbuja(j, 4); } else if (delta >= 5) this.gm.burbuja(j, 0);
    this._texto((delta > 0 ? '+' : '') + delta + ' MONEDAS', c, delta > 0 ? PALETA.amarillo : PALETA.laser);
    if (silencio) return;
    if (delta > 0) {
      this.gm.audio.exito();
      for (let i = 0; i < 10; i++) this.particulas.push({ x: c.x, y: c.y - 20, vx: Utils.azar(-2, 2), vy: Utils.azar(-3, -1), vida: 40, color: PALETA.amarillo });
    } else {
      this.gm.audio.derrota();
    }
  }

  _aplicarCasilla(j) {
    const c = this.casillas[j.casilla];
    const audio = this.gm.audio;
    const otros = this.orden.filter((o) => o !== j);
    switch (c.tipo) {
      case 'normal': this._monedas(j, 2); break;
      case 'estrella': this._monedas(j, 5); break;
      case 'inicio': this._monedas(j, 3); break;
      case 'trampa': this._monedas(j, -3); this.gm.narrar('trampa'); break;
      case 'tienda': this._abrirTienda(j); return;
      case 'turbo':
        this._texto('¡TURBO! +3 CASILLAS', c, PALETA.verde);
        audio.tono('square', 300, 1200, 0.25, 0.15);
        this.siguiente = () => this.mover(j, 3, 1, true);
        break;
      case 'hielo':
        this._texto('¡RESBALÓN! +2 CASILLAS', c, '#bff3ff');
        audio.tono('sine', 900, 300, 0.3, 0.15);
        this.siguiente = () => this.mover(j, 2, 1, true);
        break;
      case 'liana':
        this._texto('¡LIANA! SALTO DE 4', c, PALETA.verde);
        audio.tono('triangle', 200, 900, 0.4, 0.18);
        this.siguiente = () => this.mover(j, 4, 1, true, 4);
        break;
      case 'erupcion':
        this._texto('¡ERUPCIÓN!', c, PALETA.naranja);
        this.gm.narrar('erupcion');
        audio.tono('sawtooth', 120, 40, 0.6, 0.25);
        this.gm.sacudida = 24;
        otros.forEach((o) => this._monedas(o, -2, true));
        for (let i = 0; i < 24; i++) this.particulas.push({ x: c.x, y: c.y - 10, vx: Utils.azar(-3, 3), vy: Utils.azar(-5, -2), vida: 45, color: i % 2 ? PALETA.naranja : PALETA.amarillo });
        break;
      case 'casino':
        if (Math.random() < 0.5) { this._texto('CASINO: ¡GANASTE!', c, '#00e5c0'); this._monedas(j, 6); this.gm.narrar('casinoGana'); }
        else { this._texto('CASINO: PERDISTE...', c, PALETA.rosa); this._monedas(j, -4); this.gm.narrar('casinoPierde'); }
        break;
      case 'agujero':
        if (j.escudo) { j.escudo = false; this._texto('¡ESCUDO!', c, PALETA.cian); this.gm.narrar('escudo'); break; }
        this._texto('¡AGUJERO NEGRO! -3', c, PALETA.morado);
        this.gm.narrar('agujero');
        j.stats.trampas++;
        this.gm.burbuja(j, 4);
        audio.tono('sawtooth', 500, 80, 0.5, 0.15);
        this.siguiente = () => this.mover(j, 3, -1, false);
        break;
      case 'portal':
        this._texto('¡PORTAL!', c, PALETA.morado);
        this.gm.narrar('portal');
        audio.tono('sine', 200, 1400, 0.4, 0.2);
        this.siguiente = () => {
          const destino = this.casillas.find((o) => o.tipo === 'portal' && o.k !== c.k);
          this.portal = { j, hasta: destino.k, t0: Date.now(), cambiado: false, alFinal: () => this.cambiarFase('efecto') };
          this.cambiarFase('portal');
        };
        break;
      case 'cambio':
        if (!otros.length) { this._monedas(j, 2); break; }
        {
          const o = otros[Utils.entero(0, otros.length - 1)];
          this._texto(`¡CAMBIO CON ${o.nombre}!`, c, PALETA.rosa);
          audio.blip();
          this.siguiente = () => {
            this.cambio = { a: j, b: o, desdeA: j.casilla, desdeB: o.casilla, t0: Date.now() };
            this.cambiarFase('cambio');
          };
        }
        break;
      case 'cofre': {
        const r = Math.random();
        if (r < 0.65 || !otros.length) {
          this._monedas(j, Utils.entero(3, 8));
        } else if (r < 0.85) {
          const rico = otros.slice().sort((a, b) => b.monedas - a.monedas)[0];
          const n = Math.min(3, rico.monedas);
          rico.monedas -= n;
          j.monedas += n;
          this._texto(`¡ROBAS ${n} A ${rico.nombre}!`, c, PALETA.naranja);
          this.gm.burbuja(rico, 2);
          audio.exito();
        } else {
          this._texto('COFRE VACÍO...', c, PALETA.hielo);
          audio.derrota();
        }
        break;
      }
      default: break;
    }
    this.cambiarFase('efecto');
  }

  _siguienteTurno() {
    this.turno++;
    this.modDado = null;
    if (this.turno >= this.orden.length) { this.cambiarFase('aviso'); this.gm.audio.exito(); this.gm.narrar('minijuego'); }
    else this.cambiarFase('espera');
  }

  actualizar() {
    const ahora = Date.now();
    const e = ahora - this.tFase;
    const j = this.actual;
    const audio = this.gm.audio;
    if (!this.orden.length) return;

    switch (this.fase) {
      case 'tutorial':
        if (this.orden.filter((o) => !o.esBot).every((o) => this.listosTuto.has(o.id))) this.cambiarFase('intro');
        break;
      case 'intro':
        if (e > this.ms(this.evento ? 2800 : 1800)) { this._aplicarEvento(); this.cambiarFase('espera'); }
        break;
      case 'espera':
        if (j && j.esBot && e > this.ms(1000)) {
          if (j.objetos.length && !this.modDado && Math.random() < 0.5) this._usarObjeto(j, j.objetos[0]);
          else this.lanzar();
        }
        break;
      case 'objetos': case 'tienda': case 'cruce': case 'estrella':
        if (j && j.esBot && this.opciones && e > this.ms(800)) {
          if (this.fase === 'tienda') {
            const posibles = this.opciones.lista.map((o, i) => i).filter((i) => OBJETOS[this.opciones.lista[i].id].precio <= j.monedas - 4);
            if (posibles.length && j.objetos.length < 3 && Math.random() < 0.7) this._decidir(posibles[Utils.entero(0, posibles.length - 1)]);
            else this._cancelar();
          } else this._decidir(0);
        }
        break;
      case 'pausa':
        if (e > this.ms(900) && this.siguientePausa) { const f = this.siguientePausa; this.siguientePausa = null; f(); }
        break;
      case 'rodando':
        if (ahora - this.dado.ultimoCambio > 70 && e < 1500) {
          this.dado.ultimoCambio = ahora;
          this.dado.mostrado = Utils.entero(1, 10);
          audio.tono('square', 1200, 900, 0.03, 0.05);
        }
        if (e >= 1500) {
          this.dado.mostrado = this.dado.valor;
          this.modDado = null;
          audio.blip();
          this.cambiarFase('resultado');
        }
        break;
      case 'resultado':
        if (e > this.ms(700)) this.mover(j, this.dado.valor, 1, true);
        break;
      case 'saltando': {
        const s = this.salto;
        if (!s || !this.orden.includes(s.j)) { this.salto = null; this.cambiarFase('efecto'); break; }
        if (Utils.progreso(s.t0, s.dur, ahora) >= 1) {
          s.j.casilla = s.hasta;
          s.j.stats.casillas++;
          this.pasos--;
          const c = this.casillas[s.hasta];
          this._aterrizar(c);
          audio.tono('triangle', 300, 600, 0.06, 0.12);
          if (this.pasos > 0 && c.tipo === 'inicio' && this.dir > 0) this._monedas(s.j, 3);
          this.salto = null;
          if (c.k === this.estrellaK && this.dir > 0) this._preguntarEstrella(s.j, () => this._continuar(s.j));
          else this._continuar(s.j);
        }
        break;
      }
      case 'portal': {
        const p = this.portal;
        if (!p) { this.cambiarFase('efecto'); break; }
        if (!p.cambiado && e >= 450) {
          p.cambiado = true;
          p.j.casilla = p.hasta;
          this._aterrizar(this.casillas[p.hasta], PALETA.morado);
        }
        if (e >= 900) { const fin = p.alFinal; this.portal = null; fin(); }
        break;
      }
      case 'cambio': {
        const c = this.cambio;
        if (c && e >= 800) {
          c.a.casilla = c.desdeB;
          c.b.casilla = c.desdeA;
          this._aterrizar(this.casillas[c.desdeA], PALETA.rosa);
          this._aterrizar(this.casillas[c.desdeB], PALETA.rosa);
          audio.tono('square', 180, 60, 0.15, 0.2);
          this.cambio = null;
          this.cambiarFase('efecto');
        } else if (!c) this.cambiarFase('efecto');
        break;
      }
      case 'efecto':
        if (e > this.ms(this.siguiente ? 800 : 1000)) {
          if (this.siguiente) { const f = this.siguiente; this.siguiente = null; f(); }
          else this._siguienteTurno();
        }
        break;
      case 'aviso':
        if (e > this.ms(1400) && !this.saliendo) {
          this.saliendo = true;
          this.gm.cambiarEstado(ESTADO.MINIJUEGO, 'fade');
        }
        break;
      default: break;
    }

    // cámara: vista de todo el mundo al inicio y al final; de cerca en cada turno
    const vista = this.mapa.vista;
    let meta = vista;
    if (j && !['intro', 'aviso'].includes(this.fase)) {
      const p = this._posicion(j);
      const z = this.fase === 'tutorial' ? vista.z : ['saltando', 'efecto', 'portal', 'cambio', 'pausa', 'estrella', 'cruce'].includes(this.fase) ? 1.55 : 1.3;
      meta = { x: p.x, y: p.y - 6, z: Math.max(vista.z, z) };
    }
    const vel = this.fase === 'saltando' ? 0.12 : 0.06;
    this.cam.x = Utils.lerp(this.cam.x, meta.x, vel);
    this.cam.y = Utils.lerp(this.cam.y, meta.y, vel);
    this.cam.z = Utils.lerp(this.cam.z, meta.z, 0.05);

    for (const p of this.particulas) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vida--; }
    this.particulas = this.particulas.filter((p) => p.vida > 0);
    this.textos = this.textos.filter((t) => ahora - t.t0 < 1500);
  }

  _yCasilla(c, ahora = Date.now()) {
    const ola = 1.2 * Math.sin(ahora / 600 + c.k * 0.5);
    const p = Utils.progreso(c.rebote, 450, ahora);
    const rebote = p < 1 ? -8 * Math.sin(p * Math.PI) * (1 - p) : 0;
    return c.y + ola + rebote;
  }

  _posicion(j) {
    const parabola = (a, b, t, H) => ({ x: Utils.lerp(a.x, b.x, t), y: Utils.lerp(this._yCasilla(a), this._yCasilla(b), t) - 4 * H * t * (1 - t), mov: true, mirar: b.x < a.x ? -1 : 1 });
    if (this.salto && this.salto.j === j) {
      const s = this.salto;
      return parabola(this.casillas[s.desde], this.casillas[s.hasta], Utils.progreso(s.t0, s.dur), s.H);
    }
    if (this.cambio && (this.cambio.a === j || this.cambio.b === j)) {
      const c = this.cambio;
      const [de, a] = c.a === j ? [c.desdeA, c.desdeB] : [c.desdeB, c.desdeA];
      return parabola(this.casillas[de], this.casillas[a], Utils.easeOutCubic(Utils.progreso(c.t0, 800)), 90);
    }
    const c = this.casillas[j.casilla];
    let esc = 1, giro = 0;
    if (this.portal && this.portal.j === j) {
      const e = Date.now() - this.portal.t0;
      esc = e < 450 ? 1 - Utils.easeOutCubic(e / 450) : Utils.easeOutBack(Utils.clamp((e - 450) / 450, 0, 1));
      giro = e / 60;
    }
    const vecinos = this.orden.filter((o) => o.casilla === j.casilla && !(this.salto && this.salto.j === o) && !(this.cambio && (this.cambio.a === o || this.cambio.b === o)));
    const y = this._yCasilla(c);
    if (vecinos.length <= 1) return { x: c.x, y, esc, giro };
    const a = (vecinos.indexOf(j) / vecinos.length) * Math.PI * 2;
    return { x: c.x + Math.cos(a) * 13, y: y + Math.sin(a) * 6, esc, giro };
  }

  // --- dibujo del mundo ---
  /** La isla del planeta: muchas manchas redondas (lado de roca, borde y superficie). */
  _dibujarSuelo(ctx, m, mapa, escala = 1) {
    const capa = (dy, extra, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const b of mapa.manchas) {
        const r = (b.r + extra) * escala;
        ctx.moveTo(b.x * escala + r, (b.y + dy) * escala);
        ctx.ellipse(b.x * escala, (b.y + dy) * escala, r, r * 0.55, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    };
    capa(30, 4, PALETA.fondo);          // sombra/contorno de abajo
    capa(24, 0, m.lado);                // roca
    capa(0, 5, m.borde);                // borde claro
    capa(0, 0, m.suelo);                // superficie
    // manchitas de textura
    ctx.fillStyle = m.suelo2;
    mapa.manchas.forEach((b, i) => {
      if (i % 3) return;
      ctx.beginPath();
      ctx.ellipse((b.x + 14) * escala, (b.y - 6) * escala, b.r * 0.4 * escala, b.r * 0.2 * escala, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Adornos de cada mundo, dibujados con rectángulos para que se vean pixelados. */
  _adorno(ctx, a, ahora) {
    const { x, y } = a;
    const R = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + px), Math.round(y + py), w, h); };
    ctx.strokeStyle = PALETA.fondo;
    ctx.lineWidth = 2;
    switch (a.tipo) {
      case 'cristal':
        R(-5, -26, 10, 26, '#7fe3ff'); R(-3, -32, 6, 6, '#7fe3ff'); R(-1, -36, 2, 4, PALETA.hielo); R(-3, -24, 2, 18, PALETA.hielo);
        R(6, -14, 6, 14, '#a9c9ff'); R(8, -18, 2, 4, '#a9c9ff');
        if (Math.sin(ahora / 300 + a.fase) > 0.8) R(-1, -40, 2, 2, PALETA.hielo);
        break;
      case 'pino':
        R(-2, -6, 4, 6, '#6b4a3a');
        R(-12, -14, 24, 8, '#2f8a6a'); R(-9, -22, 18, 8, '#2f8a6a'); R(-6, -30, 12, 8, '#2f8a6a'); R(-3, -36, 6, 6, '#2f8a6a');
        R(-12, -14, 24, 2, PALETA.hielo); R(-9, -22, 18, 2, PALETA.hielo); R(-6, -30, 12, 2, PALETA.hielo); R(-3, -36, 6, 2, PALETA.hielo);
        break;
      case 'roca': {
        const lava = this.mundo && this.mundo.id === 'lava';
        R(-10, -10, 20, 10, lava ? '#3a2226' : '#7a8ca8'); R(-7, -14, 12, 4, lava ? '#5a3a3a' : '#a6b6cc'); R(-6, -12, 4, 2, PALETA.hielo);
        if (lava) R(-2, -4, 6, 2, PALETA.naranja);
        break;
      }
      case 'arbol': {
        const mece = Math.round(Math.sin(ahora / 700 + a.fase) * 1.5);
        R(-3, -18, 6, 18, '#7a4a2a'); R(-2, -18, 2, 18, '#9a6a3a');
        R(-14 + mece, -36, 28, 18, '#2fb84a'); R(-10 + mece, -42, 20, 6, '#2fb84a'); R(-10 + mece, -36, 8, 4, '#8cf03c'); R(4 + mece, -26, 6, 4, '#1f8a3a');
        if (Math.sin(a.fase) > 0) R(6 + mece, -32, 4, 4, PALETA.rosa);
        break;
      }
      case 'hongo': {
        const c = Math.sin(ahora / 250 + a.fase) > 0 ? PALETA.rosa : '#ff9bd0';
        R(-2, -10, 4, 10, PALETA.hielo); R(-10, -16, 20, 6, c); R(-6, -19, 12, 3, c); R(-6, -15, 3, 2, PALETA.hielo); R(3, -17, 3, 2, PALETA.hielo);
        break;
      }
      case 'flor':
        R(-1, -10, 2, 10, '#1f8a3a'); R(-5, -16, 10, 6, PALETA.amarillo); R(-2, -14, 4, 2, PALETA.naranja); R(3, -6, 5, 2, '#1f8a3a');
        break;
      case 'charco': {
        const c = Math.sin(ahora / 200 + a.fase) > 0 ? PALETA.naranja : PALETA.amarillo;
        R(-14, -3, 28, 6, '#a83a22'); R(-11, -2, 22, 4, c);
        if (Math.sin(ahora / 300 + a.fase) > 0.7) R(-2, -8, 3, 3, PALETA.amarillo);
        break;
      }
      case 'volcan': {
        R(-56, -16, 112, 16, '#4a2226'); R(-44, -34, 88, 18, '#5a2a2a'); R(-32, -52, 64, 18, '#6a3030'); R(-20, -66, 40, 14, '#7a3434');
        R(-16, -70, 32, 6, PALETA.naranja); R(-10, -72, 20, 4, PALETA.amarillo);
        R(-6, -66, 6, 30, PALETA.naranja); R(4, -64, 4, 20, PALETA.amarillo); R(10, -52, 4, 22, PALETA.naranja);
        for (let i = 0; i < 4; i++) {
          const t = ((ahora / 1300 + i / 4) % 1);
          ctx.globalAlpha = 0.65 * (1 - t);
          R(-8 + Math.sin(t * 7 + i) * 8, -84 - t * 50, 10 + t * 12, 10 + t * 12, '#d9c9ff');
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'torre': {
        const h = 30 + Math.round(a.fase * 6);
        const c = [PALETA.rosa, PALETA.cian, PALETA.amarillo][Math.floor(a.fase) % 3];
        R(-10, -h, 20, h, '#2a1660'); R(-10, -h, 20, 2, c); R(-10, -h, 2, h, c);
        for (let fy = -h + 6; fy < -4; fy += 7) {
          R(-5, fy, 3, 3, Math.sin(ahora / 300 + fy + a.fase * 9) > 0 ? c : '#4a3a9a');
          R(2, fy, 3, 3, Math.sin(ahora / 340 + fy) > 0 ? PALETA.hielo : '#4a3a9a');
        }
        R(-1, -h - 8, 2, 8, '#4a3a9a'); if (Math.sin(ahora / 200 + a.fase) > 0) R(-2, -h - 10, 4, 3, PALETA.laser);
        break;
      }
      case 'cartel': {
        const on = Math.sin(ahora / 400 + a.fase) > -0.3;
        R(-2, -10, 4, 10, '#4a3a9a'); R(-16, -26, 32, 16, '#1c1147');
        ctx.strokeStyle = on ? PALETA.rosa : '#5a2a7a'; ctx.lineWidth = 2; ctx.strokeRect(Math.round(x - 16) + 1, Math.round(y - 26) + 1, 30, 14);
        if (on) Utils.texto(ctx, 'BAR', x, y - 18, { tam: 6, color: PALETA.cian });
        break;
      }
      default: break;
    }
  }

  _dibujarCasilla(ctx, c, ahora) {
    const w = this.TW / 2, h = this.TH / 2, prof = 7;
    const info = CASILLAS[c.tipo];
    const y = this._yCasilla(c, ahora);
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETA.fondo;
    ctx.fillStyle = c.tipo === 'agujero' ? PALETA.morado : PALETA.fondo;
    ctx.beginPath();
    ctx.moveTo(c.x - w, y); ctx.lineTo(c.x, y + h); ctx.lineTo(c.x + w, y);
    ctx.lineTo(c.x + w, y + prof); ctx.lineTo(c.x, y + h + prof); ctx.lineTo(c.x - w, y + prof);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.moveTo(c.x, y - h); ctx.lineTo(c.x + w, y); ctx.lineTo(c.x, y + h); ctx.lineTo(c.x - w, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PALETA.hielo;
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.moveTo(c.x, y - h + 3); ctx.lineTo(c.x + w * 0.45, y - h * 0.45); ctx.lineTo(c.x, y - h * 0.1); ctx.lineTo(c.x - w * 0.45, y - h * 0.45); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    if (c.tipo === 'portal' || c.tipo === 'agujero') {
      ctx.save();
      ctx.translate(c.x, y);
      ctx.scale(1, 0.5);
      ctx.rotate((ahora / (c.tipo === 'portal' ? 300 : -200)) % (Math.PI * 2));
      ctx.strokeStyle = c.tipo === 'portal' ? PALETA.hielo : PALETA.morado;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 1.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI, Math.PI * 2.3); ctx.stroke();
      ctx.restore();
    } else if (c.tipo === 'estrella') {
      const s = 2 + Math.abs(Math.sin(ahora / 200 + c.k)) * 2;
      ctx.fillStyle = PALETA.hielo;
      ctx.fillRect(c.x + 11, y - 9, s, s);
    }
    if (info.marca) Utils.texto(ctx, info.marca, c.x, y + 1, { tam: 7, color: info.tinta });
  }

  /** Miniatura del mapa para la pantalla de elegir mundo. */
  dibujarMiniatura(ctx, k, x, y, ancho, ahora = Date.now()) {
    const mapa = this.mapas[k], m = MUNDOS[k], c = mapa.caja;
    const esc = ancho / (c.x1 - c.x0);
    ctx.save();
    ctx.translate(x - ((c.x0 + c.x1) / 2) * esc, y - ((c.y0 + c.y1) / 2) * esc);
    this._dibujarSuelo(ctx, m, mapa, esc);
    const t = Math.floor(ahora / 90) % mapa.principales;
    mapa.casillas.forEach((cs, i) => {
      ctx.fillStyle = i === t ? PALETA.hielo : CASILLAS[cs.tipo].color;
      ctx.fillRect(cs.x * esc - 2, cs.y * esc - 1 - (i === t ? 2 : 0), 4, 3);
    });
    ctx.restore();
  }

  /** Dado de 10 caras (trapezoedro) con líneas cian. Se puede tocar para lanzar. */
  _dibujarDado(ctx) {
    const { x, y, r: R } = this.dadoPos;
    const ahora = Date.now();
    const e = ahora - this.tFase;
    let ang = 0, sx = 1;
    if (this.fase === 'rodando') {
      const p = Utils.clamp(e / 1500, 0, 1);
      ang = Utils.easeOutCubic(p) * Math.PI * 18;
      sx = Math.cos(Utils.easeOutCubic(p) * Math.PI * 14);
      if (Math.abs(sx) < 0.15) sx = 0.15 * (sx < 0 ? -1 : 1);
    }
    const j = this.actual;
    if (this.fase === 'espera' && j && !j.esBot) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(ahora / 180);
      ctx.strokeStyle = PALETA.amarillo;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, R + 8 + Math.sin(ahora / 180) * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const caida = this.fase === 'rodando' ? (1 - Utils.easeOutBounce(Utils.clamp(e / 500, 0, 1))) * -70 : 0;   // cae y rebota
    ctx.save();
    ctx.translate(x, y + caida);
    ctx.rotate(ang);
    ctx.scale(sx, 1);
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETA.cian;
    ctx.fillStyle = PALETA.fondo;
    const ext = [[0, -R], [R * 0.95, -R * 0.18], [R * 0.78, R * 0.42], [0, R], [-R * 0.78, R * 0.42], [-R * 0.95, -R * 0.18]];
    ctx.beginPath();
    ext.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const cara = [[0, -R], [R * 0.48, R * 0.1], [0, R * 0.42], [-R * 0.48, R * 0.1]];
    ctx.fillStyle = PALETA.morado;
    ctx.beginPath();
    cara.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(R * 0.48, R * 0.1); ctx.lineTo(R * 0.95, -R * 0.18);
    ctx.moveTo(R * 0.48, R * 0.1); ctx.lineTo(R * 0.78, R * 0.42);
    ctx.moveTo(-R * 0.48, R * 0.1); ctx.lineTo(-R * 0.95, -R * 0.18);
    ctx.moveTo(-R * 0.48, R * 0.1); ctx.lineTo(-R * 0.78, R * 0.42);
    ctx.moveTo(0, R * 0.42); ctx.lineTo(0, R);
    ctx.stroke();
    ctx.restore();
    const mostrar = ['rodando', 'resultado', 'saltando', 'efecto'].includes(this.fase);
    if (!mostrar) { Utils.texto(ctx, '?', x, y + 2, { tam: 11, color: PALETA.hielo }); return; }
    let k = 1;
    if (this.fase === 'resultado') {
      const p = Utils.progreso(this.tFase, 450);
      k = Utils.easeOutBack(p) * 1.4;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = PALETA.amarillo;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, Utils.lerp(12, 60, p), 0, Math.PI * 2); ctx.stroke();
      if (p < 0.25) { ctx.fillStyle = PALETA.hielo; ctx.beginPath(); ctx.arc(x, y, R + 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y + 2 + caida);
    ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
    Utils.texto(ctx, String(this.dado.mostrado), 0, 0, { tam: 13, color: PALETA.hielo, borde: PALETA.fondo });
    ctx.restore();
    if (this.fase !== 'rodando' && (this.dado.v2 || this.dado.valor > this.dado.v1)) {
      const extra = this.dado.v2 ? `${this.dado.v1}+${this.dado.v2}` : `${this.dado.v1}+3`;
      Utils.texto(ctx, extra, x, y - R - 12, { tam: 6, color: PALETA.amarillo, borde: PALETA.fondo });
    }
  }

  _posEstrella(ahora) {
    if (this.vuelo) {
      const p = Utils.progreso(this.vuelo.t0, 1200, ahora);
      const a = this.casillas[this.vuelo.desde], b = this.casillas[this.vuelo.hasta];
      if (p >= 1) this.vuelo = null;
      return { x: Utils.lerp(a.x, b.x, Utils.easeOutCubic(p)), y: Utils.lerp(a.y, b.y, Utils.easeOutCubic(p)) - Math.sin(p * Math.PI) * 120 };
    }
    const c = this.casillas[this.estrellaK];
    return { x: c.x, y: this._yCasilla(c, ahora) };
  }

  _dibujarEstrella(ctx, p, ahora) {
    const y = p.y - 36 + Math.sin(ahora / 300) * 4;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(ahora / 200);
    ctx.fillStyle = PALETA.amarillo;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(p.x - 3, y, 6, p.y - y);
    ctx.restore();
    ctx.save();
    ctx.translate(p.x, y);
    ctx.scale(Math.cos(ahora / 400), 1);
    dibujarEstrellita(ctx, 0, 0, 14, PALETA.amarillo);
    ctx.restore();
    Utils.texto(ctx, `${PRECIO_ESTRELLA}`, p.x, y + 24, { tam: 6, color: PALETA.amarillo, borde: PALETA.fondo });
  }

  /** Si la estrella no se ve, una flecha en el borde de la pantalla apunta hacia ella. */
  _flechaEstrella(ctx, ahora) {
    const e = this._posEstrella(ahora);
    const sx = this.pantalla.x + (e.x - this.cam.x) * this.cam.z, sy = this.pantalla.y + (e.y - 36 - this.cam.y) * this.cam.z;
    if (sx > 20 && sx < ANCHO - 20 && sy > 40 && sy < 320) return;
    const cx = Utils.clamp(sx, 24, ANCHO - 24), cy = Utils.clamp(sy, 46, 314);
    const ang = Math.atan2(sy - this.pantalla.y, sx - this.pantalla.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = PALETA.amarillo;
    ctx.strokeStyle = PALETA.fondo;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12 + Math.sin(ahora / 150) * 2, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    dibujarEstrellita(ctx, cx - Math.cos(ang) * 16, cy - Math.sin(ang) * 16, 6, PALETA.amarillo);
  }

  /** Panel de opciones (objetos, tienda, cruce, estrella): se toca, se hace clic o se usa la cruceta. */
  _cajasOpciones() {
    const n = this.opciones.lista.length, w = Math.min(150, 540 / n), h = 40, x0 = (ANCHO - n * w) / 2;
    return this.opciones.lista.map((it, i) => ({ x: x0 + i * w + 3, y: 262, w: w - 6, h }));
  }

  _dibujarOpciones(ctx, ahora) {
    const o = this.opciones;
    const k = Utils.easeOutBack(Utils.progreso(o.t0, 350, ahora));
    const cajas = this._cajasOpciones();
    ctx.save();
    ctx.translate(ANCHO / 2, 280);
    ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
    ctx.translate(-ANCHO / 2, -280);
    const x0 = Math.min(cajas[0].x - 8, ANCHO / 2 - 130), x1 = Math.max(cajas[cajas.length - 1].x + cajas[cajas.length - 1].w + 8, ANCHO / 2 + 130);
    Utils.panel(ctx, x0, 236, x1 - x0, 88, PALETA.fondo, PALETA.amarillo, 3);
    Utils.texto(ctx, o.titulo, ANCHO / 2, 250, { tam: 6, color: PALETA.amarillo });
    o.lista.forEach((it, i) => {
      const c = cajas[i], sel = i === o.sel;
      Utils.panel(ctx, c.x, c.y, c.w, c.h, sel ? it.color : PALETA.fondo, sel ? PALETA.hielo : it.color, sel ? 3 : 2);
      Utils.texto(ctx, it.txt, c.x + c.w / 2, c.y + 14, { tam: 5, color: sel ? PALETA.fondo : PALETA.hielo });
      Utils.texto(ctx, it.sub, c.x + c.w / 2, c.y + 28, { tam: 4, color: sel ? PALETA.fondo : it.color });
    });
    const j = this.actual;
    const solo = this.gm.hub.teclado.solo, id = j && j.id === 'local2' ? 'local2' : 'local1';
    const ayuda = `${o.lista.length > 1 ? `${nombreTecla(id, 'mover', solo)}: ELEGIR · ` : ''}${nombreTecla(id, 'A', solo)}: ${o.etiquetaA}${o.etiquetaB ? ` · ${nombreTecla(id, 'B', solo)}: ${o.etiquetaB}` : ''}`;
    Utils.texto(ctx, ayuda, ANCHO / 2, 315, { tam: 5, color: PALETA.hielo });
    ctx.restore();
  }

  dibujar(ctx) {
    const gm = this.gm;
    const ahora = Date.now();
    const m = this.mundo;

    // tinte del cielo según el mundo
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = m.cielo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.restore();

    ctx.save();
    ctx.translate(this.pantalla.x, this.pantalla.y);
    ctx.scale(this.cam.z, this.cam.z);
    ctx.translate(-this.cam.x, -this.cam.y);
    this._dibujarSuelo(ctx, m, this.mapa);
    // camino punteado (incluye los atajos)
    ctx.save();
    ctx.strokeStyle = PALETA.hielo;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -ahora / 50;
    ctx.beginPath();
    this.casillas.forEach((c) => c.sig.forEach((s) => {
      const d = this.casillas[s];
      ctx.moveTo(c.x, this._yCasilla(c, ahora) + 5);
      ctx.lineTo(d.x, this._yCasilla(d, ahora) + 5);
    }));
    ctx.stroke();
    ctx.restore();
    // casillas, adornos y personajes ordenados por profundidad
    const cosas = [];
    this.casillas.forEach((c) => cosas.push({ y: c.y, fn: () => this._dibujarCasilla(ctx, c, ahora) }));
    this.mapa.adornos.forEach((a) => cosas.push({ y: a.y, fn: () => this._adorno(ctx, a, ahora) }));
    const est = this._posEstrella(ahora);
    cosas.push({ y: est.y + 0.5, fn: () => this._dibujarEstrella(ctx, est, ahora) });
    this.orden.forEach((j) => {
      const p = this._posicion(j);
      cosas.push({ y: p.y + 1, fn: () => this._dibujarAvatar(ctx, j, p, ahora) });
    });
    cosas.sort((a, b) => a.y - b.y).forEach((c) => c.fn());
    Utils.texto(ctx, 'INICIO', this.casillas[0].x, this.casillas[0].y - 24, { tam: 5, color: PALETA.hielo, borde: PALETA.fondo });
    if (this.fase === 'cruce' && this.opciones) {                      // flechas sobre los dos caminos
      this.opciones.lista.forEach((o, i) => {
        const d = this.casillas[o.k], sel = i === this.opciones.sel;
        const y = this._yCasilla(d, ahora) - 26 + Math.sin(ahora / 150) * 3;
        ctx.fillStyle = sel ? PALETA.amarillo : PALETA.hielo;
        ctx.strokeStyle = PALETA.fondo;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(d.x - 8, y - 8); ctx.lineTo(d.x + 8, y - 8); ctx.lineTo(d.x, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    }
    for (const p of this.particulas) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); }
    for (const t of this.textos) {
      const p = Utils.progreso(t.t0, 1500, ahora);
      const k = Utils.easeOutBack(Utils.clamp(p * 4, 0, 1));
      ctx.save();
      ctx.translate(t.x, t.y - p * 22);
      ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
      Utils.texto(ctx, t.txt, 0, 0, { tam: 8, color: t.color, borde: PALETA.fondo, grosor: 4, alfa: 1 - p * p });
      ctx.restore();
    }
    ctx.restore();

    this._flechaEstrella(ctx, ahora);
    this._dibujarHud(ctx, ahora);
    this._dibujarDado(ctx);
    if (this.opciones) this._dibujarOpciones(ctx, ahora);
    if (this.fase === 'tutorial') this._dibujarTutorial(ctx, ahora);
    if (this.fase === 'intro') {
      if (this.evento && Date.now() - this.tFase > this.ms(1300)) this._cartel(ctx, this.evento.nombre, this.evento.desc, PALETA.naranja);
      else this._cartel(ctx, m.nombre, this.multi > 1 ? `RONDA ${gm.ronda} · ¡TODO VALE DOBLE!` : `RONDA ${gm.ronda} DE ${gm.rondas}`, m.cielo);
    }
    if (this.fase === 'aviso') this._cartel(ctx, '¡MINIJUEGO!', 'SUPERVIVENCIA LÁSER', PALETA.rosa);
  }

  _dibujarAvatar(ctx, j, p, ahora) {
    ctx.save();
    ctx.translate(p.x, p.y - 15);
    if (p.esc !== undefined && p.esc !== 1) { ctx.scale(Math.max(0.01, p.esc), Math.max(0.01, p.esc)); ctx.rotate(p.giro || 0); }
    ctx.fillStyle = PALETA.fondo;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.ellipse(0, 15, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    j.sprite.dibujar(ctx, 0, 0, 46, ahora, { moviendo: p.mov, mirar: p.mirar });
    ctx.restore();
    if (j.escudo) {
      ctx.save();
      ctx.strokeStyle = PALETA.cian;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(ahora / 150);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 16, 20, 24, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    dibujarBurbuja(ctx, j, p.x + 18, p.y - 46);
    if (this.salto && this.salto.j === j && !this.largo && this.pasos > 0) {        // casillas que faltan
      Utils.panel(ctx, p.x - 9, p.y - 74, 18, 14, PALETA.amarillo, PALETA.fondo, 2);
      Utils.texto(ctx, String(this.pasos), p.x, p.y - 66, { tam: 7, color: PALETA.fondo });
    }
    if (j === this.actual && this.fase !== 'aviso') {
      const by = p.y - 52 + Math.sin(ahora / 150) * 3;
      ctx.fillStyle = PALETA.amarillo;
      ctx.strokeStyle = PALETA.fondo;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x - 6, by - 7); ctx.lineTo(p.x + 6, by - 7); ctx.lineTo(p.x, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  /** Barra compacta arriba (fichas de jugadores) y franja de turno abajo. */
  _dibujarHud(ctx, ahora) {
    const n = this.orden.length;
    const w = Math.min(96, (ANCHO - 46) / Math.max(1, n));
    const x0 = (ANCHO - 30 - w * n) / 2;               // deja libre la esquina del botón de pausa
    this.orden.forEach((j, i) => {
      const x = x0 + i * w, activo = j === this.actual;
      const y = activo ? 4 : 2;
      Utils.panel(ctx, x + 2, y, w - 4, 24, activo ? j.def.color : PALETA.fondo, activo ? PALETA.hielo : j.def.color, 2);
      j.sprite.dibujar(ctx, x + 14, y + 13, 24, ahora);
      Utils.texto(ctx, j.nombre.slice(0, 7), x + 27, y + 8, { tam: 5, alin: 'left', color: activo ? PALETA.fondo : PALETA.hielo });
      ctx.fillStyle = PALETA.amarillo; ctx.fillRect(x + 27, y + 14, 4, 4);
      ctx.strokeStyle = PALETA.fondo; ctx.lineWidth = 1; ctx.strokeRect(x + 27.5, y + 14.5, 3, 3);
      Utils.texto(ctx, String(j.monedas), x + 34, y + 17, { tam: 6, alin: 'left', color: activo ? PALETA.fondo : PALETA.amarillo });
      dibujarEstrellita(ctx, x + w - 24, y + 16, 4, PALETA.amarillo);
      Utils.texto(ctx, String(j.estrellas), x + w - 18, y + 17, { tam: 6, alin: 'left', color: activo ? PALETA.fondo : PALETA.hielo });
      if (j.objetos.length) Utils.texto(ctx, 'o'.repeat(j.objetos.length), x + w - 8, y + 7, { tam: 5, alin: 'right', color: activo ? PALETA.fondo : PALETA.cian });
      if (j.escudo) { ctx.strokeStyle = PALETA.cian; ctx.lineWidth = 1; ctx.strokeRect(x + 4.5, y + 2.5, 19, 21); }
      if (j.desconectado) Utils.texto(ctx, 'SIN SEÑAL', x + w / 2, y + 22, { tam: 4, color: PALETA.laser });
    });
    Utils.panel(ctx, 6, 330, 552, 26, PALETA.fondo, PALETA.cian, 2);
    Utils.texto(ctx, `RONDA ${this.gm.ronda}/${this.gm.rondas}${this.multi > 1 ? ' X2' : ''}`, 14, 343, { tam: 6, alin: 'left', color: PALETA.amarillo });
    const j = this.actual;
    let txt = this.mundo.nombre;
    if (j && this.fase === 'espera') {
      let como = 'PENSANDO...';
      if (j.remoto) como = 'PULSA A EN TU CELULAR';
      else if (!j.esBot) {
        const solo = this.gm.hub.teclado.solo;
        como = `${nombreTecla(j.id, 'A', solo)}: LANZAR DADO${j.objetos.length ? ` · ${nombreTecla(j.id, 'B', solo)}: OBJETOS` : ''}`;
      }
      txt = `${j.nombre}: ${como}`;
    }
    Utils.texto(ctx, txt, 100, 343, { tam: 6, alin: 'left', color: PALETA.hielo });
  }

  _cartel(ctx, titulo, sub, color) {
    const k = Utils.easeOutBack(Utils.progreso(this.tFase, 500));
    ctx.save();
    ctx.translate(ANCHO / 2, ALTO / 2 - 10);
    ctx.scale(Math.max(0.001, k), Math.max(0.001, k));
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(-166, -32, 340, 72);
    Utils.panel(ctx, -170, -36, 340, 72, color, PALETA.fondo, 4);
    Utils.texto(ctx, titulo, 0, -8, { tam: 14, color: PALETA.hielo, borde: PALETA.fondo, grosor: 5 });
    Utils.texto(ctx, sub, 0, 18, { tam: 7, color: PALETA.fondo });
    ctx.restore();
  }

  alReanudar(ms) {
    this.tFase += ms;
    ['salto', 'portal', 'cambio', 'vuelo', 'opciones'].forEach((k) => { if (this[k]) this[k].t0 += ms; });
    this.textos.forEach((t) => { t.t0 += ms; });
  }

  get _botonTuto() { return { x: ANCHO / 2 - 80, y: 300, w: 160, h: 24 }; }

  _listoTuto(j) {
    if (this.listosTuto.has(j.id)) return;
    this.listosTuto.add(j.id);
    this.gm.audio.blip();
    this.gm.burbuja(j, 3);
    this.gm.difundir();
  }

  /** Tutorial del tablero: objetivo, controles y casillas. */
  _dibujarTutorial(ctx, ahora) {
    const k = Utils.easeOutBack(Utils.progreso(this.tFase, 500, ahora));
    const solo1 = !this.orden.some((j) => j.id === 'local2');
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.globalAlpha = 1;
    ctx.translate(ANCHO / 2, ALTO / 2);
    ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
    ctx.translate(-ANCHO / 2, -ALTO / 2);
    Utils.panel(ctx, 14, 10, 588, 336, PALETA.fondo, PALETA.amarillo, 4);
    Utils.texto(ctx, 'CÓMO JUGAR EL TABLERO', ANCHO / 2, 28, { tam: 11, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 4 });
    Utils.texto(ctx, 'JUNTA MONEDAS Y COMPRA ESTRELLAS (20 MONEDAS). GANA QUIEN TENGA MÁS ESTRELLAS', ANCHO / 2, 46, { tam: 5, color: PALETA.hielo });
    dibujarEstrellita(ctx, 40, 46, 7, PALETA.amarillo);
    dibujarEstrellita(ctx, 580, 46, 7, PALETA.amarillo);
    // controles
    const filas = [
      ['LANZAR EL DADO', nombreTecla('local1', 'A', solo1), 'ENTER', 'BOTÓN A', 'TOCA EL DADO'],
      ['USAR OBJETOS', nombreTecla('local1', 'B', solo1), 'SHIFT DER.', 'BOTÓN B', ''],
      ['ELEGIR (TIENDA, CAMINO)', nombreTecla('local1', 'mover', solo1), 'FLECHAS', '◄ ►', 'TOCA LA OPCIÓN'],
      ['CONFIRMAR', nombreTecla('local1', 'A', solo1), 'ENTER', 'BOTÓN A', 'TOCA OTRA VEZ'],
      ['PAUSA', 'P', 'P', '', 'BOTÓN ⏸'],
    ];
    const cx = [190, 310, 400, 470, 550];
    ['ACCIÓN', 'TECLADO J1', solo1 ? '' : 'TECLADO J2', 'CELULAR', 'RATÓN / TÁCTIL'].forEach((t, i) => {
      if (t) Utils.texto(ctx, t, i ? cx[i] : 40, 66, { tam: 4, alin: i ? 'center' : 'left', color: PALETA.cian });
    });
    filas.forEach((f, r) => {
      const y = 86 + r * 24;
      Utils.texto(ctx, f[0], 40, y, { tam: 5, alin: 'left', color: PALETA.hielo });
      tecla2(ctx, f[1], cx[1], y, PALETA.amarillo);
      if (!solo1) tecla2(ctx, f[2], cx[2], y, PALETA.rosa);
      if (f[3]) tecla2(ctx, f[3], cx[3], y, PALETA.cian);
      if (f[4]) Utils.texto(ctx, f[4], cx[4], y, { tam: 4, color: PALETA.hielo });
    });
    // casillas
    Utils.texto(ctx, 'CASILLAS', ANCHO / 2, 210, { tam: 6, color: PALETA.amarillo });
    const tipos = ['normal', 'estrella', 'trampa', 'tienda', 'cofre', 'turbo', 'portal', 'agujero', 'cambio', this.mundo.especial];
    const nombres = { normal: '+2 MONEDAS', estrella: '+5 MONEDAS', trampa: '-3 MONEDAS', tienda: 'COMPRAR OBJETOS', cofre: 'SORPRESA', turbo: 'AVANZAS 3', portal: 'TELETRANSPORTE', agujero: 'RETROCEDES 3', cambio: 'CAMBIAS DE LUGAR', hielo: 'TE DESLIZAS 2', liana: 'SALTAS 4', erupcion: 'OTROS PIERDEN 2', casino: 'GANAS 6 O PIERDES 4' };
    tipos.forEach((t, i) => {
      const x = 74 + (i % 5) * 123, y = 232 + Math.floor(i / 5) * 30;
      const info = CASILLAS[t];
      ctx.fillStyle = info.color; ctx.strokeStyle = PALETA.hielo; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 30, y - 8); ctx.lineTo(x - 16, y - 15); ctx.lineTo(x - 2, y - 8); ctx.lineTo(x - 16, y - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      Utils.texto(ctx, info.marca || (t === 'portal' ? 'O' : '@'), x - 16, y - 7, { tam: 4, color: info.tinta });
      Utils.texto(ctx, nombres[t] || t.toUpperCase(), x + 2, y - 7, { tam: 4, alin: 'left', color: PALETA.hielo });
    });
    // quién está listo
    const humanos = this.orden.filter((j) => !j.esBot);
    humanos.forEach((j, i) => {
      const x = ANCHO / 2 + (i - (humanos.length - 1) / 2) * 70, listo = this.listosTuto.has(j.id);
      Utils.panel(ctx, x - 32, 280, 64, 16, listo ? PALETA.verde : PALETA.fondo, j.def.color, 2);
      Utils.texto(ctx, listo ? `${j.nombre.slice(0, 6)} OK` : j.nombre.slice(0, 8), x, 288, { tam: 4, color: listo ? PALETA.fondo : PALETA.hielo });
    });
    const b = this._botonTuto;
    Utils.panel(ctx, b.x, b.y, b.w, b.h, PALETA.verde, PALETA.hielo, 3);
    Utils.texto(ctx, '¡ENTENDIDO! (A)', b.x + b.w / 2, b.y + 13, { tam: 7, color: PALETA.fondo });
    Utils.texto(ctx, 'CADA JUGADOR PULSA A · O TOCA EL BOTÓN · O ENTER PARA EMPEZAR YA', ANCHO / 2, 336, { tam: 4, color: PALETA.hielo });
    ctx.restore();
  }

  _accionA() {
    if (this.opciones) this._decidir(this.opciones.sel);
    else if (this.fase === 'espera') this.lanzar();
  }

  _accionB() {
    const j = this.actual;
    if (this.opciones) this._cancelar();
    else if (this.fase === 'espera' && j && j.objetos.length) this._abrirObjetos(j);
  }

  onTecla(e) {
    if (this.fase === 'tutorial') { if (e.code === 'Enter' || e.code === 'Space') { this.gm.audio.blip(); this.cambiarFase('intro'); } return; }
    const j = this.actual;
    if (!j || j.esBot) return;
    if (e.code === 'Space' || e.code === 'Enter') this._accionA();
    else if (e.code === 'Escape') this._accionB();
    else if (this.opciones && (e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !j.id.startsWith('local')) this.onDir(j, e.code === 'ArrowRight' ? 1 : -1, 0);
  }

  onBoton(j, b) {
    if (this.fase === 'tutorial') { if (b === 'A' && !j.esBot) this._listoTuto(j); return; }
    if (j !== this.actual || j.esBot) return;
    if (b === 'A') this._accionA(); else this._accionB();
  }

  onDir(j, x) {
    if (j !== this.actual || !this.opciones || !x) return;
    const n = this.opciones.lista.length;
    this.opciones.sel = (this.opciones.sel + x + n) % n;
    this.gm.audio.tono('square', 660, 660, 0.03, 0.08);
    this.gm.difundir();
  }

  onClick(x, y) {
    if (this.fase === 'tutorial') {
      const b = this._botonTuto;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.gm.audio.blip(); this.cambiarFase('intro'); }
      return;
    }
    const j = this.actual;
    if (!j || j.esBot) return;
    if (this.opciones) {
      const i = this._cajasOpciones().findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (i >= 0) { if (i === this.opciones.sel) this._decidir(i); else { this.opciones.sel = i; this.gm.difundir(); } }
      return;
    }
    const d = this.dadoPos;
    if (Math.hypot(x - d.x, y - d.y) <= d.r + 14) this.lanzar();
  }

  alSalir(j) {
    const i = this.orden.indexOf(j);
    if (i < 0) return;
    this.orden.splice(i, 1);
    if (this.salto && this.salto.j === j) this.salto = null;
    if (this.portal && this.portal.j === j) this.portal = null;
    if (this.cambio && (this.cambio.a === j || this.cambio.b === j)) this.cambio = null;
    if (!this.orden.length) { this.gm.cambiarEstado(ESTADO.LOBBY); return; }
    if (i < this.turno) this.turno--;
    else if (i === this.turno && !['intro', 'aviso'].includes(this.fase)) {
      this.siguiente = null;
      this.opciones = null;
      this.cambiarFase(this.turno >= this.orden.length ? 'aviso' : 'espera');
    }
  }
}

/* ---------- State 4: Podio ---------- */
class EstadoPodio {
  constructor(gm) { this.gm = gm; }

  entrar() {
    const gm = this.gm;
    this.confeti = [];
    this.verStats = false;
    // premios bonus al estilo party game: +1 estrella cada uno
    const js = gm.jugadores;
    const mejor = (f) => js.slice().sort((a, b) => f(b) - f(a))[0];
    this.bonus = [
      { titulo: 'MÁS VIAJERO', desc: 'EL QUE MÁS CASILLAS RECORRIÓ', f: (j) => j.stats.casillas },
      { titulo: 'REY DE MINIJUEGOS', desc: 'EL QUE MÁS MINIJUEGOS GANÓ', f: (j) => j.stats.minis },
      { titulo: 'IMÁN DE TRAMPAS', desc: 'EL QUE MÁS VECES CAYÓ EN TRAMPAS', f: (j) => j.stats.trampas },
    ].map((b) => ({ ...b, j: mejor(b.f) })).filter((b) => b.j && b.f(b.j) > 0);
    this.fase = this.bonus.length ? 'bonus' : 'podio';
    this.bonusI = 0;
    this.tb = Date.now();
    if (this.fase === 'podio') this._empezarPodio();
    gm.audio.iniciarMusica('neon');
  }

  salir() { this.gm.audio.detenerMusica(); }

  _empezarPodio() {
    const gm = this.gm;
    this.fase = 'podio';
    this.t0 = Date.now();
    this.orden = gm.jugadores.slice().sort((a, b) => b.estrellas - a.estrellas || b.monedas - a.monedas);
    this.orden.forEach((j) => j.sprite.setEstado('idle'));
    this.aterrizado = [false, false, false];
    this.escalones = [[320, 110], [230, 78], [410, 54]];
    this.retrasos = [1500, 900, 300];                    // cae primero el 3°, luego el 2° y el 1°
    this.base = 300;
    this.menu = new Menu([
      new Boton('OTRA PARTIDA', 120, 318, 140, 22, () => gm.cambiarEstado(ESTADO.LOBBY), PALETA.verde),
      new Boton('ESTADÍSTICAS', 270, 318, 140, 22, () => { this.verStats = !this.verStats; }, PALETA.cian),
      new Boton('MENÚ', 420, 318, 100, 22, () => gm.cambiarEstado(ESTADO.TITULO), PALETA.rosa),
    ], true);
    this.orden.slice(3).forEach((j) => j.sprite.setEstado('derrota'));
    // récords guardados en el navegador
    const r = gm.records, g = this.orden[0];
    r.partidas++;
    if (g) r.victorias[g.def.nombre] = (r.victorias[g.def.nombre] || 0) + 1;
    r.maxEstrellas = Math.max(r.maxEstrellas, ...this.orden.map((j) => j.estrellas));
    gm.guardarRecords();
    gm.difundir();
  }

  datosMando() { return { ranking: this.orden ? this.orden.map((j) => j.id) : null }; }

  actualizar() {
    const ahora = Date.now();
    if (this.fase === 'bonus') {
      const e = ahora - this.tb;
      const b = this.bonus[this.bonusI];
      if (!b.dado && e > 900) { b.dado = true; b.j.estrellas++; this.gm.audio.exito(); this.gm.burbuja(b.j, 3); }
      if (e > 2400) {
        this.bonusI++;
        this.tb = ahora;
        if (this.bonusI >= this.bonus.length) this._empezarPodio();
      }
      return;
    }
    for (let k = 0; k < 3; k++) {
      const j = this.orden[k];
      if (!j || this.aterrizado[k]) continue;
      if (Utils.progreso(this.t0 + this.retrasos[k], 1000, ahora) >= 1) {
        this.aterrizado[k] = true;
        j.sprite.setEstado('victoria');
        this.gm.audio.tono('square', 180, 60, 0.15, 0.2);
        if (k === 0) {
          this.gm.audio.exito();
          const colores = [PALETA.cian, PALETA.hielo, PALETA.amarillo, PALETA.rosa];
          for (let i = 0; i < 90; i++) {
            this.confeti.push({ x: Utils.azar(0, ANCHO), y: Utils.azar(-200, -10), vy: Utils.azar(0.8, 2), vx: Utils.azar(-0.5, 0.5), c: colores[i % 4], t: Utils.entero(2, 4) });
          }
        }
      }
    }
    for (const c of this.confeti) { c.y += c.vy; c.x += c.vx + Math.sin((c.y + c.x) / 20) * 0.3; }
    this.confeti = this.confeti.filter((c) => c.y < ALTO + 10);
  }

  dibujar(ctx) {
    const ahora = Date.now();
    if (this.fase === 'bonus') {
      const b = this.bonus[this.bonusI];
      const k = Utils.easeOutBack(Utils.progreso(this.tb, 500, ahora));
      Utils.texto(ctx, '¡PREMIOS BONUS!', ANCHO / 2, 30, { tam: 13, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 5 });
      ctx.save();
      ctx.translate(ANCHO / 2, 190);
      ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
      Utils.panel(ctx, -170, -120, 340, 230, PALETA.fondo, PALETA.amarillo, 4);
      Utils.texto(ctx, b.titulo, 0, -96, { tam: 11, color: PALETA.amarillo });
      Utils.texto(ctx, b.desc, 0, -76, { tam: 5, color: PALETA.hielo });
      b.j.sprite.dibujar(ctx, 0, -8, 96, ahora);
      Utils.texto(ctx, `${b.j.nombre} · ${b.f(b.j)}`, 0, 52, { tam: 8, color: b.j.def.color, borde: PALETA.fondo });
      if (b.dado) { dibujarEstrellita(ctx, -30, 82, 12, PALETA.amarillo); Utils.texto(ctx, '+1 ESTRELLA', 20, 83, { tam: 7, color: PALETA.amarillo }); }
      ctx.restore();
      return;
    }
    const e = Utils.easeOutCubic(Utils.progreso(this.t0, TRANSICION_MS));
    Utils.texto(ctx, 'PODIO', ANCHO / 2, Utils.lerp(-20, 26, e), { tam: 16, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 5 });
    const ganador = this.orden[0];
    if (ganador && this.aterrizado[0]) Utils.texto(ctx, `¡GANA ${ganador.nombre} CON ${ganador.estrellas} ESTRELLAS!`, ANCHO / 2, 52, { tam: 8, color: PALETA.cian, borde: PALETA.fondo });

    this.escalones.forEach(([x, alto], k) => {
      const j = this.orden[k];
      const top = this.base - alto;
      Utils.panel(ctx, x - 40, top, 80, alto, [PALETA.amarillo, PALETA.cian, PALETA.naranja][k], PALETA.fondo, 3);
      Utils.texto(ctx, String(k + 1), x, top + 18, { tam: 14, color: PALETA.fondo });
      if (!j) return;
      Utils.texto(ctx, j.nombre, x, top + 36, { tam: 6, color: PALETA.fondo });
      dibujarEstrellita(ctx, x - 16, top + 47, 4, PALETA.hielo);
      Utils.texto(ctx, `${j.estrellas} · ${j.monedas}M`, x + 4, top + 48, { tam: 5, color: PALETA.fondo });
      const p = Utils.easeOutBounce(Utils.progreso(this.t0 + this.retrasos[k], 1000, ahora));
      j.sprite.dibujar(ctx, x, Utils.lerp(-50, top - 14, p), 56, ahora);
    });
    this.orden.slice(3).forEach((j, i) => {
      const x = i % 2 === 0 ? 70 : 570, y = 120 + Math.floor(i / 2) * 50;
      j.sprite.dibujar(ctx, x, y, 32, ahora);
      Utils.texto(ctx, `${i + 4}. ${j.nombre}`, x, y + 22, { tam: 5 });
    });
    for (const c of this.confeti) { ctx.fillStyle = c.c; ctx.fillRect(Math.round(c.x), Math.round(c.y), c.t, c.t); }
    if (this.verStats) this._tabla(ctx);
    this.menu.botones.forEach((b) => b.dibujar(ctx, 0, 0, Utils.progreso(this.t0 + 2200, 400, ahora)));
  }

  /** Tabla de estadísticas de la partida. */
  _tabla(ctx) {
    const filas = this.orden;
    const h = 40 + filas.length * 16;
    Utils.panel(ctx, 70, 60, 500, h, PALETA.fondo, PALETA.cian, 3);
    const cols = [['JUGADOR', 90, 'left'], ['ESTR.', 250], ['MONEDAS', 310], ['CASILLAS', 380], ['MINIS', 440], ['TRAMPAS', 500], ['OBJ.', 550]];
    cols.forEach(([t, x, a]) => Utils.texto(ctx, t, x, 76, { tam: 5, alin: a || 'center', color: PALETA.amarillo }));
    filas.forEach((j, i) => {
      const y = 94 + i * 16;
      const v = [j.nombre, j.estrellas, j.monedas, j.stats.casillas, j.stats.minis, j.stats.trampas, j.stats.objetos];
      cols.forEach(([, x, a], c) => Utils.texto(ctx, String(v[c]), x, y, { tam: 5, alin: a || 'center', color: c === 0 ? j.def.color : PALETA.hielo }));
    });
  }

  onMover(x, y) { if (this.menu) this.menu.mover(x, y); }
  onClick(x, y) { if (this.menu) this.menu.click(x, y, this.gm.audio); }
  onTecla(e) { if (this.menu) this.menu.tecla(e, this.gm.audio); }
  onDir(j, x) {
    if (!this.menu || !x || (j.remoto && j.id !== this.gm.liderId())) return;
    const n = this.menu.botones.length;
    this.menu.sel = (this.menu.sel + x + n) % n;
    this.menu.marcar();
    this.gm.audio.tono('square', 660, 660, 0.03, 0.08);
  }

  onBoton(j, b) {
    if (!this.menu || b !== 'A' || (j.remoto && j.id !== this.gm.liderId())) return;
    const bt = this.menu.botones[this.menu.sel];
    if (bt && Utils.progreso(this.t0 + 2200, 400) >= 1) { this.gm.audio.blip(); bt.accion(); }
  }
}

// 9. GameManager ------------------------------------------------------------------------------------
class GameManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = new AudioManager();
    this.hub = new InputHub();
    this.hub.gm = this;
    canvas.tabIndex = 0;                                   // el canvas puede recibir el teclado
    this.transicion = new Transicion();
    this.jugadores = [];
    this.ronda = 0;
    this.sala = { codigo: '----', url: null };
    this.conectado = true;
    this.mensaje = null;
    this.sacudida = 0;
    this.contadorBots = 0;
    this.ajustes = this._leer('nebula.ajustes', { rondas: 5, bots: 'NORMAL', especiales: true, rapido: false, volumen: 0.7, musica: true, tutoriales: true });
    this.records = this._leer('nebula.records', { partidas: 0, victorias: {}, mejorLaser: 0, maxEstrellas: 0 });
    this.narracion = null;
    this.mundo = 0;               // índice del mundo elegido (MUNDOS)
    this.modo = null;             // 'solo' | 'pc' | 'celulares'
    this.botsPendientes = 0;
    this.tactil = new ControlesTactiles(this);
    this.nebulosas = [
      { x: 120, y: 90, r: 120, c: PALETA.rosa, f: 0 }, { x: 520, y: 260, r: 150, c: PALETA.cian, f: 2 },
      { x: 360, y: 40, r: 90, c: PALETA.morado, f: 4 }, { x: 60, y: 330, r: 80, c: PALETA.naranja, f: 1 },
    ];
    this.estrellas = Array.from({ length: 90 }, () => ({
      x: Math.random() * ANCHO, y: Math.random() * ALTO, v: Utils.azar(0.05, 0.4), t: Math.random() < 0.8 ? 1 : 2, f: Math.random() * 6,
    }));
    this.estados = {
      [ESTADO.TITULO]: new EstadoTitulo(this),
      [ESTADO.LOBBY]: new EstadoLobby(this),
      [ESTADO.TABLERO]: new EstadoTablero(this),
      [ESTADO.MINIJUEGO]: new SalaMinijuegos(this),
      [ESTADO.PODIO]: new EstadoPodio(this),
    };
    this.guardarAjustes();
    this._redimensionar();
    addEventListener('resize', () => this._redimensionar());
    this._eventos();
    this._red();
    this.estadoId = ESTADO.TITULO;
    this.estado = this.estados[ESTADO.TITULO];
    this.estado.entrar();
    this.acumulado = 0;
    this.ultimo = performance.now();
    requestAnimationFrame((t) => this._bucle(t));
  }

  // --- pantalla y eventos ---
  _redimensionar() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.escala = Math.min(w / ANCHO, h / ALTO);
    this.offX = (w - ANCHO * this.escala) / 2;
    this.offY = (h - ALTO * this.escala) / 2;
  }

  _aLogico(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - this.offX) / this.escala, y: (e.clientY - r.top - this.offY) / this.escala };
  }

  _eventos() {
    this.canvas.addEventListener('pointermove', (e) => {
      const p = this._aLogico(e);
      if (this.pausa) { this.pausa.ventana.onMover(p.x, p.y); return; }
      if (this.tactil.mover(e.pointerId, p)) return;
      if (!this.transicion.activa && this.estado.onMover) this.estado.onMover(p.x, p.y);
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      this.audio.iniciar();
      this.canvas.focus({ preventScroll: true });
      if (e.pointerType === 'touch') this.tactil.activo = true;
      const p = this._aLogico(e);
      if (this.pausa) { this.pausa.ventana.onClick(p.x, p.y); return; }
      const bp = this.botonPausa;
      if (this.puedePausar && p.x >= bp.x && p.x <= bp.x + bp.w && p.y >= bp.y && p.y <= bp.y + bp.h) { this.pausar(); return; }
      if (this.tactil.tomar(e.pointerId, p)) {
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
        return;
      }
      if (!this.transicion.activa && this.estado.onClick) this.estado.onClick(p.x, p.y);
    });
    ['pointerup', 'pointercancel'].forEach((ev) => this.canvas.addEventListener(ev, (e) => this.tactil.soltar(e.pointerId)));
    addEventListener('keydown', (ev) => {
      this.audio.iniciar();
      const code = codigoTecla(ev);
      const e = { code, repeat: ev.repeat };              // los estados trabajan con el código normalizado
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) ev.preventDefault();
      if (e.repeat || this.transicion.activa) return;
      if (this.pausa) { this.pausa.ventana.onTecla(e); return; }
      if (e.code === 'KeyP' && this.puedePausar) { this.pausar(); return; }
      if (this.estadoId !== ESTADO.TITULO && this.hub.teclado.ocupa(code)) return;   // ya la usa un jugador
      if (this.estado.onTecla) this.estado.onTecla(e);
    });
  }

  // --- red y jugadores ---
  _red() {
    const h = this.hub;
    h.alSolicitar = (d) => this.solicitarEntrada(d);
    h.on('sala', (d) => {
      this.sala = d;
      this._crearQR(d.url);
      const antes = this.jugadores.length;
      this.jugadores = this.jugadores.filter((j) => !j.remoto); // sala nueva: los mandos viejos ya no sirven
      if (antes !== this.jugadores.length && this.estadoId !== ESTADO.TITULO) this.cambiarEstado(ESTADO.LOBBY);
    });
    h.on('entro', () => this.difundir());
    h.on('salir', (d) => this.quitarJugador(d.id));
    h.on('conexion', (v) => { this.conectado = v; });
    h.on('input', (d) => this._input(d));
    h.conectar();
  }

  solicitarEntrada({ id, nombre, remoto, token, reconectar }, forzar = false) {
    if (token) {                                         // ¿vuelve alguien que se desconectó?
      const viejo = this.jugadores.find((j) => j.token === token && j.desconectado);
      if (viejo) {
        viejo.id = id;
        viejo.desconectado = false;
        viejo.esBot = false;
        this.aviso(`${viejo.nombre} VOLVIÓ A LA PARTIDA`);
        setTimeout(() => this.difundir(), 300);
        return { ok: true, slot: viejo.slot, personaje: viejo.def.nombre, pid: viejo.def.id, color: viejo.def.color, nombre: viejo.nombre, reconectado: true };
      }
    }
    if (reconectar) return { ok: false, error: 'La partida ya empezó' };
    if (this.estadoId !== ESTADO.LOBBY || (!forzar && this.transicion.activa)) return { ok: false, error: 'La partida ya empezó' };
    if (this.jugadores.length >= MAX_JUGADORES) return { ok: false, error: 'La sala está llena' };
    if (this.jugadores.some((j) => j.id === id)) return { ok: false, error: 'Ya estás dentro' };
    const usados = new Set(this.jugadores.map((j) => j.slot));
    let slot = 0;
    while (usados.has(slot)) slot++;
    const tomados = new Set(this.jugadores.filter((j) => !j.esBot).map((j) => j.personaje));
    let personaje = 0;
    while (tomados.has(personaje) && personaje < PERSONAJES.length - 1) personaje++;
    const def = PERSONAJES[personaje];
    this.jugadores.push({
      id, slot, def, personaje, sel: personaje, listo: false, remoto: !!remoto, esBot: false, ultimoMundo: 0, token: token || null,
      estrellas: 0, objetos: [], escudo: false, stats: { casillas: 0, trampas: 0, minis: 0, objetos: 0 }, burbuja: null,
      nombre: String(nombre || 'JUGADOR').toUpperCase().slice(0, 10),
      sprite: new SpriteAnimator(def.id),
      monedas: 0, casilla: 0,
      entrada: { x: 0, y: 0, A: false, B: false },
      unidoEn: Date.now(),
    });
    this.jugadores.sort((a, b) => a.slot - b.slot);
    this.audio.blip();
    return { ok: true, slot, personaje: def.nombre, pid: def.id, color: def.color };
  }

  /** Modo elegido en la ventana "¿Cómo quieres jugar?". */
  iniciarModo(modo, bots) {
    this.modo = modo;
    this.botsPendientes = modo === 'solo' ? bots : modo === 'pc' ? Math.min(bots, MAX_JUGADORES - 2) : 0;
    this.jugadores.filter((j) => !j.remoto).forEach((j) => this.hub.teclado.quitar(j.id));
    this.jugadores = this.jugadores.filter((j) => j.remoto && modo === 'celulares');
    this.cambiarEstado(ESTADO.LOBBY);
  }

  unirLocal(id, nombre) {
    const r = this.solicitarEntrada({ id, nombre, remoto: false }, true);
    if (r.ok) this.hub.teclado.activos.add(id);
  }

  agregarBot(forzar = false) {
    this.contadorBots++;
    const id = 'bot' + this.contadorBots;
    const nombres = ['ROBO', 'CHISPA', 'BLIP', 'COMETA', 'PIXEL', 'TURBO', 'ZAP', 'NEON'];
    const r = this.solicitarEntrada({ id, nombre: nombres[(this.contadorBots - 1) % nombres.length], remoto: false }, forzar);
    if (!r.ok) { this.aviso(r.error.toUpperCase()); return; }
    const bot = this.jugadores.find((j) => j.id === id);
    bot.esBot = true;
    bot.listo = true;
    this.difundir();
  }

  quitarJugador(id) {
    const j = this.jugadores.find((p) => p.id === id);
    if (!j) return;
    if (j.remoto && j.token && this.estadoId !== ESTADO.LOBBY && this.estadoId !== ESTADO.TITULO) {
      j.desconectado = true;                             // la partida sigue: un bot juega por él hasta que vuelva
      j.esBot = true;
      this.aviso(`${j.nombre} SE DESCONECTÓ: JUEGA UN BOT POR ÉL`);
      this.difundir();
      return;
    }
    this.jugadores = this.jugadores.filter((p) => p !== j);
    this.hub.teclado.quitar(id);
    if (this.estado.alSalir) this.estado.alSalir(j);
    this.difundir();
  }

  /** Código QR con la dirección del mando (usa qrcode.js si cargó desde internet). */
  _crearQR(url) {
    this.qr = null;
    if (!url || typeof QRCode === 'undefined') return;
    try {
      const div = document.createElement('div');
      new QRCode(div, { text: url, width: 128, height: 128, colorDark: '#1c1147', colorLight: '#ffffff' });
      setTimeout(() => { this.qr = div.querySelector('canvas') || div.querySelector('img'); }, 50);
    } catch (e) { this.qr = null; }
  }

  // --- ajustes, récords y narrador ---
  _leer(clave, base) {
    try { return Object.assign(base, JSON.parse(localStorage.getItem(clave) || '{}')); } catch (e) { return base; }
  }

  _guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ }
  }

  guardarAjustes() {
    this._guardar('nebula.ajustes', this.ajustes);
    this.audio.setVolumen(this.ajustes.volumen);
    this.audio.musicaApagada = !this.ajustes.musica;
    if (!this.ajustes.musica) this.audio.detenerMusica();
  }

  guardarRecords() { this._guardar('nebula.records', this.records); }

  get rondas() { return this.ajustes.rondas; }
  get vel() { return this.ajustes.rapido ? 0.6 : 1; }

  /** Qué tan bien juegan los bots: error (más = peor) y tiempo de reacción. */
  get dificultad() {
    return { 'FÁCIL': { error: 1.7, reaccion: 1.6 }, NORMAL: { error: 1, reaccion: 1 }, 'DIFÍCIL': { error: 0.4, reaccion: 0.55 } }[this.ajustes.bots] || { error: 1, reaccion: 1 };
  }

  narrar(tipo) {
    const lista = FRASES[tipo];
    if (lista) this.narracion = { txt: lista[Utils.entero(0, lista.length - 1)], t0: Date.now() };
  }

  burbuja(j, tipo) { if (j) j.burbuja = { tipo, t0: Date.now() }; }

  setPersonaje(j, i) {
    j.personaje = i;
    j.sel = i;
    j.def = PERSONAJES[i];
    j.sprite = new SpriteAnimator(j.def.id);
  }

  /** Los bots reciben al azar los personajes que no eligió ningún humano. */
  repartirBots() {
    const usados = new Set(this.jugadores.filter((j) => !j.esBot).map((j) => j.personaje));
    const libres = PERSONAJES.map((p, i) => i).filter((i) => !usados.has(i)).sort(() => Math.random() - 0.5);
    this.jugadores.filter((j) => j.esBot).forEach((j) => this.setPersonaje(j, libres.length ? libres.pop() : Utils.entero(0, 7)));
  }

  liderId() {
    const humano = this.jugadores.find((j) => !j.esBot);
    return humano ? humano.id : null;
  }

  reiniciarPartida() {
    this.ronda = 0;
    this.jugadores.forEach((j) => {
      j.monedas = 0;
      j.casilla = 0;
      j.ultimoMundo = 0;
      j.estrellas = 0;
      j.objetos = [];
      j.escudo = false;
      j.stats = { casillas: 0, trampas: 0, minis: 0, objetos: 0 };
      j.sprite.setEstado('idle');
    });
  }

  _input(d) {
    const j = this.jugadores.find((p) => p.id === d.id);
    if (!j || j.esBot) return;
    if (d.t === 'dir') {
      const x = Utils.clamp(Number(d.x) || 0, -1, 1), y = Utils.clamp(Number(d.y) || 0, -1, 1);
      const nuevoX = x && x !== j.entrada.x, nuevoY = y && y !== j.entrada.y;
      j.entrada.x = x;
      j.entrada.y = y;
      if ((nuevoX || nuevoY) && !this.transicion.activa && !this.pausa && this.estado.onDir) this.estado.onDir(j, nuevoX ? x : 0, nuevoY ? y : 0);
    } else if (d.t === 'emote') {
      this.burbuja(j, Number(d.e) || 0);
      this.audio.tono('triangle', 880, 1320, 0.06, 0.08);
    } else if (d.t === 'btn' && (d.b === 'A' || d.b === 'B')) {
      j.entrada[d.b] = !!d.d;
      if (d.d && !this.transicion.activa && !this.pausa && this.estado.onBoton) this.estado.onBoton(j, d.b);
    }
  }

  /** Manda a todos los mandos el estado actual (qué pantalla mostrar). */
  difundir() {
    const datos = Object.assign({
      pausa: !!this.pausa,
      lider: this.liderId(),
      jugadores: this.jugadores.map((j) => {
        const d = j.listo || this.estadoId !== ESTADO.LOBBY ? j.def : PERSONAJES[j.sel];
        return { id: j.id, nombre: j.nombre, personaje: d.nombre, pid: d.id, color: d.color, monedas: j.monedas, listo: !!j.listo,
          estrellas: j.estrellas, objetos: j.objetos.map((o) => OBJETOS[o].nombre) };
      }),
    }, this.estado && this.estado.datosMando ? this.estado.datosMando() : {});
    this.hub.enviarEstado(this.estadoId, datos);
  }

  /** Resultado del minijuego: reparte monedas y vuelve al tablero o va al podio. */
  finMinijuego(ranking) {
    const premios = [10, 5, 2];
    ranking.filter((j) => this.jugadores.includes(j)).forEach((j, i) => {
      j.monedas += premios[i] || 0;
      if (i === 0) j.stats.minis++;
    });
    if (this.ronda >= this.rondas) {
      this.cambiarEstado(ESTADO.PODIO);
    } else {
      this.ronda++;
      this.cambiarEstado(ESTADO.TABLERO);
    }
  }

  // --- estados ---
  cambiarEstado(id, tipo = 'wipe') {
    if (this.transicion.activa) return;
    this.transicion.iniciar(tipo, () => {
      if (this.estado.salir) this.estado.salir();
      this.estadoId = id;
      this.estado = this.estados[id];
      this.estado.entrar();
      this.difundir();
    });
  }

  aviso(txt) { this.mensaje = { txt, t0: Date.now() }; }

  // --- pausa ---
  get puedePausar() { return (this.estadoId === ESTADO.TABLERO || this.estadoId === ESTADO.MINIJUEGO) && !this.transicion.activa; }
  get botonPausa() { return { x: 614, y: 4, w: 22, h: 18 }; }

  pausar() {
    if (this.pausa || !this.puedePausar) return;
    this.pausa = { t0: Date.now(), ventana: new VentanaPausa(this) };
    this.musicaAntes = this.audio.musica ? this.audio.perfil : null;
    this.audio.detenerMusica();
    this.audio.blip();
    this.difundir();
  }

  reanudar() {
    if (!this.pausa) return;
    const ms = Date.now() - this.pausa.t0;
    this.pausa = null;
    if (this.estado.alReanudar) this.estado.alReanudar(ms);   // corre los relojes para que nada salte
    if (this.musicaAntes) this.audio.iniciarMusica(this.musicaAntes);
    this.difundir();
  }

  salirAlMenu() {
    this.pausa = null;
    this.audio.detenerMusica();
    this.cambiarEstado(ESTADO.TITULO);
  }

  // --- bucle ---
  _bucle(t) {
    let dt = t - this.ultimo;
    this.ultimo = t;
    if (dt > 250) dt = 250;
    this.acumulado += dt;
    while (this.acumulado >= PASO_MS) {
      if (this.estado.actualizar && !this.pausa) this.estado.actualizar();
      this._actualizarFondo();
      if (this.sacudida > 0) this.sacudida--;
      this.acumulado -= PASO_MS;
    }
    this.transicion.actualizar();
    this._dibujar();
    requestAnimationFrame((tt) => this._bucle(tt));
  }

  _actualizarFondo() {
    for (const s of this.estrellas) {
      s.x -= s.v;
      if (s.x < 0) { s.x = ANCHO; s.y = Math.random() * ALTO; }
    }
  }

  _dibujarFondo(c) {
    const ahora = Date.now();
    c.save();
    c.fillStyle = PALETA.cielo;
    c.fillRect(0, 0, ANCHO, ALTO);
    // nebulosas: círculos planos de color que respiran
    for (const n of this.nebulosas) {
      c.globalAlpha = 0.22;
      c.fillStyle = n.c;
      c.beginPath(); c.arc(n.x + Math.sin(ahora / 4000 + n.f) * 12, n.y + Math.cos(ahora / 5000 + n.f) * 8, n.r, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 0.18;
      c.beginPath(); c.arc(n.x + 30, n.y - 20, n.r * 0.55, 0, Math.PI * 2); c.fill();
    }
    // planetas
    c.globalAlpha = 1;
    const planeta = (x, y, r, color, anillo) => {
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = PALETA.hielo; c.globalAlpha = 0.35;
      c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      if (anillo) { c.strokeStyle = anillo; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, r * 1.8, r * 0.45, -0.3, 0, Math.PI * 2); c.stroke(); }
    };
    planeta(600, 44 + Math.sin(ahora / 1500) * 3, 20, PALETA.naranja, PALETA.amarillo);
    planeta(36, 200 + Math.sin(ahora / 1800) * 3, 11, PALETA.verde, null);
    planeta(470, 345, 8, PALETA.rosa, null);
    c.globalAlpha = 0.1;
    c.strokeStyle = PALETA.hielo;
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= ANCHO; x += 32) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, ALTO); }
    for (let y = 0; y <= ALTO; y += 32) { c.moveTo(0, y + 0.5); c.lineTo(ANCHO, y + 0.5); }
    c.stroke();
    for (const s of this.estrellas) {
      c.globalAlpha = 0.45 + 0.4 * Math.sin(ahora / 500 + s.f);
      c.fillStyle = s.t === 2 ? PALETA.amarillo : PALETA.hielo;
      c.fillRect(Math.round(s.x), Math.round(s.y), s.t, s.t);
    }
    c.restore();
  }

  _dibujar() {
    const c = this.ctx;
    const s = this.escala * this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PALETA.cielo;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = this.sacudida > 0 ? Utils.azar(-3, 3) : 0;
    const sy = this.sacudida > 0 ? Utils.azar(-3, 3) : 0;
    c.setTransform(s, 0, 0, s, (this.offX + sx * this.escala) * this.dpr, (this.offY + sy * this.escala) * this.dpr);
    c.imageSmoothingEnabled = false;
    c.save();
    c.beginPath();
    c.rect(0, 0, ANCHO, ALTO);
    c.clip();
    this._dibujarFondo(c);
    this.estado.dibujar(c);
    if (!this.pausa) this.tactil.dibujar(c);
    if (this.puedePausar && !this.pausa) {                  // botón de pausa (arriba a la derecha)
      const bp = this.botonPausa;
      Utils.panel(c, bp.x, bp.y, bp.w, bp.h, PALETA.fondo, PALETA.hielo, 2);
      c.fillStyle = PALETA.hielo;
      c.fillRect(bp.x + 7, bp.y + 5, 3, 8);
      c.fillRect(bp.x + 12, bp.y + 5, 3, 8);
    }
    if (this.pausa) this.pausa.ventana.dibujar(c);
    if (this.mensaje) {
      const p = Utils.progreso(this.mensaje.t0, 1800);
      if (p >= 1) this.mensaje = null;
      else Utils.texto(c, this.mensaje.txt, ANCHO / 2, 300, { tam: 7, color: PALETA.hielo, borde: PALETA.laser, alfa: 1 - p * p });
    }
    const enTutorial = this.estado.fase === 'tutorial';
    if (this.narracion && !enTutorial) {
      const p = Utils.progreso(this.narracion.t0, 2600);
      if (p >= 1) this.narracion = null;
      else {
        const k = Utils.easeOutBack(Utils.clamp(p * 6, 0, 1));
        const w = this.narracion.txt.length * 6 + 70;
        c.save();
        c.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
        c.translate(8, 34);
        c.scale(Math.max(0.01, k), Math.max(0.01, k));
        Utils.panel(c, 0, 0, w, 22, PALETA.fondo, PALETA.rosa, 2);
        Utils.texto(c, 'NARRADOR:', 8, 11, { tam: 5, alin: 'left', color: PALETA.rosa });
        Utils.texto(c, this.narracion.txt, 62, 11, { tam: 6, alin: 'left', color: PALETA.hielo });
        c.restore();
      }
    }
    if (!document.hasFocus()) {
      const a = 0.75 + 0.25 * Math.sin(Date.now() / 250);
      Utils.panel(c, 150, 166, 340, 28, PALETA.fondo, PALETA.amarillo, 3);
      Utils.texto(c, 'HAZ CLIC AQUÍ PARA USAR EL TECLADO', ANCHO / 2, 181, { tam: 7, color: PALETA.amarillo, alfa: a });
    }
    if (!this.conectado) {
      Utils.panel(c, 150, 4, 340, 20, PALETA.fondo, PALETA.laser, 2);
      Utils.texto(c, 'SIN CONEXIÓN CON EL SERVIDOR', ANCHO / 2, 15, { tam: 7, color: PALETA.laser });
    }
    this.transicion.dibujar(c);
    c.restore();
  }
}

// 10. Arranque ----------------------------------------------------------------------------------------
window.addEventListener('load', () => {
  const canvas = document.getElementById('lienzo');
  if (canvas && typeof SalaMinijuegos !== 'undefined') window.nebula = new GameManager(canvas);
});
