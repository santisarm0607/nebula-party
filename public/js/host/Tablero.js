/* =========================================================
   NEBULA PARTY — Tablero.js · State 2: el tablero de cada mundo
   Índice:
   1. Datos: casillas, objetos, mundos (rutas y atajos), narrador
   2. Clase EstadoTablero
      2.1 Armado del mapa (ruta, atajos, suelo, adornos)
      2.2 Entrada a la ronda, estrella y cámara
      2.3 Menús (cruces, tienda, objetos, comprar estrella)
      2.4 Turno: objetos, dado, movimiento por la ruta
      2.5 Efecto de cada casilla
      2.6 Evento de fin de ronda
      2.7 Dibujo (mundo, casillas, adornos, HUD, dado, menús)
      2.8 Entradas (teclado, ratón, celulares)
   ========================================================= */
'use strict';

// 1. Datos ------------------------------------------------------------------------
const CASILLAS = {
  inicio: { color: PALETA.hielo, marca: 'GO', tinta: PALETA.fondo, nombre: 'INICIO' },
  normal: { color: PALETA.azul, marca: '+2', tinta: PALETA.hielo, nombre: 'MONEDAS' },
  estrella: { color: PALETA.amarillo, marca: '+5', tinta: PALETA.fondo, nombre: 'BONO' },
  trampa: { color: PALETA.laser, marca: '-3', tinta: PALETA.hielo, nombre: 'TRAMPA' },
  turbo: { color: PALETA.verde, marca: '>>', tinta: PALETA.fondo, nombre: 'TURBO' },
  portal: { color: PALETA.morado, marca: '', tinta: PALETA.hielo, nombre: 'PORTAL' },
  cofre: { color: PALETA.naranja, marca: '?', tinta: PALETA.fondo, nombre: 'COFRE' },
  agujero: { color: PALETA.fondo, marca: '', tinta: PALETA.morado, nombre: 'AGUJERO' },
  cambio: { color: PALETA.rosa, marca: '<>', tinta: PALETA.fondo, nombre: 'CAMBIO' },
  tienda: { color: '#b49bff', marca: 'T', tinta: PALETA.fondo, nombre: 'TIENDA' },
  hielo: { color: '#d9f7ff', marca: '~', tinta: '#2f7fb8', nombre: 'HIELO' },
  liana: { color: '#2fb84a', marca: '^4', tinta: PALETA.hielo, nombre: 'LIANA' },
  erupcion: { color: '#ff5a2a', marca: '!', tinta: PALETA.amarillo, nombre: 'ERUPCIÓN' },
  casino: { color: '#00e5c0', marca: '$', tinta: PALETA.fondo, nombre: 'CASINO' },
};
/** Casillas que se apagan cuando en Ajustes se quitan las especiales. */
const ESPECIALES = new Set(['portal', 'agujero', 'cambio', 'hielo', 'liana', 'erupcion', 'casino', 'turbo']);

const COSTO_ESTRELLA = 20;
const MAX_OBJETOS = 3;
const OBJETOS = {
  dado_doble: { nombre: 'DADO DOBLE', precio: 8, desc: 'LANZAS DOS DADOS', color: PALETA.cian },
  dado_trucado: { nombre: 'DADO TRUCADO', precio: 6, desc: 'TÚ ELIGES DEL 1 AL 6', color: PALETA.verde },
  escudo: { nombre: 'ESCUDO', precio: 5, desc: 'TE SALVA DE UNA PÉRDIDA', color: PALETA.amarillo },
  ladron: { nombre: 'LADRÓN', precio: 7, desc: 'ROBAS 5 MONEDAS', color: PALETA.rosa },
  teleport: { nombre: 'TELETRANSPORTE', precio: 12, desc: 'VAS JUNTO A LA ESTRELLA', color: PALETA.morado },
};

/**
 * Mundos. La ruta son pasos sobre una grilla: R derecha, L izquierda, D abajo, U arriba + cuántas casillas.
 * Cada atajo sale de la casilla `desde`, sigue sus pasos y vuelve a la ruta en `hasta`.
 */
const MUNDOS = [
  { id: 'hielo', nombre: 'GLACIAR CRISTAL', desc: ['HIELO RESBALOSO:', 'TE DESLIZAS 2 MÁS'], especial: 'hielo', musica: 'hielo',
    suelo: '#bfeeff', suelo2: '#a6def5', lado: '#3a8fc4', borde: '#e8fbff', cielo: '#5ab8ff',
    adornos: ['cristal', 'pino', 'cristal', 'roca', 'pino'], ruta: 'R4 D3 R3 U3 R5 D5 L2 D3 R2 D3 L5 U3 L3 D3 L4 U5 R2 U3 L2 U2',
    atajos: [{ desde: 22, pasos: 'L3 D3', hasta: 27, tipos: ['estrella', 'cofre', 'normal', 'estrella', 'tienda', 'normal'] },
      { desde: 7, pasos: 'D4', hasta: 44, tipos: ['trampa', 'agujero', 'trampa', 'trampa'] }],
    patron: ['normal', 'hielo', 'normal', 'estrella', 'trampa', 'normal', 'hielo', 'cofre', 'normal', 'turbo', 'normal', 'agujero'] },
  { id: 'selva', nombre: 'JUNGLA ALIEN', desc: ['LIANAS:', 'SALTAS 4 DE UNA VEZ'], especial: 'liana', musica: 'selva',
    suelo: '#6fd25c', suelo2: '#5cc04e', lado: '#2e7a3a', borde: '#b9ff8a', cielo: '#2fb84a',
    adornos: ['arbol', 'hongo', 'arbol', 'flor', 'arbol'], ruta: 'R6 D2 L4 D2 R4 D2 L4 D2 R7 U8 R3 D10 L12 U9',
    atajos: [{ desde: 4, pasos: 'D1', hasta: 10, tipos: ['trampa'] },
      { desde: 18, pasos: 'R2', hasta: 37, tipos: ['agujero', 'trampa'] }],
    patron: ['normal', 'liana', 'normal', 'cofre', 'trampa', 'normal', 'estrella', 'normal', 'cambio', 'liana', 'normal', 'agujero'] },
  { id: 'lava', nombre: 'VOLCÁN MAGMA', desc: ['ERUPCIONES:', 'LOS DEMÁS PIERDEN 2'], especial: 'erupcion', musica: 'lava',
    suelo: '#5a3a3a', suelo2: '#4a2e30', lado: '#2a1418', borde: '#ffb15a', cielo: '#ff5a2a',
    adornos: ['roca', 'charco', 'roca', 'charco'], ruta: 'R12 D3 L3 D3 R3 D3 L12 U3 R3 U3 L3 U2',
    atajos: [{ desde: 9, pasos: 'D2', hasta: 18, tipos: ['trampa', 'erupcion'] },
      { desde: 36, pasos: 'U2', hasta: 45, tipos: ['agujero', 'trampa'] }],
    patron: ['normal', 'trampa', 'erupcion', 'normal', 'estrella', 'trampa', 'normal', 'cofre', 'turbo', 'normal', 'erupcion', 'agujero'] },
  { id: 'neon', nombre: 'CIUDAD NEÓN', desc: ['CASINO:', 'GANAS 6 O PIERDES 4'], especial: 'casino', musica: 'neon',
    suelo: '#3a2a7a', suelo2: '#33256c', lado: '#1c1147', borde: '#ff8ad8', cielo: '#e23cc8',
    adornos: ['torre', 'cartel', 'torre', 'torre'], ruta: 'R3 D3 R3 U3 R3 D3 R3 U3 R2 D9 L3 U3 L3 D3 L3 U3 L3 D3 L2 U8',
    atajos: [{ desde: 3, pasos: 'R2', hasta: 12, tipos: ['casino', 'trampa'] },
      { desde: 50, pasos: 'L2', hasta: 59, tipos: ['trampa', 'casino'] }],
    patron: ['normal', 'casino', 'normal', 'cambio', 'estrella', 'normal', 'trampa', 'casino', 'normal', 'cofre', 'normal', 'turbo'] },
];

