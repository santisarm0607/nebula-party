/* =========================================================
   NEBULA PARTY — Minigame.js · State 3: Sala de minijuegos
   Índice:
   1. MinijuegoBase (cuenta atrás, fin, resultados y chispas)
   2. Supervivencia Láser
   3. Lluvia de Estrellas
   4. Carrera de Cohetes
   5. Duelo de Reflejos
   6. Rey de la Plataforma
   7. Memoria Cósmica
   8. SalaMinijuegos (ruleta + instrucciones + juego)
   Todo se mide en frames a 60 FPS fijos (paso fijo del GameManager).
   ========================================================= */
'use strict';

const ARENA = Object.freeze({ x: 16, y: 34, w: 608, h: 312 });
const PREMIOS = Object.freeze([10, 5, 2]);

// 0. Ayudas del tutorial -------------------------------------------------------------------
/** Texto de cada control según quién juega: J1 (teclado), J2 (teclado) y celular. */
function textoControl(tipo, solo1) {
  const cel = { mover: 'CRUCETA', A: 'BOTÓN A', B: 'BOTÓN B', AB: 'A Y B' }[tipo];
  return [nombreTecla('local1', tipo, solo1), nombreTecla('local2', tipo, false), cel];
}

/** Marca para saber quién es quién: aro de color en el piso y etiqueta TÚ / J1 / J2 con flecha. */
function marcaJugador(ctx, j, x, y, ahora = Date.now()) {
  const humano = !j.esBot || j.desconectado;
  ctx.save();
  ctx.globalAlpha = humano ? 0.9 : 0.35;
  ctx.strokeStyle = j.def.color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y + 18, 15, 5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (!humano) { Utils.texto(ctx, j.nombre, x, y - 26, { tam: 4, color: PALETA.hielo, alfa: 0.6 }); return; }
  let etiqueta = j.nombre, color = j.def.color;
  if (j.id === 'local1') { etiqueta = j.nombre === 'TÚ' ? 'TÚ' : 'J1'; color = PALETA.amarillo; }
  else if (j.id === 'local2') { etiqueta = 'J2'; color = PALETA.rosa; }
  const by = y - 32 + Math.sin(ahora / 160) * 2;
  ctx.fillStyle = color; ctx.strokeStyle = PALETA.fondo; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 5, by - 6); ctx.lineTo(x + 5, by - 6); ctx.lineTo(x, by); ctx.closePath(); ctx.fill(); ctx.stroke();
  Utils.texto(ctx, etiqueta, x, by - 12, { tam: 6, color, borde: PALETA.fondo, grosor: 3 });
}

/** Texto que sube y se desvanece (+1, ¡TURBO!, etc.). */
function textoFlotante(lista, txt, x, y, color) { lista.push({ txt, x, y, color, vida: 45 }); }

/** Dibuja una tecla como un botón con relieve. */
function tecla(ctx, txt, x, y, color = PALETA.hielo) {
  const w = Math.max(26, txt.length * 7 + 14);
  ctx.fillStyle = PALETA.fondo;
  ctx.fillRect(x - w / 2 + 2, y - 9, w, 21);
  Utils.panel(ctx, x - w / 2, y - 11, w, 21, color, PALETA.fondo, 2);
  Utils.texto(ctx, txt, x, y, { tam: 6, color: PALETA.fondo });
  return w;
}

/** Mini mando que se ilumina con lo que pulsa cada jugador (para probar las teclas). */
function probarMando(ctx, j, x, y, listo) {
  const e = j.entrada || {};
  Utils.panel(ctx, x - 38, y - 30, 76, 62, listo ? PALETA.verde : PALETA.fondo, listo ? PALETA.hielo : j.def.color, 2);
  j.sprite.dibujar(ctx, x - 22, y - 12, 26);
  Utils.texto(ctx, j.nombre.slice(0, 8), x + 8, y - 22, { tam: 4, color: listo ? PALETA.fondo : PALETA.hielo });
  // cruceta
  const cx = x - 18, cy = y + 14;
  [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => {
    const on = (dx && e.x === dx) || (dy && e.y === dy);
    ctx.fillStyle = on ? PALETA.amarillo : PALETA.azul;
    ctx.fillRect(cx + dx * 6 - 3, cy + dy * 6 - 3, 6, 6);
  });
  // botones A y B
  [['A', 18, e.A, PALETA.amarillo], ['B', 6, e.B, PALETA.rosa]].forEach(([t, dx, on, c]) => {
    ctx.fillStyle = on ? PALETA.hielo : c;
    ctx.beginPath(); ctx.arc(x + dx, y + (t === 'A' ? 8 : 18), 6, 0, Math.PI * 2); ctx.fill();
    Utils.texto(ctx, t, x + dx, y + (t === 'A' ? 9 : 19), { tam: 4, color: PALETA.fondo });
  });
  Utils.texto(ctx, listo ? '¡LISTO!' : 'PULSA A', x + 14, y - 8, { tam: 4, color: listo ? PALETA.fondo : PALETA.amarillo });
}

// 1. Base ----------------------------------------------------------------------------
class MinijuegoBase {
  constructor(gm) { this.gm = gm; }

  preparar() {
    this.frame = 0;
    this.frameJuego = 0;
    this.fase = 'cuenta';
    this.ultimaCuenta = 0;
    this.ranking = null;
    this.entregado = false;
    this.chispas = [];
    this.flotantes = [];
    this.flash = 0;
    this.gm.jugadores.forEach((j) => { j.entrada = { x: 0, y: 0, A: false, B: false }; j.sprite.setEstado('idle'); });
    this.iniciar();
  }

  get dif() { return this.gm.dificultad; }
  get info() { return this.constructor; }

  actualizar() {
    this.frame++;
    if (this.fase === 'cuenta') {
      const seg = 3 - Math.floor(this.frame / 60);
      if (seg > 0 && seg !== this.ultimaCuenta) { this.ultimaCuenta = seg; this.gm.audio.tono('square', 330, 330, 0.08, 0.15); }
      if (this.frame >= 180) {
        this.fase = 'juego';
        this.gm.audio.blip();
        this.gm.audio.iniciarMusica('minijuego');
        if (this.alEmpezar) this.alEmpezar();
      }
      if (this.pasoCuenta) this.pasoCuenta();
    } else if (this.fase === 'juego') {
      this.frameJuego++;
      this.paso();
    } else if (this.fase === 'fin' && !this.entregado && this.frame - this.frameFin > 210) {
      this.entregado = true;
      this.gm.finMinijuego(this.ranking);
    }
    for (const ch of this.chispas) { ch.x += ch.vx; ch.y += ch.vy; ch.vy += 0.08; ch.vida--; }
    this.chispas = this.chispas.filter((ch) => ch.vida > 0);
    for (const f of this.flotantes) { f.y -= 0.6; f.vida--; }
    this.flotantes = this.flotantes.filter((f) => f.vida > 0);
    if (this.flash > 0) this.flash--;
  }

  /** Termina el minijuego con los jugadores ordenados del 1° al último. */
  terminar(ranking, notas = {}) {
    if (this.fase === 'fin') return;
    this.ranking = ranking.filter((j) => this.gm.jugadores.includes(j));
    this.notas = notas;
    this.fase = 'fin';
    this.frameFin = this.frame;
    this.gm.audio.detenerMusica();
    this.gm.audio.exito();
    if (this.ranking[0]) { this.ranking[0].sprite.setEstado('victoria'); this.gm.burbuja(this.ranking[0], 3); }
    this.gm.difundir();
  }

  chispazo(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) this.chispas.push({ x, y, vx: Utils.azar(-2.5, 2.5), vy: Utils.azar(-3, 0.5), vida: Utils.entero(20, 40), color: i % 2 ? PALETA.hielo : color });
  }

  encabezado(ctx, derecha) {
    Utils.texto(ctx, this.info.nombre, ARENA.x, 18, { tam: 8, alin: 'left', color: PALETA.amarillo, borde: PALETA.fondo });
    if (derecha) Utils.texto(ctx, derecha, ARENA.x + ARENA.w - 30, 18, { tam: 7, alin: 'right', color: PALETA.cian, borde: PALETA.fondo });
  }

  fondoArena(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.info.color || PALETA.cian;
    ctx.strokeRect(ARENA.x - 1, ARENA.y - 1, ARENA.w + 2, ARENA.h + 2);
  }

  dibujar(ctx) {
    this.pintar(ctx);
    for (const ch of this.chispas) { ctx.fillStyle = ch.color; ctx.fillRect(Math.round(ch.x), Math.round(ch.y), 3, 3); }
    for (const f of this.flotantes) Utils.texto(ctx, f.txt, f.x, f.y, { tam: 7, color: f.color, borde: PALETA.fondo, grosor: 3, alfa: Math.min(1, f.vida / 20) });
    if (this.flash > 0) { ctx.save(); ctx.globalAlpha = this.flash / 14; ctx.fillStyle = PALETA.hielo; ctx.fillRect(0, 0, ANCHO, ALTO); ctx.restore(); }
    if (this.fase === 'cuenta') {
      const seg = 3 - Math.floor(this.frame / 60);
      const k = Utils.easeOutBack(Math.min(1, (this.frame % 60) / 30));
      ctx.save();
      ctx.translate(ANCHO / 2, ALTO / 2 - 20);
      ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
      Utils.texto(ctx, String(Math.max(1, seg)), 0, 0, { tam: 40, borde: PALETA.azul, grosor: 6 });
      ctx.restore();
      const solo = this.gm.hub.teclado.solo;
      const linea = this.info.tuto.map(([accion, tipo]) => `${accion}: ${nombreTecla('local1', tipo, solo)}`).join('  ·  ');
      Utils.texto(ctx, linea, ANCHO / 2, ALTO / 2 + 30, { tam: 6, color: PALETA.amarillo, borde: PALETA.fondo });
      if (!solo) Utils.texto(ctx, this.info.tuto.map(([accion, tipo]) => `J2 ${accion}: ${nombreTecla('local2', tipo, false)}`).join('  ·  '), ANCHO / 2, ALTO / 2 + 46, { tam: 5, color: PALETA.rosa, borde: PALETA.fondo });
    } else if (this.fase === 'juego' && this.frameJuego < 40) {
      Utils.texto(ctx, '¡YA!', ANCHO / 2, ALTO / 2 - 20, { tam: 30, borde: PALETA.azul, grosor: 6, alfa: 1 - this.frameJuego / 40 });
    }
    if (this.fase === 'fin' && this.ranking) this._resultados(ctx);
  }

  _resultados(ctx) {
    const k = Utils.easeOutBack(Utils.clamp((this.frame - this.frameFin) / 30, 0, 1));
    const filas = this.ranking.slice(0, 8);
    const h = 54 + filas.length * 18;
    ctx.save();
    ctx.translate(ANCHO / 2, ALTO / 2);
    ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
    Utils.panel(ctx, -160, -h / 2, 320, h, PALETA.fondo, PALETA.cian, 3);
    Utils.texto(ctx, '¡FIN DEL MINIJUEGO!', 0, -h / 2 + 20, { tam: 9, color: PALETA.cian });
    filas.forEach((j, i) => {
      const y = -h / 2 + 46 + i * 18;
      j.sprite.dibujar(ctx, -136, y - 1, 18);
      Utils.texto(ctx, `${i + 1}. ${j.nombre}`, -124, y, { tam: 7, alin: 'left', color: j.esBot ? PALETA.hielo : PALETA.amarillo });
      if (this.notas[j.id] !== undefined) Utils.texto(ctx, String(this.notas[j.id]), 60, y, { tam: 6, alin: 'right', color: PALETA.hielo });
      if (PREMIOS[i]) Utils.texto(ctx, `+${PREMIOS[i]}`, 130, y, { tam: 7, alin: 'right', color: PALETA.amarillo });
    });
    ctx.restore();
  }

  onBoton() {}
  onDir() {}
  alSalir(j) { if (this.corredores) this.corredores = this.corredores.filter((c) => c.j !== j); }
}

