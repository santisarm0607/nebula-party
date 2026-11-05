/* =========================================================
   NEBULA PARTY — Sprites.js (lo usan el PC y el celular)
   Pixel art original de los 8 personajes, dibujado píxel a píxel
   en una grilla de 32x32 e inspirado en los bocetos de SantiSarm.
   Índice:
   1. Motor de pintado (cache + contorno automático)
   2. Ayudas (círculo, elipse)
   3. Dibujo de cada personaje (idle / mover / victoria, 2 cuadros)
   ========================================================= */
'use strict';

const SpritesPixel = (() => {
  // 1. Motor ---------------------------------------------------------------
  const T = 32;
  const CONTORNO = '#140b33';
  const cache = new Map();

  function crear(id, estado, f) {
    const c = document.createElement('canvas');
    c.width = T;
    c.height = T;
    const g = c.getContext('2d');
    const p = (x, y, w = 1, h = 1, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    (DIBUJOS[id] || DIBUJOS.scrap)(p, estado, f);
    contorno(g);
    return c;
  }

  /** Pone un borde oscuro de 1 píxel alrededor de todo lo pintado (look pixel art). */
  function contorno(g) {
    const img = g.getImageData(0, 0, T, T);
    const d = img.data;
    const lleno = (x, y) => x >= 0 && y >= 0 && x < T && y < T && d[(y * T + x) * 4 + 3] > 0;
    const marcar = [];
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        if (lleno(x, y)) continue;
        if (lleno(x + 1, y) || lleno(x - 1, y) || lleno(x, y + 1) || lleno(x, y - 1)) marcar.push([x, y]);
      }
    }
    g.fillStyle = CONTORNO;
    marcar.forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  }

  function obtener(id, estado, f) {
    const k = `${id}:${estado}:${f}`;
    if (!cache.has(k)) cache.set(k, crear(id, estado, f));
    return cache.get(k);
  }

  // 2. Ayudas ---------------------------------------------------------------
  /** Rellena una elipse; `color(x, y, d)` decide el color de cada píxel (d = 0 centro, 1 borde). */
  function elipse(p, cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
        if (d <= 1) { const c = color(x, y, d); if (c) p(x, y, 1, 1, c); }
      }
    }
  }

  // 3. Personajes ---------------------------------------------------------------
  const DIBUJOS = {
    /* SCRAP-E: robot de chatarra con cabeza de caja, ojos magenta y parches */
    scrap(p, e, f) {
      const base = '#6b7a90', luz = '#9aabc2', osc = '#475468', metal = '#2f3748', ojo = '#ff3fd0';
      // antena con luz que parpadea
      p(21, 0, 1, 3, metal);
      p(20, 0, 3, 1, f ? '#ffb3f0' : ojo);
      // cabeza
      p(8, 3, 16, 11, base); p(8, 3, 16, 2, luz); p(8, 13, 16, 1, osc); p(16, 3, 1, 11, osc);
      p(9, 5, 1, 1, luz); p(22, 5, 1, 1, luz); p(9, 11, 1, 1, osc);
      p(10, 6, 5, 5, '#2b1b3d'); p(18, 6, 5, 5, '#2b1b3d');
      if (e === 'idle' && f) { p(11, 8, 3, 1, ojo); p(19, 8, 3, 1, ojo); }     // parpadeo
      else { p(11, 7, 3, 3, ojo); p(19, 7, 3, 3, ojo); p(11, 7, 1, 1, '#ffd0f6'); p(19, 7, 1, 1, '#ffd0f6'); }
      p(12, 12, 8, 1, metal);
      // cuello y cuerpo con parches
      p(14, 14, 4, 1, metal);
      p(9, 15, 14, 9, base); p(9, 15, 14, 1, luz); p(9, 23, 14, 1, osc); p(21, 16, 2, 7, osc);
      p(11, 17, 4, 3, '#3fd6e0'); p(12, 18, 2, 1, '#9ff6ff');
      p(17, 19, 3, 3, '#c06bd6'); p(17, 16, 4, 1, osc);
      // brazos
      p(6, 16, 2, 6, metal); p(5, 22, 3, 2, osc);
      if (e === 'victoria') { p(24, 8 + f, 2, 8, metal); p(24, 5 + f, 3, 3, osc); }   // saluda
      else { p(24, 16, 2, 6, metal); p(24, 22, 3, 2, osc); }
      // piernas
      p(11, 24, 10, 1, metal);
      const pierna = (x, alza) => { p(x, 25, 3, 6 - alza, metal); p(x - 1, 29 - alza, 5, 2, osc); };
      if (e === 'mover') { if (f) { pierna(10, 0); pierna(19, 2); } else { pierna(12, 2); pierna(17, 0); } }
      else { pierna(11, 0); pierna(18, 0); }
    },

    /* PLASMO: orbe de plasma con rayos por dentro y un anillo cian que gira */
    plasmo(p, e, f) {
      const anilloAtras = (frente) => {
        for (let a = 0; a < 40; a++) {
          const t = (a / 40) * Math.PI * 2 + f * 0.4;
          const x = Math.round(16 + Math.cos(t) * 15), y = Math.round(16 + Math.sin(t) * 5 - Math.cos(t) * 3);
          if ((Math.sin(t) > 0) === frente) p(x, y, 1, 1, a % 3 ? '#3fe0f0' : '#c8fbff');
        }
      };
      anilloAtras(false);
      elipse(p, 16, 16, 11, 11, (x, y, d) => (d > 0.9 ? '#4b1a8f' : d > 0.65 ? '#7a2fd0' : d > 0.35 ? '#a64dff' : '#d68bff'));
      // rayos del núcleo
      const rayos = f ? [[1, 0], [-1, 1], [0, -1], [1, 1]] : [[0, 1], [-1, -1], [1, -1], [-1, 0]];
      rayos.forEach(([dx, dy]) => { for (let k = 2; k < 8; k++) p(16 + dx * k + (k % 2) * dy, 16 + dy * k + (k % 2) * dx, 1, 1, '#ffc6ff'); });
      p(14, 14, 4, 4, '#ffe6ff'); p(15, 15, 2, 2, '#ffffff');
      p(10, 9, 3, 2, '#f0d0ff'); p(9, 11, 1, 1, '#f0d0ff');
      anilloAtras(true);
      if (e === 'victoria') { [[3, 4], [27, 6], [4, 26], [28, 25]].forEach(([x, y], i) => { if ((i + f) % 2 === 0) { p(x, y - 1, 1, 3, '#ffffff'); p(x - 1, y, 3, 1, '#ffffff'); } }); }
    },

    /* ASTRO-MAX: astronauta blanco con casco de visor cian y panel en el pecho */
    astro(p, e, f) {
      const traje = '#e8f6ff', sombra = '#a9c7e0', osc = '#6d8fb3', cian = '#3fe0f0';
      p(5, 12, 4, 9, '#4ec3d6'); p(5, 19, 4, 2, '#2f8fa6');                    // mochila
      // casco
      p(11, 2, 10, 1, traje); p(10, 3, 12, 1, traje); p(9, 4, 14, 8, traje); p(10, 12, 12, 1, traje);
      p(21, 4, 2, 8, sombra);
      p(11, 5, 10, 6, '#0e5f78'); p(12, 4, 8, 1, '#0e5f78');
      p(12, 6, 3, 2, '#6ff0ff'); p(19, 9, 1, 1, '#6ff0ff');
      // cuerpo
      p(9, 13, 14, 10, traje); p(20, 13, 3, 10, sombra);
      p(12, 15, 7, 4, '#1b2e4a'); p(13, 16, 1, 1, cian); p(15, 16, 1, 1, '#ff4fa0'); p(17, 16, 1, 1, '#ffd23f'); p(13, 18, 5, 1, cian);
      p(9, 22, 14, 1, osc);
      // brazos
      p(7, 14, 2, 7, traje); p(7, 21, 2, 2, cian);
      if (e === 'victoria') { p(23, 7 + f, 2, 7, sombra); p(23, 4 + f, 3, 3, cian); }
      else { p(23, 14, 2, 7, sombra); p(23, 21, 2, 2, cian); }
      // piernas con botas
      const pierna = (x, alza) => { p(x, 23, 4, 6 - alza, traje); p(x + 3, 23, 1, 6 - alza, sombra); p(x - 1, 28 - alza, 6, 3, cian); p(x - 1, 30 - alza, 6, 1, '#1f8fa6'); };
      if (e === 'mover') { if (f) { pierna(9, 0); pierna(19, 2); } else { pierna(11, 2); pierna(17, 0); } }
      else { pierna(10, 0); pierna(18, 0); }
    },

    /* NOVA: piloto con jetpack magenta y llamas cian */
    nova(p, e, f) {
      const traje = '#f4f0ff', sombra = '#b9b0d8', mag = '#e23cc8', magOsc = '#8a1f86';
      // jetpack y llama
      p(4, 12, 5, 9, mag); p(4, 12, 5, 1, '#ff8af0'); p(4, 19, 5, 2, magOsc);
      const largo = e === 'mover' ? 6 : 3 + f;
      p(5, 21, 3, largo, '#7ff3ff'); p(6, 21, 1, largo + 1, '#ffffff');
      // casco
      p(11, 2, 10, 1, traje); p(10, 3, 12, 9, traje); p(20, 3, 2, 9, sombra);
      p(12, 5, 8, 5, '#5a1060'); p(13, 6, 2, 2, '#ff8af0'); p(18, 8, 1, 1, '#ff8af0');
      p(10, 11, 12, 1, mag);
      // cuerpo
      p(10, 12, 12, 10, traje); p(19, 12, 3, 10, sombra);
      p(15, 13, 2, 7, mag); p(12, 14, 2, 1, mag); p(18, 14, 2, 1, mag);
      p(10, 21, 12, 1, magOsc);
      // brazos (en la victoria apunta con el bláster)
      p(8, 13, 2, 7, traje); p(8, 20, 2, 2, mag);
      if (e === 'victoria') { p(22, 14, 5, 2, sombra); p(26, 13, 4, 3, '#3fe0f0'); if (f) p(30, 14, 2, 1, '#ffffff'); }
      else { p(22, 13, 2, 7, sombra); p(22, 20, 2, 2, mag); }
      const pierna = (x, alza) => { p(x, 22, 3, 6 - alza, traje); p(x, 24 - alza, 3, 2, mag); p(x - 1, 27 - alza, 5, 4, mag); p(x - 1, 30 - alza, 5, 1, magOsc); };
      if (e === 'mover') { if (f) { pierna(10, 0); pierna(19, 2); } else { pierna(12, 2); pierna(17, 0); } }
      else { pierna(11, 0); pierna(18, 0); }
    },

    /* LAIKA-X: perrita robot de lado, con visor cian y collar magenta */
    laika(p, e, f) {
      const cuerpo = '#cfe6ff', sombra = '#7fa6d6', osc = '#3b5b8f', junta = '#2a3f6b';
      // cola
      if (e === 'victoria' || f) { p(2, 8, 2, 6, sombra); p(1, 7, 2, 2, sombra); } else { p(1, 12, 5, 2, sombra); p(0, 11, 2, 2, sombra); }
      // cuerpo
      p(5, 14, 17, 7, cuerpo); p(5, 19, 17, 2, sombra); p(9, 15, 4, 3, sombra); p(14, 15, 3, 3, junta); p(15, 16, 1, 1, '#3fe0f0');
      // cabeza
      p(19, 7, 9, 8, cuerpo); p(26, 10, 5, 5, cuerpo); p(30, 11, 2, 2, osc); p(19, 13, 4, 2, sombra);
      p(20, 2, 2, 6, cuerpo); p(20, 2, 1, 2, osc); p(24, 3, 2, 5, sombra); p(25, 3, 1, 2, osc);
      p(21, 8, 7, 3, '#3fe0f0'); p(22, 8, 2, 1, '#c8fbff');
      if (e === 'victoria') p(27, 15, 3, 2, '#ff5fa2');                     // lengua afuera
      p(18, 15, 6, 2, '#e23cc8'); p(20, 17, 2, 1, '#ffd23f');
      // patas
      const pata = (x, alza) => { p(x, 21, 3, 8 - alza, sombra); p(x - 1, 28 - alza, 4, 2, osc); };
      if (e === 'mover') {
        const a = f ? [2, 0, 0, 2] : [0, 2, 2, 0];
        pata(6, a[0]); pata(10, a[1]); pata(16, a[2]); pata(20, a[3]);
      } else { pata(6, 0); pata(10, 0); pata(16, 0); pata(20, 0); }
      if (e === 'mover') { p(1 - f, 20, 2, 1, '#e23cc8'); p(0, 22, 1, 1, '#ffd23f'); }   // chispas de propulsor
    },

    /* ZORBLAX: babosa alien verde con antenas y carita feliz */
    zorblax(p, e, f) {
      const verde = '#8cf03c', luz = '#d3ff8f', osc = '#3f9b23';
      const aplasta = e === 'idle' && f ? 2 : 0;
      const salta = e === 'mover' ? (f ? 3 : 0) : 0;
      const top = 12 + aplasta - salta;
      const fondo = 31 - salta;
      // antenas
      const tallo = (x, dx) => { for (let y = top - 7; y < top + 1; y++) p(x + Math.round(((top - y) / 7) * dx), y, 1, 1, osc); p(x + dx - 1, top - 9, 3, 3, luz); };
      tallo(12, -2); tallo(20, 2);
      // cuerpo de gota (más ancho abajo)
      for (let y = top; y <= fondo; y++) {
        const t = (y - top) / (fondo - top);
        const w = Math.round(4 + Math.sin(Math.min(1, t * 1.5) * Math.PI / 2) * 6 + (t > 0.75 ? (t - 0.75) * 10 : 0) + aplasta);
        p(16 - w, y, w * 2, 1, t > 0.85 ? osc : verde);
      }
      if (e === 'mover' && f) { p(12, 31, 8, 1, '#3f9b23'); }                // gotita que cae al saltar
      p(11, top + 3, 3, 2, luz); p(10, top + 5, 1, 2, luz);
      const oy = top + 8;
      if (e === 'victoria') {                                                // ojitos felices ^ ^
        p(10, oy + 1, 1, 1, '#1c1147'); p(11, oy, 1, 1, '#1c1147'); p(12, oy + 1, 1, 1, '#1c1147');
        p(19, oy + 1, 1, 1, '#1c1147'); p(20, oy, 1, 1, '#1c1147'); p(21, oy + 1, 1, 1, '#1c1147');
        p(14, oy + 4, 4, 3, '#1c1147'); p(15, oy + 5, 2, 2, '#ff5fa2');
      } else {
        p(10, oy, 3, 3, '#1c1147'); p(19, oy, 3, 3, '#1c1147'); p(10, oy, 1, 1, '#ffffff'); p(19, oy, 1, 1, '#ffffff');
        p(14, oy + 5, 4, 1, '#1c1147'); p(13, oy + 4, 1, 1, '#1c1147'); p(18, oy + 4, 1, 1, '#1c1147');
      }
      p(8, oy + 4, 2, 1, '#ff8ad8'); p(22, oy + 4, 2, 1, '#ff8ad8');
    },

    /* OCTO-Z: pulpo ciborg rojo con manchas cian y placa de metal */
    octo(p, e, f) {
      const rojo = '#e0353b', luz = '#ff7a6b', osc = '#8a1a2a', cian = '#3fe0f0';
      // tentáculos ondulados
      const tent = (x0, dir, fase) => {
        for (let k = 0; k < 13; k++) {
          const x = x0 + Math.round(Math.sin((k + fase) / 2.4) * 2) + Math.round((k / 13) * dir * 4);
          const curl = k > 9 ? (k - 9) * dir : 0;                           // la punta se enrosca hacia afuera
          p(x + curl, 18 + k, k > 9 ? 2 : 3, 1, k === 5 ? '#9aa7bd' : rojo);
          if (k % 3 === 1 && k < 10) p(x + 1 + curl, 18 + k, 1, 1, luz);       // ventosas
        }
      };
      const fase = e === 'victoria' ? f * 4 + 2 : f * 3;
      tent(6, -1, fase); tent(11, -1, fase + 2); tent(18, 1, fase + 1); tent(23, 1, fase + 3);
      // cabeza
      elipse(p, 16, 10, 10, 8.5, (x, y, d) => (y > 14 ? osc : d > 0.85 ? osc : rojo));
      p(11, 4, 4, 2, luz); p(10, 6, 2, 1, luz);
      p(7, 8, 3, 6, '#9aa7bd'); p(8, 9, 1, 1, cian); p(8, 12, 1, 1, cian);
      [[13, 6], [19, 5], [22, 9], [16, 9], [11, 11]].forEach(([x, y]) => p(x, y, 2, 2, cian));
      // ojos
      p(11, 14, 4, 4, '#1c1147'); p(18, 14, 4, 4, '#1c1147');
      if (e === 'victoria') { p(12, 15, 2, 1, cian); p(19, 15, 2, 1, cian); }
      else { p(12, 15, 2, 2, cian); p(19, 15, 2, 2, cian); p(12, 15, 1, 1, '#ffffff'); p(19, 15, 1, 1, '#ffffff'); }
    },

    /* LIL-ZIM: alien verde en su platillo con domo de vidrio */
    zim(p, e, f) {
      const casco = '#3b3f6b', luz = '#5e66a8', osc = '#23264a';
      const inclina = e === 'mover' ? (f ? -1 : 1) : 0;
      // domo de vidrio
      elipse(p, 16, 14, 8, 9, (x, y, d) => (y > 14 ? null : d > 0.82 ? '#7fe9ff' : '#2a8fae'));
      // alien
      p(13, 7, 6, 6, '#6fe07a'); p(13, 7, 6, 1, '#a8ff9a'); p(14, 13, 4, 2, '#2f9a45');
      p(13, 9, 2, 3, '#1c1147'); p(17, 9, 2, 3, '#1c1147'); p(13, 9, 1, 1, '#ffffff'); p(17, 9, 1, 1, '#ffffff');
      p(11, 7, 2, 3, '#c8fbff');
      // platillo
      for (let y = 15; y <= 21; y++) {
        const w = Math.round(15 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 18) / 3.6, 2))));
        p(16 - w + (y < 18 ? inclina : -inclina), y, w * 2, 1, y < 17 ? luz : y > 19 ? osc : casco);
      }
      for (let i = 0; i < 6; i++) p(5 + i * 4 + inclina, 18, 2, 1, (i + f) % 2 ? '#ff5fa2' : '#ffd23f');
      p(10, 22, 12, 2, osc);
      // propulsores o rayo abductor
      if (e === 'victoria') {
        for (let y = 24; y < 32; y++) { const w = 3 + Math.floor((y - 24) / 2); p(16 - w, y, w * 2, 1, (y + f) % 2 ? '#c8fbff' : '#7ff3ff'); }
      } else {
        p(11, 24, 2, 2 + f, '#7ff3ff'); p(19, 24, 2, 3 - f, '#7ff3ff'); p(15, 24, 2, 2, '#ff5fa2');
      }
    },
  };

  return { obtener, TAM: T };
})();