/** Frases del narrador para cada evento. */
const NARRADOR = {
  trampa: ['¡UY, ESO DOLIÓ!', '¡AUCH! MIS MONEDAS...', 'ESO NO ESTABA EN EL MAPA...'],
  estrella: ['¡QUÉ BRILLO!', '¡UNA ESTRELLA MÁS!', '¡ESO ES JUGAR BIEN!'],
  turbo: ['¡A TODA MÁQUINA!', '¡NADIE TE ALCANZA!'],
  agujero: ['¡EL ESPACIO TE TRAGA!', '¡PARA ATRÁS, VAQUERO!'],
  tienda: ['¡BIENVENIDO A LA TIENDA GALÁCTICA!', '¿QUÉ VAS A LLEVAR HOY?'],
  cofre: ['¿QUÉ HABRÁ ADENTRO?', '¡SORPRESA ESPACIAL!'],
  atajo: ['¿ATAJO? ¡QUÉ VALIENTE!', 'EL CAMINO CORTO DUELE...'],
  escudo: ['¡EL ESCUDO TE SALVÓ!', '¡NI UN RASGUÑO!'],
  casino: ['¡HAGAN SUS APUESTAS!', 'LA CASA SIEMPRE... ¿GANA?'],
  dado: ['¡QUE RUEDE!', '¡VAMOS, VAMOS!', '¿SERÁ UN 10?'],
  ladron: ['¡MANOS ARRIBA!', '¡ESO ES TRAMPA... PERO VALE!'],
};

// 2. Clase -----------------------------------------------------------------------------------
class EstadoTablero {
  constructor(gm) {
    this.gm = gm;
    this.TW = 52;
    this.TH = 26;
    this.mapas = MUNDOS.map((m, k) => this._crearMapa(m, k));
    this.pantalla = { x: ANCHO / 2, y: 190 };
    this.dadoPos = { x: 598, y: 304, r: 30 };
    this.emotes = [];
    this.usar(0);
  }

  get cfg() { return this.gm.config; }
  get vel() { return this.cfg.rapido ? 0.55 : 1; }   // modo rápido: todo dura menos
  get ultimaFase() {                                   // últimas rondas: las casillas dan el doble
    const r = this.cfg.rondas;
    return this.gm.ronda > (r >= 10 ? r - 3 : r - 1);
  }

  usar(k) {
    this.mapa = this.mapas[k] || this.mapas[0];
    this.mundo = MUNDOS[this.mapa.k];
    this.casillas = this.mapa.casillas;
    this.cam = { ...this.mapa.vista };
  }

  // 2.1 Armado del mapa --------------------------------------------------------------
  _trazar(ini, pasos) {
    const D = { R: [1, 0], L: [-1, 0], D: [0, 1], U: [0, -1] };
    const celdas = [];
    let [x, y] = ini;
    pasos.split(' ').forEach((cmd) => {
      const [dx, dy] = D[cmd[0]];
      for (let n = 0; n < Number(cmd.slice(1)); n++) { x += dx; y += dy; celdas.push([x, y]); }
    });
    return celdas;
  }

  _crearMapa(m, k) {
    const ruta = [[0, 0], ...this._trazar([0, 0], m.ruta)];
    const n = ruta.length;
    const atajos = (m.atajos || []).map((a) => ({ ...a, celdas: this._trazar(ruta[a.desde], a.pasos) }));
    const todas = [...ruta, ...atajos.flatMap((a) => a.celdas)];
    const I = Math.max(...todas.map((c) => c[0])), J = Math.max(...todas.map((c) => c[1]));
    const iso = (i, j) => ({ x: ((i - j - (I - J) / 2) * this.TW) / 2, y: ((i + j - (I + J) / 2) * this.TH) / 2 });
    const fijos = {
      [Math.round(n * 0.3)]: 'portal', [Math.round(n * 0.72)]: 'portal',
      [Math.round(n * 0.15)]: 'tienda', [Math.round(n * 0.5)]: 'tienda', [Math.round(n * 0.88)]: 'tienda',
    };
    const casillas = ruta.map(([i, j], t) => ({
      ...iso(i, j), i, j, k: t, rebote: 0, atajo: false,
      tipoBase: t === 0 ? 'inicio' : fijos[t] || m.patron[(t - 1) % m.patron.length],
      sig: [(t + 1) % n], ant: [(t - 1 + n) % n],
    }));
    // atajos: se cuelgan de la ruta principal
    atajos.forEach((a) => {
      const ini = casillas.length;
      a.celdas.forEach(([i, j], t) => {
        casillas.push({ ...iso(i, j), i, j, k: ini + t, rebote: 0, atajo: true, tipoBase: a.tipos[t % a.tipos.length], sig: [ini + t + 1], ant: [t ? ini + t - 1 : a.desde] });
      });
      const fin = casillas.length - 1;
      casillas[fin].sig = [a.hasta];
      casillas[a.desde].sig.push(ini);
      casillas[a.hasta].ant.push(fin);
    });
    // suelo y adornos (casi nada pegado al camino para que no lo tape)
    const ocupadas = new Set(todas.map(([i, j]) => `${i},${j}`));
    const suelo = [], adornos = [];
    let semilla = 7 + k * 13;
    const azar = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
    for (let i = 0; i <= I; i++) {
      for (let j = 0; j <= J; j++) {
        const p = iso(i, j);
        suelo.push({ ...p, par: (i + j) % 2 === 0 });
        if (ocupadas.has(`${i},${j}`)) continue;
        let pegada = false;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (ocupadas.has(`${i + di},${j + dj}`)) pegada = true;
        if (azar() < (pegada ? 0.12 : 0.6)) adornos.push({ ...p, tipo: m.adornos[Math.floor(azar() * m.adornos.length)], fase: azar() * 6 });
      }
    }
    if (m.id === 'lava') {
      const c = iso(I / 2, J / 2);
      adornos.splice(0, adornos.length, ...adornos.filter((a) => Math.hypot(a.x - c.x, a.y - c.y) > 60), { ...c, tipo: 'volcan', fase: 0 });
    }
    const esquinas = { arriba: iso(0, 0), der: iso(I, 0), abajo: iso(I, J), izq: iso(0, J) };
    const ancho = ((I + J) * this.TW) / 2 + this.TW, alto = ((I + J) * this.TH) / 2 + this.TH + 60;
    const z = Math.min(1.1, 570 / ancho, 250 / alto);
    return { k, casillas, suelo, adornos, esquinas, principal: n, vista: { x: 0, y: 14, z } };
  }

  // 2.2 Entrada a la ronda ----------------------------------------------------------------
  entrar() {
    const gm = this.gm;
    const nueva = gm.ronda === 0;
    if (nueva) gm.ronda = 1;
    this.usar(gm.mundo || 0);
    // tipo efectivo de cada casilla (según Ajustes)
    this.casillas.forEach((c) => { c.tipo = !this.cfg.especiales && ESPECIALES.has(c.tipoBase) ? 'normal' : c.tipoBase; });
    if (nueva || gm.estrellaK == null) this._moverEstrella(true);
    this.orden = gm.jugadores.slice();
    this.orden.forEach((j) => j.sprite.setEstado('idle'));
    this.turno = 0;
    this.dado = { valor: 1, mostrado: 1, ultimoCambio: 0, otro: 0 };
    this.dadoDoble = false;
    this.dadoFijo = 0;
    this.textos = [];
    this.particulas = [];
    this.salto = null;
    this.portal = null;
    this.cambio = null;
    this.menu = null;
    this.mov = null;
    this.siguiente = null;
    this.trasPausa = null;
    this.narracion = null;
    this.evento = null;
    this.saliendo = false;
    gm.audio.iniciarMusica(this.mundo.musica);
    this.cambiarFase('intro');
  }