// 2. Supervivencia Láser --------------------------------------------------------------------
class LaserMinigame extends MinijuegoBase {
  static nombre = 'SUPERVIVENCIA LÁSER';
  static instrucciones = ['ESQUIVA LOS LÁSERES PASANDO POR LOS HUECOS', 'EL ÚLTIMO EN PIE GANA'];
  static controles = 'CRUCETA: MOVER · A: IMPULSO · B: PRECISIÓN';
  static color = PALETA.laser;
  static tuto = [['MOVERTE', 'mover'], ['IMPULSO RÁPIDO', 'A'], ['IR LENTO (MANTENER)', 'B']];

  /** Animación de ejemplo: un personaje se mete por el hueco del láser. */
  static demo(ctx, x, y, w, h, t, sp) {
    const ly = y + ((t / 12) % (h + 20)) - 10;
    const hx = x + w * 0.6;
    ctx.fillStyle = PALETA.laser;
    ctx.fillRect(x, ly - 2, hx - 16 - x, 4);
    ctx.fillRect(hx + 16, ly - 2, x + w - hx - 16, 4);
    const px = ly > y + h - 50 ? hx : Utils.lerp(x + 30, hx, Utils.clamp((ly - y) / (h - 50), 0, 1));
    sp.dibujar(ctx, px, y + h - 22, 34, Date.now(), { moviendo: true, mirar: 1 });
  }

  iniciar() {
    const n = this.gm.jugadores.length, A = ARENA;
    this.corredores = this.gm.jugadores.map((j, i) => ({
      j, x: A.x + (A.w * (i + 1)) / (n + 1), y: A.y + A.h - 40,
      vivo: true, muerte: -1, dashHasta: 0, dashListo: 0, laserObjetivo: null, huecoObjetivo: null, errorX: 0, reaccion: 0,
    }));
    this.lasers = [];
    this.barridos = [];
    this.aviso = null;
    this.ultimoHueco = A.x + A.w / 2;
  }

  get velocidad() { return 3 + 0.5 * Math.floor(this.frameJuego / 300); }   // +0.5 px/frame cada 5 s

  pasoCuenta() { this._moverJugadores(); }

  paso() {
    this._generarLasers();
    const v = this.velocidad, limite = ARENA.y + ARENA.h + 6;
    for (const l of this.lasers) l.y += v;
    this.lasers = this.lasers.filter((l) => l.y < limite);
    // desde los 15 s, cada 7 s pasa un láser vertical (con 1 s de aviso)
    if (this.frameJuego > 900 && this.frameJuego % 420 === 0) {
      const izq = Math.random() < 0.5;
      this.barridos.push({ x: izq ? ARENA.x + 4 : ARENA.x + ARENA.w - 4, dir: izq ? 1 : -1, v: 1.7 + this.frameJuego / 3000, aviso: 60 });
      this.gm.audio.tono('square', 200, 400, 0.3, 0.08);
    }
    for (const b of this.barridos) { if (b.aviso > 0) b.aviso--; else b.x += b.dir * b.v; }
    this.barridos = this.barridos.filter((b) => b.x > ARENA.x - 4 && b.x < ARENA.x + ARENA.w + 4);
    this._moverJugadores();
    this._colisiones();
    this._revisarFin();
  }

  _generarLasers() {
    const A = ARENA;
    if (this.aviso) {                                     // el láser avisado entra después de 45 frames
      if (this.frameJuego - this.aviso.desde >= 45) { this.lasers.push({ y: A.y, huecos: this.aviso.huecos }); this.aviso = null; }
      return;
    }
    const ultimo = this.lasers[this.lasers.length - 1];
    if (ultimo && ultimo.y - A.y < 150 - 45 * this.velocidad) return;   // el aviso dura 45 frames: misma distancia que antes
    const ancho = Math.max(44, 66 - Math.floor(this.frameJuego / 600) * 4);
    const min = A.x + ancho / 2 + 4, max = A.x + A.w - ancho / 2 - 4;
    const cx = Utils.clamp(this.ultimoHueco + Utils.azar(-150, 150), min, max);
    this.ultimoHueco = cx;
    const huecos = [{ x: cx - ancho / 2, w: ancho }];
    if (Math.random() < 0.45) {
      const otro = cx < A.x + A.w / 2 ? Utils.azar(cx + 180, max) : Utils.azar(min, cx - 180);
      if (otro >= min && otro <= max) huecos.push({ x: otro - ancho / 2, w: ancho });
    }
    huecos.sort((a, b) => a.x - b.x);
    this.aviso = { huecos, desde: this.frameJuego };
  }

  _moverJugadores() {
    const A = ARENA;
    for (const c of this.corredores) {
      if (!c.vivo) continue;
      let ix, iy, dash, lento;
      if (c.j.esBot) ({ ix, iy, dash, lento } = this._ia(c));
      else ({ x: ix, y: iy, A: dash, B: lento } = c.j.entrada);
      const largo = Math.hypot(ix, iy);
      if (largo > 1) { ix /= largo; iy /= largo; }
      if (dash && this.frame >= c.dashListo && (ix || iy)) {
        c.dashHasta = this.frame + 12;
        c.dashListo = this.frame + 60;
        this.gm.audio.tono('square', 660, 990, 0.05, 0.08);
      }
      const v = 3 * (this.frame < c.dashHasta ? 2.4 : 1) * (lento ? 0.5 : 1);
      c.mov = !!(ix || iy);
      if (ix) c.mirar = ix < 0 ? -1 : 1;
      c.x = Utils.clamp(c.x + ix * v, A.x + 8, A.x + A.w - 8);
      c.y = Utils.clamp(c.y + iy * v, A.y + 8, A.y + A.h - 8);
    }
  }

  _ia(c) {
    const yBase = ARENA.y + ARENA.h - 50;
    const iy = Math.abs(yBase - c.y) > 6 ? Math.sign(yBase - c.y) * 0.5 : 0;
    let objetivo = null;
    for (const l of this.lasers) if (l.y < c.y + 2 && (!objetivo || l.y > objetivo.y)) objetivo = l;
    if (!objetivo) return { ix: 0, iy, dash: false, lento: false };
    if (c.laserObjetivo !== objetivo) {
      c.laserObjetivo = objetivo;
      c.huecoObjetivo = objetivo.huecos.reduce((m, h) => (Math.abs(h.x + h.w / 2 - c.x) < Math.abs(m.x + m.w / 2 - c.x) ? h : m));
      const w = c.huecoObjetivo.w;
      c.errorX = Math.random() < 0.18 * this.dif.error ? Utils.azar(-0.6, 0.6) * w : Utils.azar(-0.15, 0.15) * w;
      c.reaccion = this.frame + Math.round(Utils.entero(4, 16) * this.dif.reaccion);
    }
    if (this.frame < c.reaccion) return { ix: 0, iy, dash: false, lento: false };
    const dx = c.huecoObjetivo.x + c.huecoObjetivo.w / 2 + c.errorX - c.x;
    const r = { ix: Math.abs(dx) > 3 ? Math.sign(dx) : 0, iy, dash: Math.abs(dx) > 140, lento: Math.abs(dx) < 10 };
    for (const b of this.barridos) if (!b.aviso && Math.abs(b.x - c.x) < 60 && Math.sign(c.x - b.x) === b.dir && Math.random() > 0.2 * this.dif.error) { r.ix = b.dir; r.dash = true; }
    return r;
  }