  salir() { this.gm.audio.detenerMusica(); }

  get actual() { return this.orden[this.turno]; }

  cambiarFase(f) {
    this.fase = f;
    this.tFase = Date.now();
    if (['espera', 'rodando', 'menu', 'intro'].includes(f)) this.gm.difundir();
  }

  datosMando() {
    const m = this.menu;
    return {
      turnoDe: this.actual ? this.actual.id : null, fase: this.fase, ronda: this.gm.ronda, mundo: this.mundo.nombre,
      menu: m ? { para: m.j.id, titulo: m.titulo, opciones: m.opciones.map((o) => o.txt), deshab: m.opciones.map((o) => !!o.deshab), sel: m.sel } : null,
    };
  }

  narrar(tipo) {
    const lista = NARRADOR[tipo];
    if (lista) this.narracion = { txt: lista[Utils.entero(0, lista.length - 1)], t0: Date.now() };
  }

  /** Pone la estrella en una casilla normal al azar (lejos de donde estaba). */
  _moverEstrella(inicial = false) {
    const gm = this.gm;
    const libres = this.casillas.filter((c) => c.tipo === 'normal' && c.k !== gm.estrellaK && (!inicial || c.k > 8) && !(this.orden || []).some((j) => j.casilla === c.k));
    const c = libres[Utils.entero(0, libres.length - 1)] || this.casillas[10];
    gm.estrellaK = c.k;
    if (!inicial) this._texto('¡LA ESTRELLA SE MUEVE!', c, PALETA.amarillo);
  }

  /** Cuántos saltos hacen falta desde k hasta la estrella (camino más corto, contando atajos). */
  distanciaEstrella(k) {
    const meta = this.gm.estrellaK;
    const vistos = new Set([k]);
    let frente = [k], d = 0;
    while (frente.length && d < 200) {
      if (frente.includes(meta)) return d;
      const nuevo = [];
      frente.forEach((f) => this.casillas[f].sig.forEach((s) => { if (!vistos.has(s)) { vistos.add(s); nuevo.push(s); } }));
      frente = nuevo;
      d++;
    }
    return 99;
  }

  // 2.3 Menús ------------------------------------------------------------------------------------
  /**
   * Abre un menú para el jugador j. opciones = [{ txt, deshab }]. bot(opciones) devuelve el índice que elige un bot.
   * Se maneja con la cruceta + A (B cancela), con el ratón o tocando la opción en el celular.
   */
  abrirMenu(j, titulo, opciones, alElegir, { alCancelar = null, bot = () => 0, sub = '' } = {}) {
    this.menu = { j, titulo, sub, opciones, sel: Math.max(0, opciones.findIndex((o) => !o.deshab)), alElegir, alCancelar, bot, t0: Date.now() };
    this.cambiarFase('menu');
  }

  _elegirMenu(i) {
    const m = this.menu;
    if (!m) return;
    const op = m.opciones[i];
    if (!op || op.deshab) { this.gm.audio.tono('square', 200, 150, 0.08, 0.1); return; }
    this.menu = null;
    this.gm.audio.blip();
    m.alElegir(op, i);
    this.gm.difundir();
  }

  _cancelarMenu() {
    const m = this.menu;
    if (!m || !m.alCancelar) return;
    this.menu = null;
    m.alCancelar();
    this.gm.difundir();
  }

  _moverMenu(d) {
    const m = this.menu;
    if (!m) return;
    const n = m.opciones.length;
    m.sel = (m.sel + d + n) % n;
    this.gm.audio.tono('square', 660, 660, 0.03, 0.08);
    this.gm.difundir();
  }

  _pausa(ms, despues) { this.trasPausa = despues; this.duracionPausa = ms * this.vel; this.cambiarFase('pausa'); }

  // 2.4 Turno ----------------------------------------------------------------------------------------
  _menuObjetos(j) {
    const opciones = j.objetos.map((id) => ({ txt: OBJETOS[id].nombre + (id === 'escudo' ? ' (AUTOMÁTICO)' : ''), id, deshab: id === 'escudo' }));
    opciones.push({ txt: 'VOLVER', id: null });
    this.abrirMenu(j, 'TUS OBJETOS', opciones, (op) => {
      if (!op.id) { this.cambiarFase('espera'); return; }
      this.usarObjeto(j, op.id);
    }, { alCancelar: () => this.cambiarFase('espera') });
  }

  usarObjeto(j, id, valorBot = null) {
    const quitar = () => { const i = j.objetos.indexOf(id); if (i >= 0) j.objetos.splice(i, 1); };
    const c = this.casillas[j.casilla];
    switch (id) {
      case 'dado_doble':
        quitar();
        this.dadoDoble = true;
        this._texto('¡DADO DOBLE!', c, PALETA.cian);
        this.cambiarFase('espera');
        break;
      case 'dado_trucado': {
        const elegir = (n) => { quitar(); this.dadoFijo = n; this._texto(`DADO TRUCADO: ${n}`, c, PALETA.verde); this.cambiarFase('espera'); this.lanzar(); };
        if (valorBot) { elegir(valorBot); break; }
        this.abrirMenu(j, '¿CUÁNTO QUIERES SACAR?', [1, 2, 3, 4, 5, 6].map((n) => ({ txt: String(n), n })), (op) => elegir(op.n), { alCancelar: () => this.cambiarFase('espera') });
        break;
      }
      case 'ladron': {
        const otros = this.orden.filter((o) => o !== j);
        if (!otros.length) { this.cambiarFase('espera'); break; }
        const robar = (o) => {
          quitar();
          this.narrar('ladron');
          const n = this._perder(o, 5, false);
          j.monedas += n;
          if (n) this._texto(`¡LE ROBAS ${n} A ${o.nombre}!`, c, PALETA.rosa);
          this.cambiarFase('espera');
        };
        if (valorBot) { robar(valorBot); break; }
        this.abrirMenu(j, '¿A QUIÉN LE ROBAS?', otros.map((o) => ({ txt: `${o.nombre} (${o.monedas})`, o })), (op) => robar(op.o), { alCancelar: () => this.cambiarFase('espera') });
        break;
      }
      case 'teleport': {
        quitar();
        const meta = this.casillas[this.gm.estrellaK].ant[0];
        this.portal = { j, hasta: meta, t0: Date.now(), cambiado: false };
        this.trasPortal = () => this.cambiarFase('espera');
        this.gm.audio.tono('sine', 200, 1400, 0.4, 0.2);
        this.cambiarFase('portal');
        break;
      }
      default: this.cambiarFase('espera');
    }
  }

  /** Lo que hace un bot antes de lanzar (según la dificultad elegida). */
  _botAntesDeLanzar(j) {
    const listo = this.cfg.nivel !== 'facil' || Math.random() < 0.4;
    const dist = this.distanciaEstrella(j.casilla);
    if (listo && j.objetos.includes('teleport') && j.monedas >= COSTO_ESTRELLA && dist > 10) { this.usarObjeto(j, 'teleport'); return true; }
    if (listo && j.objetos.includes('dado_trucado') && dist >= 1 && dist <= 6) { this.usarObjeto(j, 'dado_trucado', dist); return true; }
    if (j.objetos.includes('ladron')) {
      const rico = this.orden.filter((o) => o !== j).sort((a, b) => b.monedas - a.monedas)[0];
      if (rico && rico.monedas > 4) { this.usarObjeto(j, 'ladron', rico); return true; }
    }
    if (j.objetos.includes('dado_doble') && !this.dadoDoble && (dist > 8 || !listo)) { this.usarObjeto(j, 'dado_doble'); return true; }
    return false;
  }

  lanzar() {
    if (this.fase !== 'espera') return;
    this.dado.valor = this.dadoFijo || Utils.entero(1, 10);
    this.dado.otro = this.dadoDoble && !this.dadoFijo ? Utils.entero(1, 10) : 0;
    this.narrar('dado');
    this.cambiarFase('rodando');
  }

  get totalDado() { return this.dado.valor + this.dado.otro; }

  /** Empieza un movimiento: `pasos` casillas hacia adelante (dir 1) o atrás (-1). `largo` = un solo gran salto. */
  mover(j, pasos, dir, aplicar, largo = 0) {
    this.mov = { j, pasos: largo ? 1 : pasos, dir, aplicar, largo, rama: null };
    this._paso();
  }

  _paso() {
    const m = this.mov;
    if (!m || !this.orden.includes(m.j)) { this.cambiarFase('efecto'); return; }
    const j = m.j;
    if (m.pasos <= 0) { this._finMovimiento(); return; }
    const c = this.casillas[j.casilla];
    if (m.dir > 0 && !m.largo && c.sig.length > 1 && m.rama == null) { this._abrirCruce(j, c); return; }
    let hasta;
    if (m.largo) { hasta = j.casilla; for (let i = 0; i < m.largo; i++) hasta = this.casillas[hasta].sig[0]; }
    else hasta = m.dir > 0 ? (m.rama != null ? m.rama : c.sig[0]) : c.ant[0];
    m.rama = null;
    this.salto = { j, desde: j.casilla, hasta, t0: Date.now(), dur: (m.largo ? 650 : 300) * this.vel, H: m.largo ? 70 : 26 };
    this.cambiarFase('saltando');
  }

  _abrirCruce(j, c) {
    const atajo = c.sig[1];
    const cortoDuro = this.casillas.filter((x) => x.atajo && this._mismoAtajo(atajo, x.k)).some((x) => ['trampa', 'agujero'].includes(x.tipo));
    const opciones = [
      { txt: 'CAMINO NORMAL', valor: c.sig[0] },
      { txt: cortoDuro ? 'ATAJO (¡PELIGROSO!)' : 'ATAJO (CON PREMIOS)', valor: atajo },
    ];
    this.abrirMenu(j, '¿POR DÓNDE VAS?', opciones, (op, i) => {
      if (i === 1) this.narrar('atajo');
      this.mov.rama = op.valor;
      this._paso();
    }, {
      sub: `TE QUEDAN ${this.mov.pasos} PASOS`,
      bot: () => {
        if (this.cfg.nivel === 'facil') return Utils.entero(0, 1);
        const d0 = this.distanciaEstrella(c.sig[0]), d1 = this.distanciaEstrella(atajo);
        return d1 < d0 && (this.cfg.nivel === 'dificil' || Math.random() < 0.7) ? 1 : 0;
      },
    });
  }

  _mismoAtajo(inicio, k) {
    let x = inicio;
    for (let n = 0; n < 12 && this.casillas[x].atajo; n++) { if (x === k) return true; x = this.casillas[x].sig[0]; }
    return false;
  }

  _finMovimiento() {
    const m = this.mov;
    this.salto = null;
    this.mov = null;
    if (m && m.aplicar) this._aplicarCasilla(m.j);
    else this.cambiarFase('efecto');
  }

  /** Al pasar o caer en la estrella: se puede comprar por 20 monedas. */
  _ofrecerEstrella(j, seguir) {
    if (j.monedas < COSTO_ESTRELLA) {
      this._texto(`TE FALTAN ${COSTO_ESTRELLA - j.monedas} PARA LA ESTRELLA`, this.casillas[j.casilla], PALETA.hielo);
      this._pausa(900, seguir);
      return;
    }
    this.abrirMenu(j, `¿COMPRAR LA ESTRELLA POR ${COSTO_ESTRELLA}?`, [{ txt: '¡SÍ, LA QUIERO!' }, { txt: 'NO, GRACIAS' }], (op, i) => {
      if (i === 0) {
        j.monedas -= COSTO_ESTRELLA;
        j.estrellas++;
        j.stats.compras++;
        j.sprite.reaccion('feliz');
        this.narrar('estrella');
        const c = this.casillas[j.casilla];
        this._texto('¡+1 ESTRELLA!', c, PALETA.amarillo);
        for (let n = 0; n < 30; n++) this.particulas.push({ x: c.x, y: c.y - 20, vx: Utils.azar(-3, 3), vy: Utils.azar(-5, -1), vida: 50, color: n % 2 ? PALETA.amarillo : PALETA.hielo });
        this.gm.audio.fanfarria();
        this._moverEstrella();
        this._pausa(1400, seguir);
      } else seguir();
    }, { bot: () => 0, sub: `TIENES ${j.monedas} MONEDAS` });
  }

  _tienda(j) {
    const ids = Object.keys(OBJETOS).sort(() => Math.random() - 0.5).slice(0, 3);
    const lleno = j.objetos.length >= MAX_OBJETOS;
    const opciones = ids.map((id) => ({ txt: `${OBJETOS[id].nombre} · ${OBJETOS[id].precio}`, id, deshab: lleno || j.monedas < OBJETOS[id].precio }));
    opciones.push({ txt: 'SALIR', id: null });
    this.narrar('tienda');
    this.abrirMenu(j, 'TIENDA GALÁCTICA', opciones, (op) => {
      if (op.id) {
        j.monedas -= OBJETOS[op.id].precio;
        j.objetos.push(op.id);
        this._texto(`¡COMPRASTE ${OBJETOS[op.id].nombre}!`, this.casillas[j.casilla], OBJETOS[op.id].color);
        this.gm.audio.exito();
      }
      this.cambiarFase('efecto');
    }, {
      alCancelar: () => this.cambiarFase('efecto'),
      sub: lleno ? 'YA TIENES 3 OBJETOS' : `TIENES ${j.monedas} MONEDAS`,
      bot: (ops) => {
        const posibles = ops.map((o, i) => (!o.deshab && o.id ? i : -1)).filter((i) => i >= 0);
        const gasta = this.cfg.nivel === 'facil' ? 0.4 : 0.8;
        return posibles.length && j.monedas - 8 >= 0 && Math.random() < gasta ? posibles[Utils.entero(0, posibles.length - 1)] : ops.length - 1;
      },
    });
  }

  // 2.5 Efecto de cada casilla ----------------------------------------------------------------------
  _aterrizar(c, color) {
    c.rebote = Date.now();
    for (let i = 0; i < 8; i++) this.particulas.push({ x: c.x, y: c.y, vx: Utils.azar(-1.6, 1.6), vy: Utils.azar(-2.4, -0.6), vida: 30, color: color || CASILLAS[c.tipo].color });
  }

  _texto(txt, c, color) { this.textos.push({ txt, x: c.x, y: c.y - 54 - this.textos.filter((t) => Date.now() - t.t0 < 300).length * 12, color, t0: Date.now() }); }