  _colisiones() {
    for (const c of this.corredores) {
      if (!c.vivo) continue;
      const golpeVertical = this.barridos.some((b) => !b.aviso && Math.abs(b.x - c.x) < 8);
      for (const l of [...this.lasers, ...(golpeVertical ? [{ y: c.y, huecos: [] }] : [])]) {
        if (Math.abs(l.y - c.y) > 8) continue;
        if (!l.huecos.some((h) => c.x - 6 >= h.x && c.x + 6 <= h.x + h.w)) {
          c.vivo = false;
          c.muerte = this.frameJuego;
          c.j.sprite.setEstado('derrota');
          this.gm.audio.derrota();
          this.gm.sacudida = 10;
          this.gm.hub.enviarA(c.j.id, 'vibrar', [120, 60, 120]);
          this.gm.burbuja(c.j, 4);
          this.chispazo(c.x, c.y, PALETA.laser, 14);
          break;
        }
      }
    }
  }

  _revisarFin() {
    const vivos = this.corredores.filter((c) => c.vivo);
    const total = this.corredores.length;
    if (total === 0 || (total > 1 && vivos.length > 1) || (total === 1 && vivos.length === 1)) return;
    const r = this.gm.records;
    if (this.frameJuego > r.mejorLaser) { r.mejorLaser = this.frameJuego; this.gm.guardarRecords(); this.gm.aviso('¡NUEVO RÉCORD DE LÁSER!'); }
    const muertos = this.corredores.filter((c) => !c.vivo).sort((a, b) => b.muerte - a.muerte);
    const notas = {};
    this.corredores.forEach((c) => { notas[c.j.id] = `${((c.vivo ? this.frameJuego : c.muerte) / 60).toFixed(1)}S`; });
    this.terminar([...vivos, ...muertos].map((c) => c.j), notas);
  }

  pintar(ctx) {
    const A = ARENA, ahora = Date.now();
    this.fondoArena(ctx);
    const vivos = this.corredores.filter((c) => c.vivo).length;
    this.encabezado(ctx, `${(this.frameJuego / 60).toFixed(1)} S · VEL ${this.velocidad.toFixed(1)} · VIVOS ${vivos}`);
    for (const l of this.lasers) {
      const y = Math.round(l.y);
      let x0 = A.x;
      const tramos = [];
      for (const h of l.huecos) { tramos.push([x0, h.x]); x0 = h.x + h.w; }
      tramos.push([x0, A.x + A.w]);
      for (const [a, b] of tramos) {
        if (b <= a) continue;
        ctx.fillStyle = PALETA.laser;
        ctx.fillRect(a, y - 2, b - a, 4);
        if (this.frame % 4 < 2) { ctx.fillStyle = PALETA.hielo; ctx.fillRect(a, y - 0.5, b - a, 1); }
      }
      ctx.fillStyle = PALETA.cian;
      for (const h of l.huecos) { ctx.fillRect(h.x - 3, y - 4, 3, 8); ctx.fillRect(h.x + h.w, y - 4, 3, 8); }
    }
    // aviso del próximo láser: parpadea arriba y marca los huecos con flechas verdes
    if (this.aviso && Math.floor(this.frame / 6) % 2) {
      ctx.fillStyle = PALETA.laser;
      let x0 = A.x;
      for (const h of this.aviso.huecos) { ctx.fillRect(x0, A.y + 2, h.x - x0, 2); x0 = h.x + h.w; }
      ctx.fillRect(x0, A.y + 2, A.x + A.w - x0, 2);
      for (const h of this.aviso.huecos) {
        ctx.fillStyle = PALETA.verde;
        const cx = h.x + h.w / 2;
        ctx.beginPath(); ctx.moveTo(cx - 8, A.y + 6); ctx.lineTo(cx + 8, A.y + 6); ctx.lineTo(cx, A.y + 16); ctx.closePath(); ctx.fill();
      }
    }
    // láseres verticales
    for (const b of this.barridos) {
      if (b.aviso > 0) {
        if (Math.floor(b.aviso / 6) % 2) { ctx.fillStyle = PALETA.laser; for (let y = A.y; y < A.y + A.h; y += 12) ctx.fillRect(b.x - 1, y, 2, 6); }
        Utils.texto(ctx, b.dir > 0 ? '►►' : '◄◄', b.x + b.dir * 16, A.y + A.h / 2, { tam: 8, color: PALETA.laser, borde: PALETA.fondo });
      } else {
        ctx.fillStyle = PALETA.laser; ctx.fillRect(b.x - 3, A.y, 6, A.h);
        ctx.fillStyle = PALETA.hielo; ctx.fillRect(b.x - 1, A.y, 2, A.h);
      }
    }
    for (const c of this.corredores) {
      if (c.vivo && this.frame < c.dashHasta) { ctx.strokeStyle = PALETA.cian; ctx.lineWidth = 1; ctx.strokeRect(c.x - 12.5, c.y - 12.5, 25, 25); }
      if (c.vivo) marcaJugador(ctx, c.j, c.x, c.y, ahora);
      c.j.sprite.dibujar(ctx, c.x, c.y, 44, ahora, { moviendo: c.vivo && c.mov, mirar: c.mirar || 1 });
      dibujarBurbuja(ctx, c.j, c.x + 16, c.y - 30);
    }
  }
}

// 3. Lluvia de Estrellas ------------------------------------------------------------------------
class EstrellasMinigame extends MinijuegoBase {
  static nombre = 'LLUVIA DE ESTRELLAS';
  static instrucciones = ['ATRAPA ESTRELLAS (+1) Y COMETAS (+3). SEGUIDAS VALEN X2 Y X3', 'EL IMÁN LAS ATRAE. ¡CUIDADO CON LOS METEORITOS!'];
  static controles = 'CRUCETA: MOVER · A: IMPULSO';
  static color = PALETA.amarillo;
  static tuto = [['MOVERTE', 'mover'], ['IMPULSO RÁPIDO', 'A']];

  static demo(ctx, x, y, w, h, t, sp) {
    const k = (t % 2400) / 2400;
    const sx = x + w * 0.3 + Math.sin(k * Math.PI * 2) * w * 0.25;
    ctx.save(); ctx.translate(x + w * 0.3 + Math.sin(k * Math.PI * 2 + 0.5) * w * 0.25, y + 10 + k * (h - 40)); dibujarEstrellita(ctx, 0, 0, 7, PALETA.amarillo); ctx.restore();
    ctx.fillStyle = '#7a3434'; ctx.beginPath(); ctx.arc(x + w * 0.8, y + ((t / 10) % h), 7, 0, Math.PI * 2); ctx.fill();
    sp.dibujar(ctx, sx, y + h - 22, 34, Date.now(), { moviendo: true });
  }

  iniciar() {
    const n = this.gm.jugadores.length;
    this.corredores = this.gm.jugadores.map((j, i) => ({ j, x: ARENA.x + (ARENA.w * (i + 1)) / (n + 1), y: ARENA.y + ARENA.h - 40, puntos: 0, aturdido: 0, dashHasta: 0, dashListo: 0, combo: 0, ultimaToma: -999, iman: 0 }));
    this.cosas = [];
    this.duracion = 30 * 60;
  }

  paso() {
    // aparecen cosas cada vez más seguido
    const ritmo = Math.max(10, 26 - Math.floor(this.frameJuego / 240) * 2);
    if (this.frameJuego % ritmo === 0) {
      const r = Math.random();
      const tipo = r < 0.04 ? 'iman' : r < 0.14 ? 'cometa' : r < 0.38 ? 'meteoro' : 'estrella';
      this.cosas.push({ tipo, x: Utils.azar(ARENA.x + 16, ARENA.x + ARENA.w - 16), y: ARENA.y - 10, v: tipo === 'meteoro' ? Utils.azar(2.4, 3.6) : Utils.azar(1.4, 2.4), giro: Math.random() * 6 });
    }
    for (const o of this.cosas) {
      o.y += o.v;
      // el imán atrae estrellas y cometas cercanos
      for (const c of this.corredores) {
        if (c.iman > this.frameJuego && o.tipo !== 'meteoro' && o.tipo !== 'iman' && Math.hypot(o.x - c.x, o.y - c.y) < 130) {
          o.x += Math.sign(c.x - o.x) * 2.2; o.y += Math.sign(c.y - o.y) * 1.2;
        }
      }
    }
    this.cosas = this.cosas.filter((o) => o.y < ARENA.y + ARENA.h + 10 && !o.tomada);
    for (const c of this.corredores) {
      let ix = 0, iy = 0, dash = false;
      if (c.aturdido > 0) c.aturdido--;
      else if (c.j.esBot) ({ ix, iy, dash } = this._ia(c));
      else ({ x: ix, y: iy, A: dash } = c.j.entrada);
      const L = Math.hypot(ix, iy);
      if (L > 1) { ix /= L; iy /= L; }
      if (dash && this.frame >= c.dashListo && (ix || iy)) { c.dashHasta = this.frame + 10; c.dashListo = this.frame + 50; }
      const v = 3.2 * (this.frame < c.dashHasta ? 2.2 : 1);
      c.mov = !!(ix || iy);
      if (ix) c.mirar = ix < 0 ? -1 : 1;
      c.x = Utils.clamp(c.x + ix * v, ARENA.x + 10, ARENA.x + ARENA.w - 10);
      c.y = Utils.clamp(c.y + iy * v, ARENA.y + 60, ARENA.y + ARENA.h - 10);
      for (const o of this.cosas) {
        if (o.tomada || Math.hypot(o.x - c.x, o.y - c.y) > 18) continue;
        o.tomada = true;
        if (o.tipo === 'meteoro') {
          c.puntos = Math.max(0, c.puntos - 2);
          c.aturdido = 60;
          this.gm.audio.derrota();
          this.gm.burbuja(c.j, 2);
          this.gm.hub.enviarA(c.j.id, 'vibrar', [100, 50, 100]);
          this.chispazo(o.x, o.y, PALETA.naranja);
        } else if (o.tipo === 'iman') {
          c.iman = this.frameJuego + 300;
          textoFlotante(this.flotantes, '¡IMÁN!', c.x, c.y - 30, PALETA.morado);
          this.gm.audio.tono('sine', 300, 1200, 0.3, 0.12);
        } else {
          c.combo = this.frameJuego - c.ultimaToma < 90 ? Math.min(3, c.combo + 1) : 1;   // atrapar seguido multiplica
          c.ultimaToma = this.frameJuego;
          const pts = (o.tipo === 'cometa' ? 3 : 1) * c.combo;
          c.puntos += pts;
          textoFlotante(this.flotantes, c.combo > 1 ? `+${pts} X${c.combo}` : `+${pts}`, o.x, o.y - 10, c.combo > 1 ? PALETA.naranja : PALETA.amarillo);
          this.gm.audio.tono('square', 660 + c.combo * 220, 1320, 0.06, 0.08);
          this.chispazo(o.x, o.y, PALETA.amarillo, 6);
        }
      }
    }
    if (this.frameJuego >= this.duracion) {
      const orden = this.corredores.slice().sort((a, b) => b.puntos - a.puntos);
      const notas = {};
      orden.forEach((c) => { notas[c.j.id] = `${c.puntos} PTS`; });
      this.terminar(orden.map((c) => c.j), notas);
    }
  }