  /** Gana monedas (si es casilla y estamos en las últimas rondas, el doble). */
  _ganar(j, n, deCasilla = true) {
    const total = deCasilla && this.ultimaFase ? n * 2 : n;
    j.monedas += total;
    const c = this.casillas[j.casilla];
    this._texto(`+${total} MONEDAS`, c, PALETA.amarillo);
    j.sprite.reaccion('feliz');
    this.gm.audio.exito();
    for (let i = 0; i < 10; i++) this.particulas.push({ x: c.x, y: c.y - 20, vx: Utils.azar(-2, 2), vy: Utils.azar(-3, -1), vida: 40, color: PALETA.amarillo });
    return total;
  }

  /** Pierde monedas, salvo que tenga escudo. Devuelve cuánto perdió de verdad. */
  _perder(j, n, deCasilla = true) {
    const c = this.casillas[j.casilla];
    const i = j.objetos.indexOf('escudo');
    if (i >= 0) {
      j.objetos.splice(i, 1);
      this._texto('¡ESCUDO! NO PIERDES NADA', c, PALETA.amarillo);
      this.narrar('escudo');
      this.gm.audio.tono('square', 600, 1200, 0.15, 0.15);
      return 0;
    }
    const total = Math.min(j.monedas, deCasilla && this.ultimaFase ? n * 2 : n);
    j.monedas -= total;
    j.stats.trampas++;
    this._texto(`-${total} MONEDAS`, c, PALETA.laser);
    j.sprite.reaccion('triste');
    this.gm.audio.derrota();
    return total;
  }

  _aplicarCasilla(j) {
    const c = this.casillas[j.casilla];
    const audio = this.gm.audio;
    const otros = this.orden.filter((o) => o !== j);
    switch (c.tipo) {
      case 'normal': this._ganar(j, 2); break;
      case 'estrella': this._ganar(j, 5); break;
      case 'inicio': this._ganar(j, 3); break;
      case 'trampa': this.narrar('trampa'); this._perder(j, 3); break;
      case 'tienda': this._tienda(j); return;
      case 'turbo':
        this.narrar('turbo');
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
        audio.tono('sawtooth', 120, 40, 0.6, 0.25);
        this.gm.sacudida = 24;
        otros.forEach((o) => this._perder(o, 2));
        for (let i = 0; i < 24; i++) this.particulas.push({ x: c.x, y: c.y - 10, vx: Utils.azar(-3, 3), vy: Utils.azar(-5, -2), vida: 45, color: i % 2 ? PALETA.naranja : PALETA.amarillo });
        break;
      case 'casino':
        this.narrar('casino');
        if (Math.random() < 0.5) { this._texto('CASINO: ¡GANASTE!', c, '#00e5c0'); this._ganar(j, 6); }
        else { this._texto('CASINO: PERDISTE...', c, PALETA.rosa); this._perder(j, 4); }
        break;
      case 'agujero':
        this.narrar('agujero');
        if (j.objetos.includes('escudo')) { this._perder(j, 0); break; }
        this._texto('¡AGUJERO NEGRO! -3', c, PALETA.morado);
        j.stats.trampas++;
        j.sprite.reaccion('triste');
        audio.tono('sawtooth', 500, 80, 0.5, 0.15);
        this.siguiente = () => this.mover(j, 3, -1, false);
        break;
      case 'portal':
        this._texto('¡PORTAL!', c, PALETA.morado);
        audio.tono('sine', 200, 1400, 0.4, 0.2);
        this.siguiente = () => {
          const destino = this.casillas.find((o) => o.tipo === 'portal' && o.k !== c.k);
          if (!destino) { this.cambiarFase('efecto'); return; }
          this.portal = { j, hasta: destino.k, t0: Date.now(), cambiado: false };
          this.cambiarFase('portal');
        };
        break;
      case 'cambio':
        if (!otros.length) { this._ganar(j, 2); break; }
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
        this.narrar('cofre');
        const r = Math.random();
        if (r < 0.5 || !otros.length) this._ganar(j, Utils.entero(3, 8), false);
        else if (r < 0.7 && j.objetos.length < MAX_OBJETOS) {
          const ids = Object.keys(OBJETOS);
          const id = ids[Utils.entero(0, ids.length - 1)];
          j.objetos.push(id);
          this._texto(`¡ENCONTRASTE ${OBJETOS[id].nombre}!`, c, OBJETOS[id].color);
          audio.exito();
        } else if (r < 0.88) {
          const rico = otros.slice().sort((a, b) => b.monedas - a.monedas)[0];
          const n = this._perder(rico, 3, false);
          j.monedas += n;
          if (n) this._texto(`¡ROBAS ${n} A ${rico.nombre}!`, c, PALETA.naranja);
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
    this.dadoDoble = false;
    this.dadoFijo = 0;
    this.turno++;
    if (this.turno >= this.orden.length) this._eventoFinal();
    else this.cambiarFase('espera');
  }

  // 2.6 Evento de fin de ronda ------------------------------------------------------------------------
  _eventoFinal() {
    const lista = this.orden;
    const eventos = [
      { titulo: 'LLUVIA DE METEORITOS', sub: '3 JUGADORES PIERDEN 3 MONEDAS', fn: () => lista.slice().sort(() => Math.random() - 0.5).slice(0, 3).forEach((j) => this._perder(j, 3, false)) },
      { titulo: 'BONO ESTELAR', sub: 'TODOS GANAN 5 MONEDAS', fn: () => lista.forEach((j) => this._ganar(j, 5, false)) },
      { titulo: 'TORMENTA DE MONEDAS', sub: 'EL ÚLTIMO LUGAR GANA 10', fn: () => { const u = this.gm.clasificacion().slice(-1)[0]; if (u) this._ganar(u, 10, false); } },
      { titulo: 'LA ESTRELLA SE ESCAPA', sub: 'CAMBIA DE LUGAR', fn: () => this._moverEstrella() },
      { titulo: 'INTERCAMBIO CÓSMICO', sub: 'DOS JUGADORES CAMBIAN DE LUGAR', fn: () => {
        if (lista.length < 2) return;
        const [a, b] = lista.slice().sort(() => Math.random() - 0.5);
        [a.casilla, b.casilla] = [b.casilla, a.casilla];
        this._aterrizar(this.casillas[a.casilla], PALETA.rosa);
        this._aterrizar(this.casillas[b.casilla], PALETA.rosa);
      } },
    ];
    this.evento = eventos[Utils.entero(0, eventos.length - 1)];
    this.gm.audio.tono('square', 220, 880, 0.4, 0.15);
    this.cambiarFase('evento');
  }

  // --- actualizar ---
  actualizar() {
    const ahora = Date.now();
    const e = ahora - this.tFase;
    const j = this.actual;
    const audio = this.gm.audio;
    const v = this.vel;
    if (!this.orden.length) return;

    switch (this.fase) {
      case 'intro':
        if (e > 2200 * v) this.cambiarFase('espera');
        break;
      case 'espera':
        if (j && j.esBot && e > 900 * v && !this._botAntesDeLanzar(j)) this.lanzar();
        break;
      case 'menu': {
        const m = this.menu;
        if (m && m.j.esBot && e > 800 * v) this._elegirMenu(m.bot(m.opciones));
        break;
      }
      case 'pausa':
        if (e > this.duracionPausa) { const f = this.trasPausa; this.trasPausa = null; if (f) f(); }
        break;
      case 'rodando':
        if (ahora - this.dado.ultimoCambio > 70 && e < 1500 * v) {
          this.dado.ultimoCambio = ahora;
          this.dado.mostrado = Utils.entero(1, 10);
          audio.tono('square', 1200, 900, 0.03, 0.05);
        }
        if (e >= 1500 * v) {
          this.dado.mostrado = this.dado.valor;
          audio.blip();
          this.cambiarFase('resultado');
        }
        break;
      case 'resultado':
        if (e > 800 * v) this.mover(j, this.totalDado, 1, true);
        break;
      case 'saltando': {
        const s = this.salto;
        if (!s || !this.orden.includes(s.j)) { this.salto = null; this.mov = null; this.cambiarFase('efecto'); break; }
        if (Utils.progreso(s.t0, s.dur, ahora) >= 1) {
          s.j.casilla = s.hasta;
          s.j.stats.pasos++;
          this.salto = null;
          const c = this.casillas[s.hasta];
          this._aterrizar(c);
          audio.tono('triangle', 300, 600, 0.06, 0.12);
          const m = this.mov;
          if (m) m.pasos--;
          if (m && m.pasos > 0 && c.tipo === 'inicio' && m.dir > 0) this._ganar(s.j, 3, false);
          if (m && m.dir > 0 && c.k === this.gm.estrellaK) this._ofrecerEstrella(s.j, () => this._paso());
          else this._paso();
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
        if (e >= 900) {
          this.portal = null;
          const f = this.trasPortal;
          this.trasPortal = null;
          if (f) f(); else this.cambiarFase('efecto');
        }
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
        if (e > (this.siguiente ? 800 : 1000) * v) {
          if (this.siguiente) { const f = this.siguiente; this.siguiente = null; f(); }
          else this._siguienteTurno();
        }
        break;
      case 'evento':
        if (!this.evento.hecho && e > 900) { this.evento.hecho = true; this.evento.fn(); }
        if (e > 3000 * v) this.cambiarFase('aviso');
        break;
      case 'aviso':
        if (e > 1400 * v && !this.saliendo) {
          this.saliendo = true;
          this.gm.cambiarEstado(ESTADO.MINIJUEGO, 'zoom');
        }
        break;
      default: break;
    }

    // cámara: vista general en intro/evento; de cerca durante el turno
    const vista = this.mapa.vista;
    let meta = vista;
    if (j && !['intro', 'aviso', 'evento'].includes(this.fase)) {
      const p = this._posicion(j);
      const z = ['saltando', 'efecto', 'portal', 'cambio', 'pausa'].includes(this.fase) ? 1.55 : 1.3;
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

  // 2.7 Dibujo ---------------------------------------------------------------------------------
  _yCasilla(c, ahora = Date.now()) {
    const ola = 1.2 * Math.sin(ahora / 600 + c.k * 0.5);
    const p = Utils.progreso(c.rebote, 450, ahora);
    return c.y + ola + (p < 1 ? -8 * Math.sin(p * Math.PI) * (1 - p) : 0);
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

  /** Mundo → pantalla (para emotes y la flecha de la estrella). */
  aPantalla(x, y) {
    return { x: this.pantalla.x + (x - this.cam.x) * this.cam.z, y: this.pantalla.y + (y - this.cam.y) * this.cam.z };
  }

  posPantalla(j) {
    if (!this.orden || !this.orden.includes(j)) return null;
    const p = this._posicion(j);
    return this.aPantalla(p.x, p.y - 46);
  }

  _dibujarSuelo(ctx, m, mapa, escala = 1) {
    const { arriba, der, abajo, izq } = mapa.esquinas;
    const w = (this.TW / 2) * escala, h = (this.TH / 2) * escala, prof = 30 * escala;
    const P = (p, dx, dy) => [p.x * escala + dx, p.y * escala + dy];
    const A = P(arriba, 0, -h), D = P(der, w, 0), B = P(abajo, 0, h), I = P(izq, -w, 0);
    ctx.fillStyle = m.lado;
    ctx.strokeStyle = PALETA.fondo;
    ctx.lineWidth = 3 * escala;
    ctx.beginPath();
    ctx.moveTo(...I); ctx.lineTo(...B); ctx.lineTo(...D); ctx.lineTo(D[0], D[1] + prof); ctx.lineTo(B[0], B[1] + prof); ctx.lineTo(I[0], I[1] + prof);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PALETA.fondo;
    ctx.globalAlpha = 0.25;
    for (let t = 0.15; t < 1; t += 0.22) {
      ctx.fillRect(Utils.lerp(I[0], B[0], t), Utils.lerp(I[1], B[1], t) + prof * 0.4, 6 * escala, 3 * escala);
      ctx.fillRect(Utils.lerp(B[0], D[0], t), Utils.lerp(B[1], D[1], t) + prof * 0.6, 8 * escala, 3 * escala);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = m.suelo;
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...D); ctx.lineTo(...B); ctx.lineTo(...I); ctx.closePath(); ctx.fill();
    ctx.fillStyle = m.suelo2;
    for (const s of mapa.suelo) {
      if (!s.par) continue;
      const x = s.x * escala, y = s.y * escala;
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.lineTo(x - w, y); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = m.borde;
    ctx.lineWidth = 3 * escala;
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...D); ctx.lineTo(...B); ctx.lineTo(...I); ctx.closePath(); ctx.stroke();
  }

  _adorno(ctx, a, ahora) {
    const { x, y } = a;
    const R = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + px), Math.round(y + py), w, h); };
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
        R(-1, -h - 8, 2, 8, '#4a3a9a');
        if (Math.sin(ahora / 200 + a.fase) > 0) R(-2, -h - 10, 4, 3, PALETA.laser);
        break;
      }
      case 'cartel': {
        const on = Math.sin(ahora / 400 + a.fase) > -0.3;
        R(-2, -10, 4, 10, '#4a3a9a'); R(-16, -26, 32, 16, '#1c1147');
        ctx.strokeStyle = on ? PALETA.rosa : '#5a2a7a';
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(x - 16) + 1, Math.round(y - 26) + 1, 30, 14);
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
    if (c.atajo) {                                          // los atajos llevan borde punteado
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = PALETA.hielo;
      ctx.beginPath(); ctx.moveTo(c.x, y - h + 3); ctx.lineTo(c.x + w - 5, y); ctx.lineTo(c.x, y + h - 3); ctx.lineTo(c.x - w + 5, y); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
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
    }
    if (info.marca) Utils.texto(ctx, info.marca, c.x, y + 1, { tam: 7, color: info.tinta });
    if (c.k === this.gm.estrellaK) this._dibujarEstrella(ctx, c.x, y - 24, 1, ahora);
  }

  /** La estrella que se compra: gira, brilla y flota. */
  _dibujarEstrella(ctx, x, y, esc, ahora = Date.now()) {
    const r = 11 * esc * (1 + Math.sin(ahora / 200) * 0.06);
    const giro = Math.sin(ahora / 500) * 0.3;
    ctx.save();
    ctx.translate(x, y + Math.sin(ahora / 300) * 3 * esc);
    ctx.rotate(giro);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PALETA.amarillo;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = PALETA.amarillo;
    ctx.fill();
    ctx.lineWidth = 2 * esc;
    ctx.strokeStyle = PALETA.fondo;
    ctx.stroke();
    ctx.fillStyle = PALETA.hielo;
    ctx.fillRect(-r * 0.3, -r * 0.45, 3 * esc, 3 * esc);
    ctx.restore();
  }

  dibujarMiniatura(ctx, k, x, y, ancho, ahora = Date.now()) {
    const mapa = this.mapas[k], m = MUNDOS[k];
    const { der, izq } = mapa.esquinas;
    const esc = ancho / (der.x - izq.x + this.TW);
    ctx.save();
    ctx.translate(x, y);
    this._dibujarSuelo(ctx, m, mapa, esc);
    const w = (this.TW / 2) * esc, h = (this.TH / 2) * esc;
    mapa.casillas.forEach((c, i) => {
      const cy = c.y * esc + (Math.floor(ahora / 80) % mapa.casillas.length === i ? -3 : 0);
      ctx.fillStyle = CASILLAS[c.tipoBase].color;
      ctx.beginPath(); ctx.moveTo(c.x * esc, cy - h); ctx.lineTo(c.x * esc + w, cy); ctx.lineTo(c.x * esc, cy + h); ctx.lineTo(c.x * esc - w, cy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = PALETA.fondo; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.restore();
  }

  _dibujarDado(ctx) {
    const { x, r: R } = this.dadoPos;
    let { y } = this.dadoPos;
    const ahora = Date.now();
    const e = ahora - this.tFase;
    let ang = 0, sx = 1;
    if (this.fase === 'rodando') {
      const dur = 1500 * this.vel;
      const p = Utils.clamp(e / dur, 0, 1);
      y -= (1 - Utils.easeOutBounce(Utils.clamp(e / 450, 0, 1))) * 90;     // cae desde arriba rebotando
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
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(sx, 1);
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.dadoDoble ? PALETA.amarillo : PALETA.cian;
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
    const mostrar = ['rodando', 'resultado', 'saltando', 'efecto', 'menu', 'pausa'].includes(this.fase) && this.dado.mostrado;
    if (this.dadoDoble && this.fase === 'espera') Utils.texto(ctx, 'X2', x, y - R - 10, { tam: 7, color: PALETA.amarillo, borde: PALETA.fondo });
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
    ctx.translate(x, y + 2);
    ctx.scale(Math.max(0.01, k), Math.max(0.01, k));
    const txt = this.fase === 'rodando' ? String(this.dado.mostrado) : String(this.totalDado);
    Utils.texto(ctx, txt, 0, 0, { tam: 13, color: PALETA.hielo, borde: PALETA.fondo });
    ctx.restore();
    if (this.dado.otro && this.fase !== 'rodando') Utils.texto(ctx, `${this.dado.valor}+${this.dado.otro}`, x, y + R + 10, { tam: 6, color: PALETA.amarillo, borde: PALETA.fondo });
  }

  dibujar(ctx) {
    const gm = this.gm;
    const ahora = Date.now();
    const m = this.mundo;

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
    // camino punteado (ruta + atajos)
    ctx.save();
    ctx.strokeStyle = PALETA.hielo;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -ahora / 50;
    ctx.beginPath();
    this.casillas.forEach((c) => c.sig.forEach((s) => { const d = this.casillas[s]; ctx.moveTo(c.x, this._yCasilla(c, ahora) + 5); ctx.lineTo(d.x, this._yCasilla(d, ahora) + 5); }));
    ctx.stroke();
    ctx.restore();
    const cosas = [];
    this.casillas.forEach((c) => cosas.push({ y: c.y, fn: () => this._dibujarCasilla(ctx, c, ahora) }));
    this.mapa.adornos.forEach((a) => cosas.push({ y: a.y, fn: () => this._adorno(ctx, a, ahora) }));
    this.orden.forEach((j) => {
      const p = this._posicion(j);
      cosas.push({ y: p.y + 1, fn: () => this._dibujarAvatar(ctx, j, p, ahora) });
    });
    cosas.sort((a, b) => a.y - b.y).forEach((c) => c.fn());
    // flechas del cruce
    if (this.fase === 'menu' && this.menu && this.menu.titulo === '¿POR DÓNDE VAS?') {
      this.menu.opciones.forEach((o, i) => {
        const c = this.casillas[o.valor];
        const y = this._yCasilla(c, ahora) - 30 + (i === this.menu.sel ? Math.sin(ahora / 120) * 4 : 0);
        ctx.fillStyle = i === this.menu.sel ? PALETA.amarillo : PALETA.hielo;
        ctx.strokeStyle = PALETA.fondo;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c.x - 9, y - 10); ctx.lineTo(c.x + 9, y - 10); ctx.lineTo(c.x, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        Utils.texto(ctx, i ? 'ATAJO' : 'NORMAL', c.x, y - 18, { tam: 5, color: ctx.fillStyle, borde: PALETA.fondo });
      });
    }
    Utils.texto(ctx, 'INICIO', this.casillas[0].x, this.casillas[0].y - 24, { tam: 5, color: PALETA.hielo, borde: PALETA.fondo });
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
    if (this.menu) this._dibujarMenu(ctx, ahora);
    if (this.fase === 'intro') {
      const sub = this.ultimaFase ? '¡ÚLTIMAS RONDAS: TODO DA EL DOBLE!' : `RONDA ${gm.ronda} DE ${this.cfg.rondas}`;
      this._cartel(ctx, gm.ronda === 1 ? m.nombre : `RONDA ${gm.ronda}`, sub, this.ultimaFase ? PALETA.naranja : m.cielo);
    }
    if (this.fase === 'evento' && this.evento) this._cartel(ctx, this.evento.titulo, this.evento.sub, PALETA.morado);
    if (this.fase === 'aviso') this._cartel(ctx, '¡MINIJUEGO!', 'A LA RULETA...', PALETA.rosa);
  }

  /** Si la estrella está fuera de la pantalla, una flecha en el borde dice hacia dónde queda. */
  _flechaEstrella(ctx, ahora) {
    const c = this.casillas[this.gm.estrellaK];
    if (!c) return;
    const p = this.aPantalla(c.x, c.y - 24);
    const dentro = p.x > 24 && p.x < ANCHO - 24 && p.y > 40 && p.y < 318;
    if (dentro) return;
    const cx = ANCHO / 2, cy = 180;
    const ang = Math.atan2(p.y - cy, p.x - cx);
    const x = Utils.clamp(p.x, 30, ANCHO - 30), y = Utils.clamp(p.y, 46, 312);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = PALETA.amarillo;
    ctx.strokeStyle = PALETA.fondo;
    ctx.lineWidth = 2;
    const b = Math.sin(ahora / 150) * 3;
    ctx.beginPath(); ctx.moveTo(14 + b, 0); ctx.lineTo(2 + b, -8); ctx.lineTo(2 + b, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    this._dibujarEstrella(ctx, x - Math.cos(ang) * 6, y - Math.sin(ang) * 6, 0.7, ahora);
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
    if (j === this.actual && !['aviso', 'evento'].includes(this.fase)) {
      const by = p.y - 52 + Math.sin(ahora / 150) * 3;
      // pasos que le faltan mientras avanza
      if (this.mov && this.mov.j === j && this.mov.pasos > 0) {
        Utils.panel(ctx, p.x - 9, by - 20, 18, 16, PALETA.amarillo, PALETA.fondo, 2);
        Utils.texto(ctx, String(this.mov.pasos), p.x, by - 11, { tam: 8, color: PALETA.fondo });
        return;
      }
      ctx.fillStyle = PALETA.amarillo;
      ctx.strokeStyle = PALETA.fondo;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x - 6, by - 7); ctx.lineTo(p.x + 6, by - 7); ctx.lineTo(p.x, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  _dibujarHud(ctx, ahora) {
    const n = this.orden.length;
    const w = Math.min(96, (ANCHO - 16) / Math.max(1, n));
    const x0 = (ANCHO - w * n) / 2;
    this.orden.forEach((j, i) => {
      const x = x0 + i * w, activo = j === this.actual;
      const y = activo ? 4 : 2;
      Utils.panel(ctx, x + 2, y, w - 4, 26, activo ? j.def.color : PALETA.fondo, activo ? PALETA.hielo : j.def.color, 2);
      j.sprite.dibujar(ctx, x + 14, y + 14, 24, ahora);
      const tinta = activo ? PALETA.fondo : PALETA.hielo;
      Utils.texto(ctx, j.nombre.slice(0, 7), x + 27, y + 8, { tam: 5, alin: 'left', color: tinta });
      this._dibujarEstrella(ctx, x + 30, y + 18, 0.32, 0);
      Utils.texto(ctx, String(j.estrellas), x + 35, y + 19, { tam: 6, alin: 'left', color: activo ? PALETA.fondo : PALETA.amarillo });
      ctx.fillStyle = PALETA.amarillo; ctx.fillRect(x + 47, y + 16, 4, 4);
      ctx.strokeStyle = PALETA.fondo; ctx.lineWidth = 1; ctx.strokeRect(x + 47.5, y + 16.5, 3, 3);
      Utils.texto(ctx, String(j.monedas), x + 53, y + 19, { tam: 6, alin: 'left', color: tinta });
      j.objetos.forEach((id, k) => { ctx.fillStyle = OBJETOS[id].color; ctx.fillRect(x + w - 10, y + 5 + k * 6, 4, 4); });
    });
    Utils.panel(ctx, 6, 330, 552, 26, PALETA.fondo, PALETA.cian, 2);
    Utils.texto(ctx, `RONDA ${this.gm.ronda}/${this.cfg.rondas}`, 14, 343, { tam: 6, alin: 'left', color: this.ultimaFase ? PALETA.naranja : PALETA.amarillo });
    const j = this.actual;
    let txt = this.mundo.nombre, color = PALETA.hielo;
    if (this.narracion && ahora - this.narracion.t0 < 2400) {
      const letras = Math.floor((ahora - this.narracion.t0) / 30);
      txt = 'NARRADOR: ' + this.narracion.txt.slice(0, letras);
      color = PALETA.amarillo;
    } else if (j && this.fase === 'espera') {
      if (j.remoto) txt = `${j.nombre}: PULSA A EN TU CELULAR`;
      else if (j.esBot) txt = `${j.nombre} ESTÁ PENSANDO...`;
      else txt = `${j.nombre}: ${j.id === 'local2' ? 'K' : 'F'}/ESPACIO = DADO · ${j.id === 'local2' ? 'L' : 'G'} = OBJETOS`;
    } else if (j) {
      const d = this.distanciaEstrella(j.casilla);
      txt = `${j.nombre} · LA ESTRELLA ESTÁ A ${d} CASILLAS`;
    }
    Utils.texto(ctx, txt, 104, 343, { tam: 6, alin: 'left', color });
  }

  _dibujarMenu(ctx, ahora) {
    const m = this.menu;
    const p = Utils.easeOutBack(Utils.progreso(m.t0, 350, ahora));
    const ancho = 300, alto = 46 + m.opciones.length * 22 + (m.sub ? 10 : 0);
    const x = (ANCHO - ancho) / 2, y = Math.max(40, 176 - alto / 2);
    ctx.save();
    ctx.translate(ANCHO / 2, y + alto / 2);
    ctx.scale(Math.max(0.01, p), Math.max(0.01, p));
    ctx.translate(-ANCHO / 2, -(y + alto / 2));
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(x + 4, y + 4, ancho, alto);
    Utils.panel(ctx, x, y, ancho, alto, PALETA.morado, PALETA.hielo, 3);
    Utils.texto(ctx, m.titulo, ANCHO / 2, y + 16, { tam: 8, color: PALETA.amarillo, borde: PALETA.fondo, grosor: 4 });
    Utils.texto(ctx, `${m.j.nombre}${m.sub ? ' · ' + m.sub : ''}`, ANCHO / 2, y + 30, { tam: 5, color: PALETA.hielo });
    this.zonasMenu = [];
    m.opciones.forEach((o, i) => {
      const oy = y + 40 + (m.sub ? 4 : 0) + i * 22;
      const sel = i === m.sel;
      Utils.panel(ctx, x + 14, oy, ancho - 28, 18, sel ? PALETA.amarillo : PALETA.fondo, sel ? PALETA.hielo : PALETA.fondo, 2);
      Utils.texto(ctx, o.txt, ANCHO / 2, oy + 10, { tam: 6, color: o.deshab ? '#7a6aa8' : sel ? PALETA.fondo : PALETA.hielo });
      this.zonasMenu.push({ x: x + 14, y: oy, w: ancho - 28, h: 18, i });
    });
    ctx.restore();
    if (!m.j.esBot && !m.j.remoto) Utils.texto(ctx, `CRUCETA PARA ELEGIR · ${m.j.id === 'local2' ? 'K' : 'F'} O ENTER PARA ACEPTAR`, ANCHO / 2, y + alto + 12, { tam: 5, color: PALETA.hielo, borde: PALETA.fondo });
  }

  _cartel(ctx, titulo, sub, color) {
    const k = Utils.easeOutBack(Utils.progreso(this.tFase, 500));
    ctx.save();
    ctx.translate(ANCHO / 2, ALTO / 2 - 10);
    ctx.scale(Math.max(0.001, k), Math.max(0.001, k));
    ctx.fillStyle = PALETA.fondo;
    ctx.fillRect(-176, -32, 360, 72);
    Utils.panel(ctx, -180, -36, 360, 72, color, PALETA.fondo, 4);
    Utils.texto(ctx, titulo, 0, -8, { tam: titulo.length > 16 ? 11 : 14, color: PALETA.hielo, borde: PALETA.fondo, grosor: 5 });
    Utils.texto(ctx, sub, 0, 18, { tam: 6, color: PALETA.fondo });
    ctx.restore();
  }

  // 2.8 Entradas ------------------------------------------------------------------------------------
  onTecla(e) {
    if (this.menu && !this.menu.j.esBot) {
      if (e.code === 'Enter' || e.code === 'Space') this._elegirMenu(this.menu.sel);
      else if (e.code === 'Escape') this._cancelarMenu();
      else if (!this.gm.jugadores.some((j) => j.id === 'local2') && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) this._moverMenu(e.code === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter') this.lanzar();
  }

  onDir(j, x, y) {
    if (this.menu && this.menu.j === j) this._moverMenu(y || x);
  }

  onBoton(j, b) {
    if (this.menu) {
      if (this.menu.j !== j) return;
      if (b === 'A') this._elegirMenu(this.menu.sel); else this._cancelarMenu();
      return;
    }
    if (j !== this.actual || this.fase !== 'espera') return;
    if (b === 'A') this.lanzar();
    else if (j.objetos.length) this._menuObjetos(j);
  }

  /** Toque directo a una opción desde el celular. */
  onOpcion(j, i) { if (this.menu && this.menu.j === j) this._elegirMenu(i); }

  onClick(x, y) {
    if (this.menu) {
      if (this.menu.j.esBot || this.menu.j.remoto) return;
      const z = (this.zonasMenu || []).find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (z) this._elegirMenu(z.i);
      return;
    }
    const d = this.dadoPos;
    const j = this.actual;
    if (j && !j.esBot && Math.hypot(x - d.x, y - d.y) <= d.r + 14) this.lanzar();
  }

  alSalir(j) {
    const i = this.orden.indexOf(j);
    if (i < 0) return;
    this.orden.splice(i, 1);
    if (this.salto && this.salto.j === j) this.salto = null;
    if (this.portal && this.portal.j === j) this.portal = null;
    if (this.cambio && (this.cambio.a === j || this.cambio.b === j)) this.cambio = null;
    if (this.mov && this.mov.j === j) this.mov = null;
    if (this.menu && this.menu.j === j) this.menu = null;
    if (!this.orden.length) { this.gm.cambiarEstado(ESTADO.LOBBY); return; }
    if (i < this.turno) this.turno--;
    else if (i === this.turno && !['intro', 'aviso', 'evento'].includes(this.fase)) {
      this.siguiente = null;
      if (this.turno >= this.orden.length) this._eventoFinal(); else this.cambiarFase('espera');
    }
  }
}