  _ia(c) {
    let mejor = null, valor = -1;
    for (const o of this.cosas) {
      if (o.tomada || o.y > c.y + 10) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (o.tipo === 'meteoro') continue;
      const v = (o.tipo === 'cometa' ? 3 : o.tipo === 'iman' ? 4 : 1) / (d + 40);
      if (v > valor) { valor = v; mejor = o; }
    }
    let ix = 0, iy = 0;
    if (mejor) {
      const err = Math.sin(this.frame / 30 + c.j.slot) * 20 * this.dif.error;
      ix = Math.abs(mejor.x + err - c.x) > 4 ? Math.sign(mejor.x + err - c.x) : 0;
      iy = Math.abs(mejor.y + 30 - c.y) > 8 ? Math.sign(mejor.y + 30 - c.y) * 0.6 : 0;
    }
    for (const o of this.cosas) {                          // esquiva meteoritos cercanos
      if (o.tipo === 'meteoro' && !o.tomada && Math.abs(o.x - c.x) < 26 && o.y < c.y && c.y - o.y < 70 && Math.random() > 0.25 * this.dif.error) ix = o.x < c.x ? 1 : -1;
    }
    return { ix, iy, dash: !!mejor && Math.abs(mejor.x - c.x) > 160 };
  }

  pintar(ctx) {
    const ahora = Date.now();
    this.fondoArena(ctx);
    const quedan = Math.max(0, Math.ceil((this.duracion - this.frameJuego) / 60));
    this.encabezado(ctx, `TIEMPO ${this.fase === 'cuenta' ? 30 : quedan}`);
    for (const o of this.cosas) {
      if (o.tipo === 'iman') {
        ctx.fillStyle = PALETA.morado; ctx.fillRect(o.x - 8, o.y - 8, 5, 14); ctx.fillRect(o.x + 3, o.y - 8, 5, 14); ctx.fillRect(o.x - 8, o.y + 2, 16, 5);
        ctx.fillStyle = PALETA.hielo; ctx.fillRect(o.x - 8, o.y - 8, 5, 3); ctx.fillRect(o.x + 3, o.y - 8, 5, 3);
      } else if (o.tipo === 'meteoro') {
        ctx.fillStyle = PALETA.naranja; ctx.fillRect(o.x - 2, o.y - 16, 4, 10);
        ctx.fillStyle = '#7a3434'; ctx.beginPath(); ctx.arc(o.x, o.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a84a3a'; ctx.fillRect(o.x - 4, o.y - 4, 3, 3);
      } else {
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(ahora / 300 + o.giro);
        dibujarEstrellita(ctx, 0, 0, o.tipo === 'cometa' ? 10 : 7, o.tipo === 'cometa' ? PALETA.cian : PALETA.amarillo);
        ctx.restore();
        if (o.tipo === 'cometa') { ctx.fillStyle = PALETA.cian; ctx.globalAlpha = 0.5; ctx.fillRect(o.x - 2, o.y - 22, 4, 12); ctx.globalAlpha = 1; }
      }
    }
    for (const c of this.corredores) {
      ctx.save();
      if (c.aturdido > 0 && Math.floor(c.aturdido / 5) % 2) ctx.globalAlpha = 0.4;
      if (c.iman > this.frameJuego) { ctx.strokeStyle = PALETA.morado; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(c.x, c.y, 40 + Math.sin(ahora / 100) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      marcaJugador(ctx, c.j, c.x, c.y, ahora);
      c.j.sprite.dibujar(ctx, c.x, c.y, 44, ahora, { moviendo: c.mov, mirar: c.mirar || 1 });
      ctx.restore();
      Utils.texto(ctx, `${c.puntos}`, c.x + 22, c.y + 10, { tam: 6, color: PALETA.amarillo, borde: PALETA.fondo });
      if (c.combo > 1 && this.frameJuego - c.ultimaToma < 90) Utils.texto(ctx, `X${c.combo}`, c.x - 22, c.y + 10, { tam: 6, color: PALETA.naranja, borde: PALETA.fondo });
      dibujarBurbuja(ctx, c.j, c.x + 16, c.y - 34);
    }
  }
}

// 4. Carrera de Cohetes ---------------------------------------------------------------------------
class CarreraMinigame extends MinijuegoBase {
  static nombre = 'CARRERA DE COHETES';
  static instrucciones = ['PULSA A Y B ALTERNADOS LO MÁS RÁPIDO QUE PUEDAS', 'CADA 10 SEGUIDOS GANAS UN TURBO. ¡NO REPITAS!'];
  static controles = 'A, B, A, B, A, B... ¡SIN PARAR!';
  static color = PALETA.verde;
  static tuto = [['PULSAR ALTERNADO', 'AB']];

  static demo(ctx, x, y, w, h, t, sp) {
    const k = Math.floor(t / 180) % 2;
    const sube = ((t / 30) % (h - 40));
    sp.dibujar(ctx, x + w * 0.35, y + h - 20 - sube, 34, Date.now(), { moviendo: true });
    tecla(ctx, 'A', x + w * 0.72, y + h / 2 - 12, k ? PALETA.amarillo : PALETA.azul);
    tecla(ctx, 'B', x + w * 0.72, y + h / 2 + 12, k ? PALETA.azul : PALETA.rosa);
  }

  iniciar() {
    const n = this.gm.jugadores.length;
    const w = ARENA.w / n;
    this.meta = ARENA.y + 30;
    this.corredores = this.gm.jugadores.map((j, i) => ({ j, x: ARENA.x + w * (i + 0.5), y: ARENA.y + ARENA.h - 30, ultimo: null, llegada: 0, impulso: 0, proxBot: 0, racha: 0, tiembla: 0 }));
    this.llegados = [];
  }

  _empujar(c, b) {
    if (c.llegada || this.fase !== 'juego') return;
    if (b === c.ultimo) {                                // repetir botón no sirve: pierdes la racha
      c.racha = 0;
      c.tiembla = 12;
      if (!c.j.esBot) textoFlotante(this.flotantes, '¡ALTERNA!', c.x, c.y - 30, PALETA.laser);
      return;
    }
    c.ultimo = b;
    c.racha++;
    c.y -= 5;
    c.impulso = 8;
    if (c.racha % 10 === 0) {                            // cada 10 seguidos: turbo
      c.y -= 18;
      textoFlotante(this.flotantes, '¡TURBO!', c.x, c.y - 30, PALETA.amarillo);
      this.gm.audio.tono('square', 500, 1500, 0.15, 0.1);
    }
    if (c.y <= this.meta) {
      c.y = this.meta;
      c.llegada = this.frameJuego;
      this.llegados.push(c);
      this.gm.audio.exito();
      this.chispazo(c.x, c.y, PALETA.amarillo, 16);
    } else if (this.frame % 2 === 0) this.gm.audio.tono('triangle', 300 + (ARENA.y + ARENA.h - c.y) * 3, 400 + (ARENA.y + ARENA.h - c.y) * 3, 0.03, 0.05);
  }

  onBoton(j, b) {
    const c = this.corredores.find((o) => o.j === j);
    if (c && !j.esBot) this._empujar(c, b);
  }

  paso() {
    for (const c of this.corredores) {
      if (c.impulso > 0) c.impulso--;
      if (c.tiembla > 0) c.tiembla--;
      if (c.j.esBot && !c.llegada && this.frameJuego >= c.proxBot) {
        c.proxBot = this.frameJuego + Math.max(4, Math.round(Utils.azar(7, 12) * this.dif.reaccion));
        this._empujar(c, Math.random() < 0.06 * this.dif.error ? c.ultimo : c.ultimo === 'A' ? 'B' : 'A');
      }
    }
    const todos = this.llegados.length === this.corredores.length;
    if (todos || this.frameJuego >= 25 * 60) {
      const resto = this.corredores.filter((c) => !c.llegada).sort((a, b) => a.y - b.y);
      const notas = {};
      this.llegados.forEach((c) => { notas[c.j.id] = `${(c.llegada / 60).toFixed(1)}S`; });
      resto.forEach((c) => { notas[c.j.id] = `${Math.round(((ARENA.y + ARENA.h - 30 - c.y) / (ARENA.y + ARENA.h - 30 - this.meta)) * 100)}%`; });
      this.terminar([...this.llegados, ...resto].map((c) => c.j), notas);
    }
  }

  pintar(ctx) {
    const ahora = Date.now();
    this.fondoArena(ctx);
    this.encabezado(ctx, `TIEMPO ${Math.max(0, 25 - Math.floor(this.frameJuego / 60))}`);
    // meta a cuadros
    for (let x = ARENA.x; x < ARENA.x + ARENA.w; x += 8) { ctx.fillStyle = ((x - ARENA.x) / 8) % 2 ? PALETA.hielo : PALETA.fondo; ctx.fillRect(x, this.meta - 18, 8, 4); ctx.fillStyle = ((x - ARENA.x) / 8) % 2 ? PALETA.fondo : PALETA.hielo; ctx.fillRect(x, this.meta - 14, 8, 4); }
    const w = ARENA.w / Math.max(1, this.corredores.length);
    this.corredores.forEach((c, i) => {
      ctx.strokeStyle = c.j.def.color; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
      ctx.strokeRect(ARENA.x + i * w + 2.5, ARENA.y + 2.5, w - 5, ARENA.h - 5); ctx.globalAlpha = 1;
      // estela de fuego
      if (c.impulso > 0) {
        ctx.fillStyle = PALETA.naranja; ctx.fillRect(c.x - 4, c.y + 18, 8, 6 + c.impulso);
        ctx.fillStyle = PALETA.amarillo; ctx.fillRect(c.x - 2, c.y + 18, 4, 4 + c.impulso);
      }
      const dx = c.tiembla ? Math.sin(c.tiembla * 2) * 3 : 0;
      if (!c.llegada) marcaJugador(ctx, c.j, c.x + dx, c.y, ahora);
      c.j.sprite.dibujar(ctx, c.x + dx, c.y, 44, ahora, { moviendo: c.impulso > 0 });
      Utils.texto(ctx, c.j.nombre, c.x, ARENA.y + ARENA.h - 8, { tam: 5, color: c.j.def.color });
      // barra de racha hacia el turbo
      ctx.fillStyle = PALETA.fondo; ctx.fillRect(c.x - 20, ARENA.y + ARENA.h - 20, 40, 4);
      ctx.fillStyle = PALETA.amarillo; ctx.fillRect(c.x - 20, ARENA.y + ARENA.h - 20, (40 * (c.racha % 10)) / 10, 4);
      if (c.llegada) Utils.texto(ctx, `#${this.llegados.indexOf(c) + 1}`, c.x, c.y - 28, { tam: 9, color: PALETA.amarillo, borde: PALETA.fondo });
      else if (c.ultimo) Utils.texto(ctx, c.ultimo === 'A' ? 'B' : 'A', c.x + 20, c.y, { tam: 6, color: PALETA.hielo, alfa: 0.6 });
    });
  }
}

// 5. Duelo de Reflejos ---------------------------------------------------------------------------
class ReflejosMinigame extends MinijuegoBase {
  static nombre = 'DUELO DE REFLEJOS';
  static instrucciones = ['PULSA A CUANDO EL CÍRCULO SE PONGA VERDE (¡YA!)', 'OJO CON EL AMARILLO: ES UNA TRAMPA'];
  static controles = 'A: ¡DISPARAR!';
  static color = PALETA.cian;
  static tuto = [['DISPARAR CUANDO SALGA ¡YA!', 'A']];

  static demo(ctx, x, y, w, h, t, sp) {
    const k = t % 2400, ya = k > 1400;
    ctx.fillStyle = ya ? PALETA.verde : PALETA.laser;
    ctx.beginPath(); ctx.arc(x + w * 0.65, y + h / 2, 26, 0, Math.PI * 2); ctx.fill();
    Utils.texto(ctx, ya ? '¡YA!' : '...', x + w * 0.65, y + h / 2, { tam: 7, color: PALETA.hielo });
    sp.dibujar(ctx, x + w * 0.25, y + h / 2, 40, Date.now());
    if (ya && k < 1800) tecla(ctx, 'A', x + w * 0.25, y + h - 12, PALETA.amarillo);
  }

  iniciar() {
    this.corredores = this.gm.jugadores.map((j) => ({ j, puntos: 0, tiempoTotal: 0, estado: 'espera', tiempo: 0 }));
    this.ronda = 0;
    this.totalRondas = 5;
  }

  alEmpezar() { this._nuevaRonda(); }

  _nuevaRonda() {
    this.ronda++;
    this.subfase = 'espera';
    this.tRonda = this.frameJuego;
    this.disparo = this.frameJuego + Utils.entero(100, 240);
    this.falsa = Math.random() < 0.45 ? this.disparo - Utils.entero(35, 70) : -1;   // a veces una señal amarilla engaña
    this.orden = [];
    this.corredores.forEach((c) => {
      c.estado = 'espera';
      c.tiempo = 0;
      if (c.j.esBot) {
        const enganado = this.falsa > 0 && Math.random() < 0.2 * this.dif.error;
        c.bot = enganado ? this.falsa + Utils.entero(10, 20) : Math.random() < 0.04 * this.dif.error ? this.disparo - Utils.entero(10, 60) : this.disparo + Math.round(Utils.azar(16, 34) * this.dif.reaccion);
      }
    });
  }

  _pulsar(c) {
    if (c.estado !== 'espera' || this.subfase === 'resumen') return;
    if (this.frameJuego < this.disparo) {
      c.estado = 'pronto';
      this.gm.audio.derrota();
      this.gm.burbuja(c.j, 4);
      return;
    }
    c.estado = 'listo';
    c.tiempo = Math.round(((this.frameJuego - this.disparo) / 60) * 1000);
    c.tiempoTotal += c.tiempo;
    this.orden.push(c);
    if (this.orden.length === 1) { c.puntos++; this.gm.audio.exito(); this.chispazo(0, 0, PALETA.cian, 0); this.gm.burbuja(c.j, 0); }
    else this.gm.audio.blip();
  }

  onBoton(j, b) {
    const c = this.corredores.find((o) => o.j === j);
    if (c && !j.esBot && b === 'A') this._pulsar(c);
  }

  paso() {
    if (this.subfase === 'espera' && this.frameJuego === this.falsa) this.gm.audio.tono('triangle', 500, 450, 0.1, 0.12);
    if (this.subfase === 'espera' && this.frameJuego === this.disparo) { this.gm.audio.tono('square', 1200, 1200, 0.15, 0.2); this.subfase = 'ya'; this.flash = 14; }
    for (const c of this.corredores) if (c.j.esBot && c.estado === 'espera' && this.frameJuego >= c.bot) this._pulsar(c);
    const pendientes = this.corredores.filter((c) => c.estado === 'espera');
    if ((this.subfase === 'ya' && (!pendientes.length || this.frameJuego - this.disparo > 120)) || (this.subfase === 'espera' && !pendientes.length)) {
      this.subfase = 'resumen';
      this.tResumen = this.frameJuego;
    }
    if (this.subfase === 'resumen' && this.frameJuego - this.tResumen > 100) {
      if (this.ronda >= this.totalRondas) {
        const orden = this.corredores.slice().sort((a, b) => b.puntos - a.puntos || a.tiempoTotal - b.tiempoTotal);
        const notas = {};
        orden.forEach((c) => { notas[c.j.id] = `${c.puntos} PTS`; });
        this.terminar(orden.map((c) => c.j), notas);
      } else this._nuevaRonda();
    }
  }

  pintar(ctx) {
    const ahora = Date.now();
    this.fondoArena(ctx);
    this.encabezado(ctx, `RONDA ${Math.max(1, this.ronda)}/${this.totalRondas}`);
    const ya = this.subfase === 'ya' || (this.subfase === 'resumen' && this.frameJuego >= this.disparo);
    const casi = !ya && this.falsa > 0 && this.frameJuego >= this.falsa && this.frameJuego < this.falsa + 28;
    const cx = ANCHO / 2, cy = 120;
    ctx.fillStyle = ya ? PALETA.verde : casi ? PALETA.amarillo : PALETA.laser;
    ctx.beginPath(); ctx.arc(cx, cy, 48 + (ya ? Math.sin(ahora / 60) * 3 : 0), 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = PALETA.fondo; ctx.stroke();
    if (this.fase === 'juego') Utils.texto(ctx, ya ? '¡YA!' : casi ? '¡CASI!' : 'ESPERA...', cx, cy + 2, { tam: ya ? 18 : casi ? 12 : 9, color: casi ? PALETA.fondo : PALETA.hielo, borde: casi ? null : PALETA.fondo, grosor: 4 });
    if (this.fase === 'juego') Utils.texto(ctx, 'SOLO CUANDO ESTÉ VERDE', cx, cy + 66, { tam: 5, color: PALETA.hielo });
    const n = this.corredores.length, w = ARENA.w / Math.max(1, n);
    this.corredores.forEach((c, i) => {
      const x = ARENA.x + w * (i + 0.5), y = 250;
      marcaJugador(ctx, c.j, x, y - 6, ahora);
      c.j.sprite.dibujar(ctx, x, y, 52, ahora);
      Utils.texto(ctx, c.j.nombre, x, y + 34, { tam: 5, color: c.j.def.color });
      Utils.texto(ctx, `${c.puntos} PTS`, x, y + 46, { tam: 6, color: PALETA.amarillo });
      const t = { espera: '', pronto: '¡MUY PRONTO!', listo: `${c.tiempo} MS` }[c.estado];
      if (t) Utils.texto(ctx, t, x, y - 40, { tam: 6, color: c.estado === 'pronto' ? PALETA.laser : this.orden[0] === c ? PALETA.verde : PALETA.hielo, borde: PALETA.fondo });
      dibujarBurbuja(ctx, c.j, x + 18, y - 32);
    });
  }
}

// 6. Rey de la Plataforma -------------------------------------------------------------------------
class PlataformaMinigame extends MinijuegoBase {
  static nombre = 'REY DE LA PLATAFORMA';
  static instrucciones = ['EMPUJA A LOS DEMÁS FUERA DE LA PLATAFORMA (SE ENCOGE)', 'LA ESTRELLA DA SÚPER EMPUJE. EL ÚLTIMO EN PIE GANA'];
  static controles = 'CRUCETA: MOVER · A: EMBESTIDA';
  static color = PALETA.morado;
  static tuto = [['MOVERTE', 'mover'], ['EMBESTIDA (EMPUJAR)', 'A']];

  static demo(ctx, x, y, w, h, t, sp) {
    const cx = x + w / 2, cy = y + h / 2 + 8;
    ctx.fillStyle = PALETA.morado;
    ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.38, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    const k = (t % 2000) / 2000;
    const choque = Utils.clamp((k - 0.3) / 0.2, 0, 1);
    sp.dibujar(ctx, cx - 40 + Math.min(k / 0.3, 1) * 26, cy - 12, 32, Date.now(), { moviendo: true });
    ctx.globalAlpha = 1 - Utils.clamp((k - 0.6) / 0.3, 0, 1);
    ctx.fillStyle = PALETA.cian; ctx.fillRect(cx + 4 + choque * 60, cy - 20 + Math.max(0, k - 0.5) * 80, 12, 14);
    ctx.globalAlpha = 1;
  }

  iniciar() {
    this.cx = ANCHO / 2;
    this.cy = 200;
    this.R = 170;
    const n = this.gm.jugadores.length;
    this.corredores = this.gm.jugadores.map((j, i) => {
      const a = (i / n) * Math.PI * 2;
      return { j, x: this.cx + Math.cos(a) * 90, y: this.cy + Math.sin(a) * 90 * 0.55, vx: 0, vy: 0, vivo: true, cayendo: 0, muerte: -1, dashListo: 0, super: 0 };
    });
    this.poder = null;
  }

  _fuera(c) { return Math.hypot((c.x - this.cx) / this.R, (c.y - this.cy) / (this.R * 0.55)) > 1; }

  paso() {
    this.R = Math.max(70, 170 - this.frameJuego * 0.045);
    // cada 8 s aparece un súper poder de empuje en la plataforma
    if (!this.poder && this.frameJuego % 480 === 240) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * this.R * 0.6;
      this.poder = { x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r * 0.55 };
    }
    if (this.poder) {
      const quien = this.corredores.find((c) => c.vivo && Math.hypot(c.x - this.poder.x, (c.y - this.poder.y) / 0.55) < 20);
      if (quien) {
        quien.super = this.frameJuego + 300;
        textoFlotante(this.flotantes, '¡SÚPER EMPUJE!', quien.x, quien.y - 40, PALETA.amarillo);
        this.gm.audio.tono('square', 400, 1200, 0.25, 0.12);
        this.poder = null;
      }
    }
    for (const c of this.corredores) {
      if (!c.vivo) { if (c.cayendo) c.cayendo++; continue; }
      let ix, iy, dash;
      if (c.j.esBot) ({ ix, iy, dash } = this._ia(c));
      else ({ x: ix, y: iy, A: dash } = c.j.entrada);
      const L = Math.hypot(ix, iy);
      if (L > 1) { ix /= L; iy /= L; }
      c.vx += ix * 0.32;
      c.vy += iy * 0.32 * 0.7;
      if (dash && this.frame >= c.dashListo && (ix || iy)) {
        c.vx += ix * 5.5; c.vy += iy * 4;
        c.dashListo = this.frame + 55;
        c.embiste = this.frame + 12;
        this.gm.audio.tono('square', 300, 700, 0.08, 0.1);
      }
      c.vx *= 0.9; c.vy *= 0.9;
      if (ix) c.mirar = ix < 0 ? -1 : 1;
      c.mov = !!(ix || iy);
    }
    // choques entre jugadores (en espacio "aplanado")
    const vivos = this.corredores.filter((c) => c.vivo);
    for (let a = 0; a < vivos.length; a++) {
      for (let b = a + 1; b < vivos.length; b++) {
        const p = vivos[a], q = vivos[b];
        const dx = q.x - p.x, dy = (q.y - p.y) / 0.55, d = Math.hypot(dx, dy);
        if (d > 0 && d < 24) {
          const nx = dx / d, ny = dy / d;
          const fuerza = (c) => (2.2 + (c.embiste > this.frame ? 4.5 : 0)) * (c.super > this.frameJuego ? 1.8 : 1);
          const fp = fuerza(p), fq = fuerza(q);
          q.vx += nx * fp; q.vy += ny * fp * 0.55;
          p.vx -= nx * fq; p.vy -= ny * fq * 0.55;
          const sep = (24 - d) / 2;
          p.x -= nx * sep; p.y -= ny * sep * 0.55; q.x += nx * sep; q.y += ny * sep * 0.55;
          if (fp > 4 || fq > 4) { this.gm.audio.tono('square', 160, 80, 0.08, 0.15); this.gm.sacudida = 6; }
        }
      }
    }
    for (const c of vivos) {
      c.x += c.vx; c.y += c.vy;
      if (this._fuera(c)) {
        c.vivo = false; c.cayendo = 1; c.muerte = this.frameJuego;
        this.chispazo(c.x, c.y, c.j.def.color, 16);
        this.gm.audio.derrota();
        this.gm.burbuja(c.j, 4);
        this.gm.hub.enviarA(c.j.id, 'vibrar', [150, 50, 150]);
      }
    }
    const quedan = this.corredores.filter((c) => c.vivo);
    const total = this.corredores.length;
    if (total && ((total > 1 && quedan.length <= 1) || (total === 1 && !quedan.length) || this.frameJuego > 60 * 60)) {
      const caidos = this.corredores.filter((c) => !c.vivo).sort((a, b) => b.muerte - a.muerte);
      this.terminar([...quedan, ...caidos].map((c) => c.j));
    }
  }

  _ia(c) {
    const dc = Math.hypot((c.x - this.cx) / this.R, (c.y - this.cy) / (this.R * 0.55));
    if (dc > 0.6) return { ix: Math.sign(this.cx - c.x) * (Math.abs(this.cx - c.x) > 6 ? 1 : 0), iy: Math.sign(this.cy - c.y), dash: false };
    if (this.poder && Math.hypot(this.poder.x - c.x, this.poder.y - c.y) < 140) {
      return { ix: Math.sign(this.poder.x - c.x), iy: Math.sign(this.poder.y - c.y), dash: false };
    }
    let rival = null, dmin = 1e9;
    for (const o of this.corredores) {
      if (o === c || !o.vivo) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < dmin) { dmin = d; rival = o; }
    }
    if (!rival || Math.random() < 0.2 * this.dif.error) return { ix: 0, iy: 0, dash: false };
    const ix = Math.abs(rival.x - c.x) > 4 ? Math.sign(rival.x - c.x) : 0, iy = Math.abs(rival.y - c.y) > 4 ? Math.sign(rival.y - c.y) : 0;
    return { ix, iy, dash: dmin < 55 && Math.random() < 0.3 / this.dif.reaccion };
  }

  pintar(ctx) {
    const ahora = Date.now();
    this.encabezado(ctx, `QUEDAN ${this.corredores.filter((c) => c.vivo).length}`);
    // plataforma flotante
    ctx.fillStyle = '#3a2a7a';
    ctx.beginPath(); ctx.ellipse(this.cx, this.cy + 16, this.R, this.R * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETA.morado;
    ctx.beginPath(); ctx.ellipse(this.cx, this.cy, this.R, this.R * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = this.R < 100 && Math.sin(ahora / 120) > 0 ? PALETA.laser : PALETA.hielo; ctx.stroke();
    ctx.fillStyle = PALETA.hielo; ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.ellipse(this.cx - this.R * 0.2, this.cy - this.R * 0.15, this.R * 0.45, this.R * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (this.poder) { ctx.save(); ctx.translate(this.poder.x, this.poder.y - 10 + Math.sin(ahora / 150) * 3); ctx.rotate(ahora / 300); dibujarEstrellita(ctx, 0, 0, 10, PALETA.amarillo); ctx.restore(); }
    const lista = this.corredores.slice().sort((a, b) => a.y - b.y);
    for (const c of lista) {
      ctx.save();
      let y = c.y;
      if (!c.vivo) { y += c.cayendo * c.cayendo * 0.08; ctx.globalAlpha = Math.max(0, 1 - c.cayendo / 60); }
      if (c.vivo) { ctx.fillStyle = PALETA.fondo; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(c.x, c.y + 4, 11, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      if (c.vivo) marcaJugador(ctx, c.j, c.x, c.y - 14, ahora);
      if (c.vivo && c.super > this.frameJuego) { ctx.strokeStyle = PALETA.amarillo; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(ahora / 80); ctx.beginPath(); ctx.ellipse(c.x, c.y, 18, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      c.j.sprite.dibujar(ctx, c.x, y - 14, 44, ahora, { moviendo: c.mov, mirar: c.mirar || 1 });
      ctx.restore();
      if (c.vivo && c.embiste > this.frame) { ctx.strokeStyle = PALETA.amarillo; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y - 14, 20, 0, Math.PI * 2); ctx.stroke(); }
      dibujarBurbuja(ctx, c.j, c.x + 16, c.y - 44);
    }
  }
}

// 7. Memoria Cósmica ------------------------------------------------------------------------------
class MemoriaMinigame extends MinijuegoBase {
  static nombre = 'MEMORIA CÓSMICA';
  static instrucciones = ['MIRA LA SECUENCIA DE FLECHAS Y REPÍTELA', 'CON LA CRUCETA. SI FALLAS, QUEDAS FUERA'];
  static controles = 'CRUCETA: REPETIR LA SECUENCIA';
  static color = PALETA.rosa;
  static tuto = [['REPETIR LAS FLECHAS', 'mover']];

  static demo(ctx, x, y, w, h, t) {
    const cx = x + w / 2, cy = y + h / 2;
    const act = [0, 1, 3, 2][Math.floor(t / 500) % 4];
    [[0, -1, PALETA.verde], [1, 0, PALETA.amarillo], [0, 1, PALETA.cian], [-1, 0, PALETA.rosa]].forEach(([dx, dy, c], i) => {
      Utils.panel(ctx, cx + dx * 26 - 11, cy + dy * 26 - 11, 22, 22, i === act ? c : PALETA.fondo, c, 2);
    });
  }

  iniciar() {
    this.corredores = this.gm.jugadores.map((j) => ({ j, vivo: true, puntos: 0, avance: 0, listo: false, muerte: -1 }));
    this.secuencia = [];
    this.ronda = 0;
    this.flechas = [
      { dx: 0, dy: -1, color: PALETA.verde, nota: 523 }, { dx: 1, dy: 0, color: PALETA.amarillo, nota: 659 },
      { dx: 0, dy: 1, color: PALETA.cian, nota: 784 }, { dx: -1, dy: 0, color: PALETA.rosa, nota: 988 },
    ];
  }

  alEmpezar() { this._nuevaRonda(); }

  get ritmo() { return Math.max(18, 38 - this.ronda * 3); }   // cada ronda muestra las flechas más rápido

  _nuevaRonda() {
    this.ronda++;
    while (this.secuencia.length < this.ronda + 2) this.secuencia.push(Utils.entero(0, 3));
    this.subfase = 'mostrar';
    this.tSub = this.frameJuego;
    this.corredores.forEach((c) => { c.avance = 0; c.listo = false; c.botProx = 0; });
  }

  _entrada(c, idx) {
    if (!c.vivo || c.listo || this.subfase !== 'repetir') return;
    if (!c.j.esBot) this.pulsada = { idx, frame: this.frameJuego, color: c.j.def.color };
    if (this.secuencia[c.avance] === idx) {
      c.avance++;
      this.gm.audio.tono('square', this.flechas[idx].nota, this.flechas[idx].nota, 0.08, 0.06);
      if (c.avance >= this.secuencia.length) { c.listo = true; c.puntos++; this.gm.burbuja(c.j, 0); }
    } else {
      c.vivo = false;
      c.muerte = this.ronda;
      this.gm.audio.derrota();
      this.gm.burbuja(c.j, 4);
      this.gm.hub.enviarA(c.j.id, 'vibrar', [200]);
    }
  }

  onDir(j, x, y) {
    const c = this.corredores.find((o) => o.j === j);
    if (!c || j.esBot) return;
    const idx = y < 0 ? 0 : x > 0 ? 1 : y > 0 ? 2 : x < 0 ? 3 : -1;
    if (idx >= 0) this._entrada(c, idx);
  }

  paso() {
    const e = this.frameJuego - this.tSub;
    const ritmo = this.ritmo;
    if (this.subfase === 'mostrar') {
      const paso = Math.floor(e / ritmo);
      if (e % ritmo === 0 && paso < this.secuencia.length) {
        const f = this.flechas[this.secuencia[paso]];
        this.gm.audio.tono('square', f.nota, f.nota, 0.2, 0.12);
      }
      if (paso >= this.secuencia.length + 1) { this.subfase = 'repetir'; this.tSub = this.frameJuego; }
      return;
    }
    if (this.subfase === 'repetir') {
      const limite = 120 + this.secuencia.length * 50;
      for (const c of this.corredores) {
        if (!c.j.esBot || !c.vivo || c.listo) continue;
        if (!c.botProx) c.botProx = this.frameJuego + Math.round(Utils.azar(18, 32) * this.dif.reaccion);
        if (this.frameJuego >= c.botProx) {
          c.botProx = this.frameJuego + Math.round(Utils.azar(14, 26) * this.dif.reaccion);
          const falla = Math.random() < 0.05 * this.dif.error * (1 + this.ronda * 0.3);
          this._entrada(c, falla ? (this.secuencia[c.avance] + 1) % 4 : this.secuencia[c.avance]);
        }
      }
      const pendientes = this.corredores.filter((c) => c.vivo && !c.listo);
      if (!pendientes.length || e > limite) {
        pendientes.forEach((c) => { c.vivo = false; c.muerte = this.ronda; });   // se acabó el tiempo
        this.subfase = 'resumen';
        this.tSub = this.frameJuego;
      }
      return;
    }
    if (this.subfase === 'resumen' && e > 80) {
      const vivos = this.corredores.filter((c) => c.vivo);
      const total = this.corredores.length;
      if (this.ronda >= 6 || !vivos.length || (total > 1 && vivos.length <= 1)) {
        const orden = this.corredores.slice().sort((a, b) => b.puntos - a.puntos || (b.vivo ? 99 : b.muerte) - (a.vivo ? 99 : a.muerte));
        const notas = {};
        orden.forEach((c) => { notas[c.j.id] = `${c.puntos} PTS`; });
        this.terminar(orden.map((c) => c.j), notas);
      } else this._nuevaRonda();
    }
  }

  pintar(ctx) {
    const ahora = Date.now();
    this.fondoArena(ctx);
    const txt = { mostrar: '¡MIRA BIEN!', repetir: '¡AHORA TÚ! REPITE CON LAS FLECHAS', resumen: '...' }[this.subfase] || '';
    if (this.fase === 'juego') {
      const grande = { mostrar: '¡MIRA BIEN!', repetir: '¡AHORA TÚ!' }[this.subfase];
      if (grande) Utils.texto(ctx, grande, ANCHO / 2, 43, { tam: 10, color: this.subfase === 'repetir' ? PALETA.verde : PALETA.amarillo, borde: PALETA.fondo, grosor: 4 });
    }
    this.encabezado(ctx, `RONDA ${Math.max(1, this.ronda)} · ${txt}`);
    const cx = ANCHO / 2, cy = 130;
    let activa = -1;
    if (this.subfase === 'mostrar') {
      const e = this.frameJuego - this.tSub, paso = Math.floor(e / this.ritmo);
      if (e % this.ritmo < this.ritmo * 0.72 && paso < this.secuencia.length) activa = this.secuencia[paso];
    }
    const pulso = this.pulsada && this.frameJuego - this.pulsada.frame < 10 ? this.pulsada : null;
    this.flechas.forEach((f, i) => {
      const x = cx + f.dx * 56, y = cy + f.dy * 56, on = i === activa, toque = pulso && pulso.idx === i;
      Utils.panel(ctx, x - 24, y - 24, 48, 48, on ? f.color : toque ? PALETA.hielo : PALETA.fondo, toque ? pulso.color : f.color, on || toque ? 4 : 2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(f.dy, f.dx) + Math.PI / 2);
      ctx.fillStyle = on ? PALETA.fondo : f.color;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, 6); ctx.lineTo(-12, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    Utils.texto(ctx, `${this.secuencia.length} FLECHAS`, cx, cy, { tam: 5, color: PALETA.hielo });
    const n = this.corredores.length, w = ARENA.w / Math.max(1, n);
    this.corredores.forEach((c, i) => {
      const x = ARENA.x + w * (i + 0.5), y = 268;
      ctx.save();
      if (!c.vivo) ctx.globalAlpha = 0.35;
      if (c.vivo) marcaJugador(ctx, c.j, x, y - 4, ahora);
      c.j.sprite.dibujar(ctx, x, y, 46, ahora);
      ctx.restore();
      Utils.texto(ctx, c.j.nombre, x, y + 30, { tam: 5, color: c.j.def.color });
      if (this.subfase === 'repetir' || this.subfase === 'resumen') {
        for (let k = 0; k < this.secuencia.length; k++) {
          ctx.fillStyle = k < c.avance ? PALETA.verde : PALETA.azul;
          ctx.fillRect(x - this.secuencia.length * 3 + k * 6, y + 38, 4, 4);
        }
      }
      if (!c.vivo) Utils.texto(ctx, 'FUERA', x, y - 30, { tam: 6, color: PALETA.laser, borde: PALETA.fondo });
      else if (c.listo) Utils.texto(ctx, '¡BIEN!', x, y - 30, { tam: 6, color: PALETA.verde, borde: PALETA.fondo });
      dibujarBurbuja(ctx, c.j, x + 18, y - 34);
    });
  }
}

// 8. Sala de minijuegos: ruleta + instrucciones + juego ---------------------------------------------
class SalaMinijuegos {
  constructor(gm) {
    this.gm = gm;
    this.juegos = [LaserMinigame, EstrellasMinigame, CarreraMinigame, ReflejosMinigame, PlataformaMinigame, MemoriaMinigame];
    this.ultimos = [];
  }

  entrar() {
    const posibles = this.juegos.filter((J) => !this.ultimos.includes(J));
    this.elegido = posibles[Utils.entero(0, posibles.length - 1)];
    this.ultimos = [this.elegido, ...this.ultimos].slice(0, 2);       // no repite los 2 últimos
    this.indice = this.juegos.indexOf(this.elegido);
    this.vueltas = (4 + Math.random() * 0.4) * this.juegos.length + this.indice;
    this.actual = null;
    this.listos = new Set();
    this.fase = 'ruleta';
    this.t0 = Date.now();
    this.ultimoTick = -1;
  }

  salir() { this.gm.audio.detenerMusica(); }

  datosMando() {
    const J = this.fase === 'ruleta' ? null : this.elegido;
    return {
      minijuego: J ? J.nombre : 'GIRANDO LA RULETA...',
      instrucciones: J ? J.instrucciones.join(' ') : '',
      controles: J ? J.controles : '',
      fase: this.fase,
      listos: [...this.listos],
      ranking: this.actual && this.actual.ranking ? this.actual.ranking.map((j) => j.id) : null,
    };
  }

  get _posRuleta() {
    const p = Utils.clamp((Date.now() - this.t0) / 2600, 0, 1);
    return Utils.easeOutCubic(p) * this.vueltas;
  }

  actualizar() {
    const e = Date.now() - this.t0;
    if (this.fase === 'ruleta') {
      const k = Math.floor(this._posRuleta + 0.5);
      if (k !== this.ultimoTick) { this.ultimoTick = k; this.gm.audio.tono('square', 900, 700, 0.03, 0.06); }
      if (e > 2900) {
        this.fase = this.gm.ajustes.tutoriales ? 'tutorial' : 'info';
        this.t1 = Date.now();
        this.gm.audio.exito();
        this.gm.jugadores.forEach((j) => { j.entrada = { x: 0, y: 0, A: false, B: false }; if (j.esBot) this.listos.add(j.id); });
        this.gm.difundir();
      }
    } else if (this.fase === 'info') {
      if (Date.now() - this.t1 > 4200 * this.gm.vel) this._empezar();
    } else if (this.fase === 'tutorial') {
      const humanos = this.gm.jugadores.filter((j) => !j.esBot);
      const todos = humanos.every((j) => this.listos.has(j.id));
      if (todos && !this.vamos) { this.vamos = Date.now(); this.gm.audio.exito(); }
      if (this.vamos && Date.now() - this.vamos > 900) this._empezar();
      if (!this.vamos && Date.now() - this.t1 > 45000) this._empezar();          // por si nadie pulsa
    } else if (this.actual) this.actual.actualizar();
  }

  _empezar() {
    this.fase = 'juego';
    this.vamos = 0;
    this.actual = new this.elegido(this.gm);
    this.actual.preparar();
    this.gm.difundir();
  }

  get _botonEmpezar() { return { x: ANCHO / 2 - 70, y: 330, w: 140, h: 22 }; }

  onClick(x, y) {
    if (this.fase !== 'tutorial') return;
    const b = this._botonEmpezar;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.gm.audio.blip(); this._empezar(); }
  }

  onTecla(e) { if (this.fase === 'tutorial' && e.code === 'Enter') { this.gm.audio.blip(); this._empezar(); } }

  /** Pantalla de tutorial: objetivo, animación, teclas y prueba de controles. */
  _dibujarTutorial(ctx) {
    const J = this.elegido, ahora = Date.now();
    const k = Utils.easeOutBack(Utils.progreso(this.t1, 500));
    const solo1 = !this.gm.jugadores.some((j) => j.id === 'local2');
    const hayCel = this.gm.jugadores.some((j) => j.remoto);
    const hayJ2 = !solo1;
    ctx.save();
    ctx.translate(ANCHO / 2, 160);
    ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
    ctx.translate(-ANCHO / 2, -160);
    Utils.panel(ctx, 10, 6, 596, 230, PALETA.fondo, J.color, 4);
    Utils.texto(ctx, J.nombre, 308, 22, { tam: 11, color: J.color, borde: PALETA.fondo, grosor: 4 });
    Utils.texto(ctx, J.instrucciones.join(' '), 308, 40, { tam: 5, color: PALETA.hielo });
    // animación de ejemplo
    Utils.panel(ctx, 22, 52, 220, 172, '#241763', J.color, 2);
    Utils.texto(ctx, 'ASÍ SE JUEGA', 132, 62, { tam: 5, color: PALETA.amarillo });
    ctx.save();
    ctx.beginPath(); ctx.rect(24, 70, 216, 152); ctx.clip();
    if (!this.spDemo) this.spDemo = new SpriteAnimator(this.gm.jugadores[0] ? this.gm.jugadores[0].def.id : 'astro');
    J.demo(ctx, 24, 70, 216, 152, ahora - this.t1, this.spDemo);
    ctx.restore();
    // tabla de controles
    Utils.texto(ctx, 'CONTROLES', 438, 62, { tam: 7, color: PALETA.amarillo });
    const cols = [['TECLADO J1', 362]];
    if (hayJ2) cols.push(['TECLADO J2', 458]);
    cols.push(['CELULAR', hayJ2 ? 548 : 510]);
    cols.forEach(([t, cx]) => Utils.texto(ctx, t, cx, 80, { tam: 5, color: PALETA.cian }));
    J.tuto.forEach(([accion, tipo], i) => {
      const y = 104 + i * 40;
      const [t1, t2, tc] = textoControl(tipo, solo1);
      Utils.texto(ctx, accion, 258, y - 16, { tam: 6, alin: 'left', color: PALETA.hielo });
      tecla(ctx, t1, cols[0][1], y + 4, PALETA.amarillo);
      if (hayJ2) tecla(ctx, t2, cols[1][1], y + 4, PALETA.rosa);
      tecla(ctx, tc, cols[cols.length - 1][1], y + 4, PALETA.cian);
    });
    if (this.gm.tactil.activo) Utils.texto(ctx, 'EN PANTALLA TÁCTIL: USA LA CRUCETA Y LOS BOTONES A/B DE ABAJO', 438, 222, { tam: 4, color: PALETA.hielo });
    else if (!hayCel) Utils.texto(ctx, 'SI NO RESPONDE: HAZ CLIC EN EL JUEGO PRIMERO', 438, 222, { tam: 4, color: PALETA.hielo });
    ctx.restore();
    // prueba de controles de cada jugador
    Utils.texto(ctx, 'PRUEBA TUS TECLAS: SE ILUMINAN AL PULSAR · PULSA A CUANDO ESTÉS LISTO', ANCHO / 2, 246, { tam: 5, color: PALETA.amarillo, borde: PALETA.fondo });
    const humanos = this.gm.jugadores.filter((j) => !j.esBot);
    const n = Math.max(1, humanos.length), w = Math.min(90, 600 / n);
    humanos.forEach((j, i) => probarMando(ctx, j, ANCHO / 2 + (i - (n - 1) / 2) * w, 290, this.listos.has(j.id)));
    const b = this._botonEmpezar;
    Utils.panel(ctx, b.x, b.y, b.w, b.h, PALETA.verde, PALETA.fondo, 2);
    Utils.texto(ctx, this.vamos ? '¡VAMOS!' : 'EMPEZAR YA (ENTER)', b.x + b.w / 2, b.y + 12, { tam: 5, color: PALETA.fondo });
  }

  dibujar(ctx) {
    if (this.fase === 'juego' && this.actual) { this.actual.dibujar(ctx); return; }
    if (this.fase === 'tutorial') { this._dibujarTutorial(ctx); return; }
    const ahora = Date.now();
    if (this.fase === 'ruleta') {
      Utils.texto(ctx, '¡RULETA DE MINIJUEGOS!', ANCHO / 2, 26, { tam: 12, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 5 });
      const n = this.juegos.length, cx = ANCHO / 2, cy = 190, R = 120;
      const pos = this._posRuleta;
      const giro = -(pos / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
      for (let i = 0; i < n; i++) {
        const a0 = giro + (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n;
        ctx.fillStyle = this.juegos[i].color;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = PALETA.fondo; ctx.lineWidth = 3; ctx.stroke();
        ctx.save();
        ctx.translate(cx + Math.cos((a0 + a1) / 2) * R * 0.62, cy + Math.sin((a0 + a1) / 2) * R * 0.62);
        ctx.rotate((a0 + a1) / 2 + Math.PI / 2);
        Utils.texto(ctx, this.juegos[i].nombre.split(' ')[0], 0, 0, { tam: 6, color: PALETA.fondo });
        ctx.restore();
      }
      ctx.fillStyle = PALETA.fondo; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
      dibujarEstrellita(ctx, cx, cy, 12, PALETA.amarillo);
      ctx.fillStyle = PALETA.hielo; ctx.strokeStyle = PALETA.fondo; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 12, cy - R - 16); ctx.lineTo(cx + 12, cy - R - 16); ctx.lineTo(cx, cy - R + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      const actual = this.juegos[((Math.floor(pos + 0.5) % n) + n) % n];
      Utils.texto(ctx, actual.nombre, ANCHO / 2, 334, { tam: 10, color: PALETA.hielo, borde: PALETA.fondo, grosor: 4 });
      return;
    }
    // instrucciones del minijuego elegido
    const J = this.elegido;
    const k = Utils.easeOutBack(Utils.progreso(this.t1, 500));
    ctx.save();
    ctx.translate(ANCHO / 2, ALTO / 2);
    ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
    ctx.fillStyle = PALETA.fondo; ctx.fillRect(-206, -116, 420, 240);
    Utils.panel(ctx, -210, -120, 420, 240, J.color, PALETA.fondo, 4);
    Utils.texto(ctx, J.nombre, 0, -92, { tam: 13, color: PALETA.hielo, borde: PALETA.fondo, grosor: 5 });
    Utils.panel(ctx, -190, -70, 380, 110, PALETA.fondo, PALETA.fondo, 1);
    Utils.texto(ctx, 'CÓMO SE JUEGA', 0, -54, { tam: 6, color: PALETA.amarillo });
    J.instrucciones.forEach((l, i) => Utils.texto(ctx, l, 0, -30 + i * 18, { tam: 6, color: PALETA.hielo }));
    Utils.texto(ctx, J.controles, 0, 20, { tam: 6, color: PALETA.cian });
    Utils.texto(ctx, 'TECLADO: FLECHAS + ESPACIO (Y B) · CON 2: WASD + ESPACIO / FLECHAS + ENTER', 0, 62, { tam: 5, color: PALETA.fondo });
    const p = Utils.progreso(this.t1, 4200 * this.gm.vel);
    Utils.panel(ctx, -150, 82, 300, 14, PALETA.fondo, PALETA.fondo, 1);
    ctx.fillStyle = PALETA.amarillo; ctx.fillRect(-148, 84, 296 * p, 10);
    Utils.texto(ctx, '¡PREPÁRATE!', 0, 108, { tam: 7, color: PALETA.fondo });
    ctx.restore();
    // los jugadores esperando abajo
    const n = this.gm.jugadores.length;
    this.gm.jugadores.forEach((j, i) => j.sprite.dibujar(ctx, 40 + ((ANCHO - 80) * (i + 0.5)) / n, 340, 30, ahora));
  }

  alReanudar(ms) { this.t0 += ms; if (this.t1) this.t1 += ms; }

  onBoton(j, b) {
    if (this.fase === 'tutorial') {
      if (b === 'A' && !this.listos.has(j.id)) { this.listos.add(j.id); this.gm.audio.blip(); this.gm.burbuja(j, 3); this.gm.difundir(); }
      return;
    }
    if (this.fase === 'juego' && this.actual && this.actual.fase === 'juego') this.actual.onBoton(j, b);
  }
  onDir(j, x, y) { if (this.fase === 'juego' && this.actual && this.actual.fase === 'juego') this.actual.onDir(j, x, y); }
  alSalir(j) {
    if (this.actual) this.actual.alSalir(j);
    if (!this.gm.jugadores.length) this.gm.cambiarEstado(ESTADO.LOBBY);
  }
}
