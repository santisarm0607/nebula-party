/* =========================================================
   NEBULA PARTY - script.js  (v1.0: multijugador a distancia; ver agitar.js, minijuegos.js, red.js y espejo.js)
   Índice:
   1. Datos            2. Estado          3. Utilidades
   4. Pantallas        5. Fondo estrellas 6. Menú
   7. Escoger personaje                   8. Escoger mundo
   9. Mapas, tablero y HUD
   9B. Dado d10        9C. Turnos y movimiento    10. Pausa y opciones
   11. Teclado         12. Arranque
   ========================================================= */
'use strict';

/* ---------- 1. DATOS ---------- */
const PERSONAJES = [
  { id: 'scrap-e', nombre: 'Scrap-E' },
  { id: 'plasmo', nombre: 'Plasmo' },
  { id: 'astro-max', nombre: 'Astro-Max' },
  { id: 'nova', nombre: 'Nova' },
  { id: 'laika-x', nombre: 'Laika-X' },
  { id: 'zorblax', nombre: 'Zorblax' },
  { id: 'octo-z', nombre: 'Octo-Z' },
  { id: 'lil-zim', nombre: 'Lil-Zim' }
];

// Mundos: forma de la isla, casillas totales, atajos (ángulos en vueltas de π) y regla especial
const MUNDOS = [
  { id: 'glaciar', nombre: 'Glaciar Cristal', casillas: 116, forma: 'estrella', semilla: 11,
    atajos: [[0.25, 0.75], [1.25, 1.75]],
    regla: { icono: '~', titulo: 'Hielo resbaloso', texto: 'Te deslizas 2 más' },
    colores: { mar: '#1f4689', mar2: '#2b5ca6', suelo: '#d9f3ff', suelo2: '#b8e3f7', borde: '#7cc8ee', camino: '#ffffff', regla: '#bff0ff' } },
  { id: 'jungla', nombre: 'Jungla Alien', casillas: 100, forma: 'mani', semilla: 23,
    atajos: [[0.42, 1.58], [0.58, 1.42]],
    regla: { icono: '^4', titulo: 'Lianas', texto: 'Saltas 4 de una vez' },
    colores: { mar: '#15333f', mar2: '#1d4a55', suelo: '#7fd65a', suelo2: '#5fbb44', borde: '#3f8f35', camino: '#fff6c8', regla: '#3ddc7a' } },
  { id: 'volcan', nombre: 'Volcán Magma', casillas: 78, forma: 'alargada', semilla: 37,
    atajos: [[0.5, 1.5]],
    regla: { icono: '!', titulo: 'Erupciones', texto: 'Los demás pierden 2' },
    colores: { mar: '#3a1426', mar2: '#5a1e2c', suelo: '#6b4636', suelo2: '#5a3a2d', borde: '#ff7a2f', camino: '#ffd2a1', regla: '#ff6a2a' } },
  { id: 'ciudad', nombre: 'Ciudad Neón', casillas: 99, forma: 'mancha', semilla: 51,
    atajos: [[0.15, 0.85], [1.15, 1.85]],
    regla: { icono: '$', titulo: 'Casino', texto: 'Ganas 6 o pierdes 4' },
    colores: { mar: '#1c0f3d', mar2: '#2c1760', suelo: '#2f2a6b', suelo2: '#3a3485', borde: '#ff5fd2', camino: '#7ef9ff', regla: '#22e3c4' } }
];

// Forma de cada isla: devuelve un punto [x, y] para el ángulo t (0 a 2π)
const FORMAS = {
  estrella: (t) => { const r = 1 + 0.3 * Math.cos(4 * t); return [r * Math.cos(t) * 1.2, r * Math.sin(t) * 0.85]; },
  mani: (t) => [1.75 * Math.cos(t), Math.sin(t) * (0.36 + 0.64 * Math.cos(t) ** 2)],
  alargada: (t) => [1.9 * Math.cos(t), 0.62 * Math.sin(t) * (1 + 0.1 * Math.cos(6 * t))],
  mancha: (t) => { const r = 1 + 0.22 * Math.cos(3 * t + 0.5) + 0.14 * Math.sin(5 * t + 1); return [r * Math.cos(t) * 1.25, r * Math.sin(t) * 0.9]; }
};

const ESPACIO = 64;   // distancia entre casillas (en píxeles del mundo)
const MINI_ANCHO = 150; // ancho del mini mapa de las tarjetas

const COLORES_J = ['#ff4d5e', '#3d8bff', '#2fbf62', '#ffb020', '#a06bff', '#ff5fd2', '#22d3ee', '#c6f03d']; // J1 a J8
const TINTA = '#24195a';
const COLUMNAS = 4;                         // columnas de la rejilla de personajes
const CLAVE = 'nebulaParty.';               // prefijo para LocalStorage

/* ---------- 2. ESTADO ---------- */
const estado = {
  pantalla: 'menu',      // 'menu' | 'modos' | 'personajes' | 'mundos' | 'juego'
  modo: 'bots',          // 'bots' | 'local'
  humanos: 1,
  jugadores: [],         // { num, humano, cursor, elegido, celebrando }
  mundo: 0,
  rondas: 10,
  total: 4,              // jugadores en la partida (4 u 8); los que no son personas son bots
  rondasElegidas: false, // si la persona eligió las rondas, no se cambian solas
  partida: null,
  opciones: { volumen: 70, sinAnimaciones: false, agitar: true }
};

/* ---------- 3. UTILIDADES ---------- */
const $ = (id) => document.getElementById(id);

function guardar(nombre, valor) {
  try { localStorage.setItem(CLAVE + nombre, JSON.stringify(valor)); } catch (e) { /* sin guardado */ }
}
function cargar(nombre, porDefecto) {
  try {
    const texto = localStorage.getItem(CLAVE + nombre);
    return texto ? JSON.parse(texto) : porDefecto;
  } catch (e) { return porDefecto; }
}

function aviso(texto) { $('aviso').textContent = texto; }

function animacionesReducidas() {
  return estado.opciones.sinAnimaciones || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Sonidos cortos generados con Web Audio (sin archivos todavía)
let audio = null;
function sonar(tipo) {
  if (!estado.opciones.volumen) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch (e) { return; }
  const notas = {
    mover: [520], elegir: [660, 880], quitar: [440, 300], listo: [523, 659, 784],
    atras: [380], error: [200, 170], clic: [600]
  };
  const vol = (estado.opciones.volumen / 100) * 0.15;
  (notas[tipo] || [500]).forEach((f, i) => {
    const t = audio.currentTime + i * 0.07;
    const osc = audio.createOscillator();
    const gan = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = f;
    gan.gain.setValueAtTime(vol, t);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gan).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  });
}

// Crea un sprite (div con la hoja del personaje como fondo)
function crearSprite(idPersonaje, extra) {
  const div = document.createElement('div');
  div.className = 'sprite ' + (idPersonaje ? 'pj-' + idPersonaje : 'sin-pj') + (extra ? ' ' + extra : '');
  return div;
}

// Imágenes para dibujar en el canvas del tablero
const IMAGENES = {};
function cargarImagenes() {
  const incrustadas = window.NP_HOJAS || {};
  PERSONAJES.forEach((p) => {
    const img = new Image();
    img.src = incrustadas[p.id] || 'img/personajes/' + p.id + '.png';
    IMAGENES[p.id] = img;
  });
}

/* ---------- 4. PANTALLAS ---------- */
const PANTALLAS = { menu: 'pantalla-menu', modos: 'pantalla-modos', sala: 'pantalla-sala', personajes: 'pantalla-personajes', mundos: 'pantalla-mundos', juego: 'pantalla-juego' };

function cambiarPantalla(nueva) {
  estado.pantalla = nueva;
  Object.entries(PANTALLAS).forEach(([clave, id]) => $(id).classList.toggle('activa', clave === nueva));
  if (nueva === 'juego') iniciarTablero(); else detenerTablero();

  // En el menú el foco va al primer botón; en las demás se quita para que
  // Espacio y Enter controlen el juego y no un botón por accidente.
  if (nueva === 'menu' || nueva === 'modos') $(PANTALLAS[nueva]).querySelector('.lista-navegable .boton').focus({ preventScroll: true });
  else if (document.activeElement) document.activeElement.blur();
  window.scrollTo(0, 0);
}

function volver() {
  sonar('atras');
  if (estado.pantalla === 'modos') cambiarPantalla('menu');
  else if (estado.pantalla === 'sala') { cerrarSala(); cambiarPantalla('modos'); } // red.js
  else if (estado.pantalla === 'personajes') {
    if (estado.modo === 'online') cambiarPantalla('sala');
    else if (estado.modo === 'local') abrirSala(); // venía del botón "Jugar con teclado"
    else cambiarPantalla('modos');
  }
  else if (estado.pantalla === 'mundos') cambiarPantalla('personajes');
}

/* ---------- 5. FONDO DE ESTRELLAS ---------- */
const fondo = { lienzo: null, ctx: null, estrellas: [] };

function iniciarFondo() {
  fondo.lienzo = $('fondo');
  fondo.ctx = fondo.lienzo.getContext('2d');
  ajustarFondo();
  window.addEventListener('resize', ajustarFondo);
  requestAnimationFrame(dibujarFondo);
}

function ajustarFondo() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fondo.lienzo.width = innerWidth * dpr;
  fondo.lienzo.height = innerHeight * dpr;
  fondo.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fondo.estrellas = Array.from({ length: 110 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: Math.random() * 2 + 0.6,
    fase: Math.random() * Math.PI * 2
  }));
}

function dibujarFondo(t) {
  const c = fondo.ctx;
  c.clearRect(0, 0, innerWidth, innerHeight);
  const quieto = animacionesReducidas();
  fondo.estrellas.forEach((e) => {
    if (!quieto) {
      e.x -= 0.08;
      if (e.x < -4) e.x = innerWidth + 4;
    }
    const brillo = quieto ? 0.8 : 0.45 + 0.55 * Math.abs(Math.sin(t / 900 + e.fase));
    c.globalAlpha = brillo;
    c.fillStyle = '#ffffff';
    c.fillRect(e.x, e.y, e.r * 2, e.r * 2); // estrellas cuadradas, estilo pixel
  });
  c.globalAlpha = 1;
  if (estado.pantalla !== 'juego') requestAnimationFrame(dibujarFondo);
  else fondo.pausado = true;
}

function reanudarFondo() {
  if (fondo.pausado) { fondo.pausado = false; requestAnimationFrame(dibujarFondo); }
}

/* ---------- 6. MENÚ ---------- */
// Flechas arriba/abajo (o W/S) para moverse entre los botones del menú
function navegarLista(e, tecla) {
  const lista = $(PANTALLAS[estado.pantalla]).querySelector('.lista-navegable');
  const botones = [...lista.querySelectorAll('.boton')];
  let i = botones.indexOf(document.activeElement);
  if (tecla === 'ArrowDown' || tecla === 's') i = (i + 1) % botones.length;
  else if (tecla === 'ArrowUp' || tecla === 'w') i = (i - 1 + botones.length) % botones.length;
  else return false;
  e.preventDefault();
  botones[i].focus();
  sonar('mover');
  return true;
}

// Récords: victorias por personaje guardadas en LocalStorage
function sumarVictoria(idPersonaje) {
  const records = cargar('records', {});
  records[idPersonaje] = (records[idPersonaje] || 0) + 1;
  guardar('records', records);
}

function mostrarRecords() {
  const cont = $('tabla-records');
  cont.textContent = '';
  const records = cargar('records', {});
  const lista = PERSONAJES.filter((p) => records[p.id]).sort((a, b) => records[b.id] - records[a.id]);
  if (!lista.length) {
    const vacio = document.createElement('p');
    vacio.textContent = 'Todavía no hay partidas terminadas. Juega una y aquí verás qué personaje gana más.';
    cont.appendChild(vacio);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'records';
    lista.forEach((p) => {
      const li = document.createElement('li');
      const nombre = document.createElement('span');
      nombre.textContent = p.nombre;
      const num = document.createElement('b');
      num.textContent = records[p.id] + (records[p.id] === 1 ? ' victoria' : ' victorias');
      li.append(crearSprite(p.id), nombre, num);
      ul.appendChild(li);
    });
    cont.appendChild(ul);
  }
  sonar('clic');
  abrirVentana('capa-records');
}

function elegirModo(modo) {
  if (modo === 'pantalla') { $('titulo-sala').textContent = 'Todos en una pantalla'; abrirSala(); return; } // red.js
  if (modo === 'distancia') { $('titulo-sala').textContent = 'Multijugador a distancia'; abrirSala(); return; } // misma sala + invitación
  sonar('clic');
  estado.modo = modo;
  estado.humanos = modo === 'bots' ? 1 : Math.max(2, estado.humanos);
  prepararSeleccion();
  cambiarPantalla('personajes');
}

/* ---------- 7. ESCOGER PERSONAJE ---------- */
let temporizadorBots = null;

function construirRejilla() {
  const rejilla = $('rejilla');
  PERSONAJES.forEach((p, i) => {
    const celda = document.createElement('button');
    celda.className = 'celda';
    celda.dataset.indice = i;
    celda.setAttribute('aria-label', p.nombre);

    const duenio = document.createElement('span');
    duenio.className = 'duenio';
    duenio.hidden = true;

    const nombre = document.createElement('span');
    nombre.textContent = p.nombre;

    const cursores = document.createElement('div');
    cursores.className = 'cursores';

    celda.append(duenio, crearSprite(p.id), nombre, cursores);
    celda.addEventListener('click', () => { celda.blur(); clicPersonaje(i); });
    celda.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') apuntarConRaton(i); });
    rejilla.appendChild(celda);
  });
}

function prepararSeleccion() {
  clearTimeout(temporizadorBots);
  if (estado.humanos > 4) estado.total = 8;
  estado.jugadores = Array.from({ length: estado.total }, (_, num) => ({
    num, humano: num < estado.humanos, cursor: num % PERSONAJES.length, elegido: null, celebrando: false, tCelebrar: null
  }));
  // Selector de total de jugadores (4 u 8)
  document.querySelectorAll('[data-total]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.total) === estado.total));
    b.disabled = Number(b.dataset.total) < estado.humanos;
  });
  $('paneles').classList.toggle('ocho', estado.total > 4);

  // Selector de cantidad (solo en "Todos en una pantalla")
  $('selector-cantidad').hidden = estado.modo !== 'local';
  document.querySelectorAll('[data-cantidad]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.cantidad) === estado.humanos));
  });

  construirPaneles();
  actualizarAyuda();
  $('btn-ir-mundos').disabled = true;
  dibujarSeleccion();
}

function construirPaneles() {
  const cont = $('paneles');
  cont.textContent = '';
  estado.jugadores.forEach((j) => {
    const panel = document.createElement('div');
    panel.className = 'panel';

    const cab = document.createElement('p');
    cab.className = 'panel-cabecera color-j' + (j.num + 1);
    cab.textContent = 'J' + (j.num + 1) + (j.humano ? '' : ' Bot');

    const nombre = document.createElement('p');
    nombre.className = 'panel-nombre';

    const est = document.createElement('p');
    est.className = 'panel-estado';

    const quitarBtn = document.createElement('button');
    quitarBtn.className = 'boton b-crema panel-quitar';
    quitarBtn.textContent = 'Cambiar';
    quitarBtn.hidden = true;
    quitarBtn.addEventListener('click', () => quitar(j.num));

    panel.append(cab, crearSprite(null), nombre, est, quitarBtn);
    j.panel = { panel, sprite: panel.children[1], nombre, est, quitarBtn };
    cont.appendChild(panel);
  });
}

function actualizarAyuda() {
  let texto;
  if (estado.modo === 'online') {
    texto = 'Cada jugador usa su celular: cruceta para moverse y A para elegir. Los puestos sin celular los juega un bot.';
  } else if (estado.modo === 'bots') {
    texto = 'Muévete con W A S D o flechas y elige con Espacio o Enter. Q cambia tu elección. También puedes hacer clic.';
  } else {
    texto = 'J1: W A S D y Espacio (Q cambia). J2: flechas y Enter (Retroceso cambia).';
    if (estado.humanos > 2) texto += ' J3 y J4: clic o toque, por turnos.';
  }
  $('ayuda-controles').textContent = texto;
}

const estaTomado = (i) => estado.jugadores.some((j) => j.elegido === i);
const humanosListos = () => estado.jugadores.filter((j) => j.humano).every((j) => j.elegido !== null);

function dibujarSeleccion() {
  // Celdas de la rejilla
  document.querySelectorAll('.celda').forEach((celda) => {
    const i = Number(celda.dataset.indice);
    const duenio = estado.jugadores.find((j) => j.elegido === i);
    celda.className = 'celda' + (duenio ? ' tomada' : '');

    const insignia = celda.querySelector('.duenio');
    insignia.hidden = !duenio;
    if (duenio) {
      insignia.textContent = 'J' + (duenio.num + 1);
      insignia.className = 'duenio color-j' + (duenio.num + 1);
    }
    celda.querySelector('.sprite').className = 'sprite pj-' + PERSONAJES[i].id + (duenio && duenio.celebrando ? ' victoria' : '');

    // Cursores de los humanos que todavía están eligiendo
    const cursores = celda.querySelector('.cursores');
    cursores.textContent = '';
    estado.jugadores.forEach((j) => {
      if (!j.humano || j.elegido !== null || j.cursor !== i) return;
      const c = document.createElement('span');
      c.className = 'cursor c' + j.num + ' color-j' + (j.num + 1);
      c.textContent = 'J' + (j.num + 1);
      cursores.appendChild(c);
      celda.classList.add('apuntada-j' + (j.num + 1));
    });
  });

  // Paneles de abajo
  estado.jugadores.forEach((j) => {
    const p = j.panel;
    const indice = j.elegido !== null ? j.elegido : (j.humano ? j.cursor : null);
    const pj = indice !== null ? PERSONAJES[indice] : null;
    p.panel.className = 'panel' + (j.elegido !== null ? ' listo' : ' vacio');
    p.sprite.className = 'sprite ' + (pj ? 'pj-' + pj.id : 'sin-pj') + (j.celebrando ? ' victoria' : '');
    p.nombre.textContent = pj ? pj.nombre : '???';
    if (j.elegido !== null) p.est.textContent = '¡Listo!';
    else p.est.textContent = j.humano ? 'Eligiendo...' : 'Esperando';
    p.quitarBtn.hidden = !(j.humano && j.elegido !== null);
  });

  revisarListos();
}

function moverCursor(num, dx, dy) {
  const j = estado.jugadores[num];
  if (!j || !j.humano || j.elegido !== null) return;
  const filas = Math.ceil(PERSONAJES.length / COLUMNAS);
  const col = (j.cursor % COLUMNAS + dx + COLUMNAS) % COLUMNAS;
  const fila = (Math.floor(j.cursor / COLUMNAS) + dy + filas) % filas;
  j.cursor = fila * COLUMNAS + col;
  sonar('mover');
  dibujarSeleccion();
}

function elegir(num, indice) {
  const j = estado.jugadores[num];
  if (!j || !j.humano || j.elegido !== null) return;
  const i = indice !== undefined ? indice : j.cursor;
  const pj = PERSONAJES[i];
  if (estaTomado(i)) {
    sonar('error');
    aviso(pj.nombre + ' ya fue elegido. Escoge otro personaje.');
    return;
  }
  j.cursor = i;
  j.elegido = i;
  celebrar(j);
  sonar('elegir');
  aviso('Jugador ' + (num + 1) + ' eligió a ' + pj.nombre);
  dibujarSeleccion();
  turnoDeBots();
}

function quitar(num) {
  const j = estado.jugadores[num];
  if (!j || !j.humano || j.elegido === null) return;
  j.elegido = null;
  j.celebrando = false;
  sonar('quitar');
  dibujarSeleccion();
}

function celebrar(j) {
  j.celebrando = true;
  clearTimeout(j.tCelebrar);
  j.tCelebrar = setTimeout(() => {
    j.celebrando = false;
    if (estado.pantalla === 'personajes') dibujarSeleccion();
  }, 1300);
}

// Los bots eligen uno por uno cuando todos los humanos ya eligieron
function turnoDeBots() {
  clearTimeout(temporizadorBots);
  if (!humanosListos()) return;
  const bot = estado.jugadores.find((j) => !j.humano && j.elegido === null);
  if (!bot) return;
  temporizadorBots = setTimeout(() => {
    if (estado.pantalla !== 'personajes' || !humanosListos()) return;
    const libres = PERSONAJES.map((_, i) => i).filter((i) => !estaTomado(i));
    const i = libres[Math.floor(Math.random() * libres.length)];
    bot.elegido = i;
    bot.cursor = i;
    celebrar(bot);
    sonar('elegir');
    dibujarSeleccion();
    turnoDeBots();
  }, 550);
}

function revisarListos() {
  const boton = $('btn-ir-mundos');
  const yaEstaba = !boton.disabled;
  const todos = estado.jugadores.every((j) => j.elegido !== null);
  boton.disabled = !todos;
  if (todos && !yaEstaba) {
    sonar('listo');
    aviso('¡Todos listos! Ahora elige el mundo.');
  }
}

// Clic o toque: elige para el primer humano que no ha elegido
function clicPersonaje(i) {
  const j = estado.jugadores.find((x) => x.humano && x.elegido === null);
  if (!j) {
    sonar('error');
    aviso('Todos ya eligieron. Usa "Cambiar" en tu panel para cambiar de personaje.');
    return;
  }
  elegir(j.num, i);
}

function apuntarConRaton(i) {
  const j = estado.jugadores.find((x) => x.humano && x.elegido === null);
  if (!j || j.cursor === i) return;
  j.cursor = i;
  dibujarSeleccion();
}

function irAMundos() {
  if ($('btn-ir-mundos').disabled) return;
  sonar('clic');
  seleccionarMundo(estado.mundo, false);
  cambiarPantalla('mundos');
}

/* ---------- 8. ESCOGER MUNDO ---------- */
function construirMundos() {
  const lista = $('lista-mundos');
  MUNDOS.forEach((m, i) => {
    m.mapa = construirMapa(m);
    const tarjeta = document.createElement('button');
    tarjeta.className = 'tarjeta-mundo mt-' + m.id;
    tarjeta.setAttribute('aria-pressed', 'false');
    tarjeta.setAttribute('aria-label', m.nombre + '. ' + m.mapa.casillas.length + ' casillas. ' + m.regla.titulo + ': ' + m.regla.texto);

    const titulo = document.createElement('h3');
    titulo.textContent = m.nombre;

    const mini = pintarMapa(m, MINI_ANCHO / m.mapa.ancho, false);
    mini.className = 'mini-mapa';

    const cantidad = document.createElement('p');
    cantidad.className = 'casillas-texto';
    cantidad.textContent = m.mapa.casillas.length + ' casillas';

    const rombo = document.createElement('span');
    rombo.className = 'rombo';
    const icono = document.createElement('span');
    icono.textContent = m.regla.icono;
    rombo.appendChild(icono);

    const reglaTitulo = document.createElement('p');
    reglaTitulo.className = 'regla-titulo';
    reglaTitulo.textContent = m.regla.titulo + ':';

    const reglaTexto = document.createElement('p');
    reglaTexto.className = 'regla-texto';
    reglaTexto.textContent = m.regla.texto;

    tarjeta.append(titulo, mini, cantidad, rombo, reglaTitulo, reglaTexto);
    tarjeta.addEventListener('click', () => {
      tarjeta.blur();
      if (estado.mundo === i) iniciarPartida();
      else seleccionarMundo(i, true);
    });
    lista.appendChild(tarjeta);
  });
}

function seleccionarMundo(i, conSonido) {
  estado.mundo = (i + MUNDOS.length) % MUNDOS.length;
  document.querySelectorAll('.tarjeta-mundo').forEach((t, k) => t.setAttribute('aria-pressed', String(k === estado.mundo)));
  if (conSonido) {
    sonar('mover');
    aviso('Mundo: ' + MUNDOS[estado.mundo].nombre);
  }
}

// "Al azar": salta entre mundos unas veces y se queda en uno
let sorteando = false;
function mundoAlAzar() {
  if (sorteando) return;
  const final = Math.floor(Math.random() * MUNDOS.length);
  if (animacionesReducidas()) { seleccionarMundo(final, true); return; }
  sorteando = true;
  let paso = 0;
  const saltos = 10 + ((final - estado.mundo + MUNDOS.length) % MUNDOS.length);
  const girar = () => {
    seleccionarMundo(estado.mundo + 1, false);
    sonar('mover');
    paso++;
    if (paso < saltos) setTimeout(girar, 60 + paso * 12);
    else { sorteando = false; sonar('elegir'); aviso('Mundo al azar: ' + MUNDOS[estado.mundo].nombre); }
  };
  girar();
}

function elegirRondas(n) {
  estado.rondas = n;
  document.querySelectorAll('[data-rondas]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.rondas) === n)));
  sonar('clic');
}

/* ---------- 9. MAPAS, TABLERO Y HUD ---------- */

// Números al azar con semilla: el mismo mundo siempre sale igual
function azar(semilla) {
  return function () {
    semilla = (semilla + 0x6D2B79F5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ¿El punto (x, y) está dentro del polígono? (método del rayo)
function dentroDe(poligono, x, y) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i], b = poligono[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

// Crea el mapa: un anillo de casillas con la forma del mundo + atajos que lo cruzan.
// Cada casilla guarda "sig": a qué casillas se puede avanzar (2 opciones = bifurcación).
function construirMapa(m) {
  const forma = FORMAS[m.forma];
  const N = 1500;
  const pts = [];
  const acum = [0];
  for (let i = 0; i <= N; i++) {
    pts.push(forma(i / N * Math.PI * 2));
    if (i) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const perimetro = acum[N];

  // n puntos repartidos a la misma distancia sobre la forma
  const muestrear = (n, escala) => {
    const res = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
      const d = k * perimetro / n;
      while (acum[j + 1] < d) j++;
      const f = (d - acum[j]) / (acum[j + 1] - acum[j] || 1);
      res.push({
        x: (pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f) * escala,
        y: (pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f) * escala,
        t: (j + f) / N * Math.PI * 2
      });
    }
    return res;
  };
  const cercano = (anillo, ang) => {
    let mejor = 0, dist = Infinity;
    anillo.forEach((p, i) => {
      const d = Math.abs(Math.atan2(Math.sin(p.t - ang), Math.cos(p.t - ang)));
      if (d < dist) { dist = d; mejor = i; }
    });
    return mejor;
  };
  const calcular = (n) => {
    const anillo = muestrear(n, n * ESPACIO / perimetro);
    const atajos = m.atajos.map(([a, b]) => {
      const ia = cercano(anillo, a * Math.PI), ib = cercano(anillo, b * Math.PI);
      const largo = Math.hypot(anillo[ib].x - anillo[ia].x, anillo[ib].y - anillo[ia].y);
      return { ia, ib, k: Math.max(1, Math.round(largo / ESPACIO) - 1) };
    });
    return { anillo, atajos };
  };

  // Ajusta el tamaño del anillo hasta que el total de casillas sea el del mundo
  let nAnillo = Math.round(m.casillas * 0.86);
  let r = calcular(nAnillo);
  for (let intento = 0; intento < 6; intento++) {
    const nuevo = m.casillas - r.atajos.reduce((s, a) => s + a.k, 0);
    if (nuevo === nAnillo) break;
    nAnillo = nuevo;
    r = calcular(nAnillo);
  }
  const otros = r.atajos.slice(0, -1).reduce((s, a) => s + a.k, 0);
  r.atajos[r.atajos.length - 1].k = Math.max(1, m.casillas - nAnillo - otros);

  // Casillas del anillo y de los atajos
  const casillas = r.anillo.map((p, i) => ({ x: p.x, y: p.y, tipo: 'A', sig: [(i + 1) % nAnillo], atajo: false }));
  r.atajos.forEach((a) => {
    const A = casillas[a.ia], B = casillas[a.ib];
    let anterior = a.ia;
    for (let j = 1; j <= a.k; j++) {
      const f = j / (a.k + 1);
      casillas.push({ x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, tipo: 'A', sig: [], atajo: true });
      casillas[anterior].sig.push(casillas.length - 1);
      anterior = casillas.length - 1;
    }
    casillas[anterior].sig.push(a.ib);
  });

  // Tipos de casilla (siempre iguales gracias a la semilla)
  const rnd = azar(m.semilla);
  casillas.forEach((c, i) => {
    if (i === 0) { c.tipo = 'S'; return; }
    if (i < 3) return; // las primeras siempre azules
    const v = rnd();
    c.tipo = v < 0.54 ? 'A' : v < 0.7 ? 'R' : v < 0.81 ? 'E' : v < 0.91 ? 'M' : 'D'; // D = duelo
  });
  [0.18, 0.42, 0.66, 0.88].forEach((f) => { casillas[Math.round(nAnillo * f)].tipo = 'T'; });

  // Mover todo para que empiece en (margen, margen)
  const margen = ESPACIO * 3;
  const minX = Math.min(...casillas.map((c) => c.x)), minY = Math.min(...casillas.map((c) => c.y));
  casillas.forEach((c) => { c.x += margen - minX; c.y += margen - minY; });
  const ancho = Math.max(...casillas.map((c) => c.x)) + margen;
  const alto = Math.max(...casillas.map((c) => c.y)) + margen;
  const anillo = casillas.slice(0, nAnillo);

  // Adornos: dentro de la isla (lejos del camino) y en el mar
  const lejos = (x, y, d) => casillas.every((c) => (c.x - x) ** 2 + (c.y - y) ** 2 > d * d);
  const adornosDentro = [], adornosFuera = [];
  for (let i = 0; i < 900 && adornosDentro.length < 45; i++) {
    const x = rnd() * ancho, y = rnd() * alto;
    if (dentroDe(anillo, x, y) && lejos(x, y, ESPACIO * 0.95)) adornosDentro.push({ x, y, v: rnd() });
  }
  for (let i = 0; i < 600 && adornosFuera.length < 30; i++) {
    const x = rnd() * ancho, y = rnd() * alto;
    if (!dentroDe(anillo, x, y) && lejos(x, y, ESPACIO * 1.7)) adornosFuera.push({ x, y, v: rnd() });
  }
  return { casillas, nAnillo, ancho, alto, adornosDentro, adornosFuera, semilla: m.semilla };
}

// Dibuja el mapa completo en un lienzo aparte (escala < 1 = pixel art más grueso)
function pintarMapa(m, escala, conFondo) {
  const mapa = m.mapa, col = m.colores, S = ESPACIO;
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.ceil(mapa.ancho * escala);
  lienzo.height = Math.ceil(mapa.alto * escala);
  const c = lienzo.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.scale(escala, escala);
  const rnd = azar(mapa.semilla + 7);
  const detalle = escala >= 0.25;

  // Mar con olas de pixel
  if (conFondo) {
    c.fillStyle = col.mar;
    c.fillRect(0, 0, mapa.ancho, mapa.alto);
    c.fillStyle = col.mar2;
    for (let i = 0; i < mapa.ancho * mapa.alto / 9000; i++) c.fillRect(rnd() * mapa.ancho, rnd() * mapa.alto, S * 0.5, S * 0.1);
  }
  mapa.adornosFuera.forEach((a) => dibujarAdorno(c, m.id, a, false));

  // Isla: contorno grueso siguiendo el anillo
  const anillo = mapa.casillas.slice(0, mapa.nAnillo);
  c.beginPath();
  anillo.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = S * 3; c.strokeStyle = TINTA; c.stroke();
  c.lineWidth = S * 2.6; c.strokeStyle = col.borde; c.stroke();
  c.lineWidth = S * 2.2; c.strokeStyle = col.suelo; c.stroke();
  c.fillStyle = col.suelo; c.fill();

  // Textura del suelo
  if (detalle) {
    c.fillStyle = col.suelo2;
    for (let i = 0; i < 260; i++) {
      const x = rnd() * mapa.ancho, y = rnd() * mapa.alto;
      if (dentroDe(anillo, x, y)) c.fillRect(x, y, S * 0.3, S * 0.3);
    }
  }
  mapa.adornosDentro.forEach((a) => dibujarAdorno(c, m.id, a, true));

  // Caminos: el anillo y los atajos (en rojo)
  mapa.casillas.forEach((k) => k.sig.forEach((n) => {
    const d = mapa.casillas[n];
    const esAtajo = k.atajo || d.atajo;
    c.beginPath(); c.moveTo(k.x, k.y); c.lineTo(d.x, d.y);
    c.lineWidth = S * 0.42; c.strokeStyle = TINTA; c.lineCap = 'butt'; c.stroke();
    c.lineWidth = S * 0.22; c.strokeStyle = esAtajo ? '#ff4d5e' : col.camino; c.stroke();
  }));

  // Casillas cuadradas
  const colores = { S: '#ffffff', A: '#3d8bff', R: '#ff4d5e', E: '#3ddc7a', T: '#ffd23f', M: col.regla, D: '#ff8a3d' };
  const q = S * 0.62;
  mapa.casillas.forEach((k) => {
    c.fillStyle = TINTA;
    c.fillRect(k.x - q / 2 - 4, k.y - q / 2 - 4, q + 8, q + 12);
    c.fillStyle = colores[k.tipo];
    c.fillRect(k.x - q / 2, k.y - q / 2, q, q);
    if (detalle) dibujarIcono(c, k, q, m.regla.icono);
  });
  return lienzo;
}

// Íconos pixel dentro de cada casilla
function dibujarIcono(c, k, q, iconoRegla) {
  const u = q / 8; // una "unidad" de pixel
  const x = k.x, y = k.y;
  c.fillStyle = '#ffffff';
  if (k.tipo === 'A') { c.fillRect(x - u * 2.5, y - u * 0.75, u * 5, u * 1.5); c.fillRect(x - u * 0.75, y - u * 2.5, u * 1.5, u * 5); }
  else if (k.tipo === 'R') c.fillRect(x - u * 2.5, y - u * 0.75, u * 5, u * 1.5);
  else if (k.tipo === 'E') { c.fillRect(x - u * 0.75, y - u * 2.8, u * 1.5, u * 3.6); c.fillRect(x - u * 0.75, y + u * 1.3, u * 1.5, u * 1.5); }
  else if (k.tipo === 'T') { // observatorio: telescopio
    c.fillStyle = TINTA;
    c.save(); c.translate(x, y - u * 0.5); c.rotate(-0.6);
    c.fillRect(-u * 3, -u * 1.1, u * 5, u * 2.2);
    c.fillStyle = '#ffffff'; c.fillRect(-u * 2.6, -u * 0.7, u * 4.2, u * 1.4);
    c.restore();
    c.fillStyle = TINTA; c.fillRect(x - u * 0.5, y + u * 0.5, u, u * 2.5); c.fillRect(x - u * 2, y + u * 2.5, u * 4, u);
  }
  else if (k.tipo === 'S') {
    c.fillStyle = TINTA; c.fillRect(x - u * 2, y - u * 3, u, u * 6);
    c.fillStyle = '#ff4d5e'; c.fillRect(x - u, y - u * 3, u * 3.5, u * 2.5);
  } else if (k.tipo === 'D') { // duelo: "VS"
    c.fillStyle = TINTA;
    c.font = Math.round(q * 0.34) + 'px "Press Start 2P", "Courier New", monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('VS', x + u * 0.3, y + u * 0.4);
  } else if (k.tipo === 'M') {
    c.fillStyle = TINTA;
    c.font = Math.round(q * 0.42) + 'px "Press Start 2P", "Courier New", monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(iconoRegla, x + u * 0.3, y + u * 0.4);
  }
}

// Adornos de cada mundo (dentro = sobre la isla, fuera = en el mar)
function dibujarAdorno(c, id, a, dentro) {
  const S = ESPACIO, x = a.x, y = a.y, v = a.v;
  const caja = (col, ax, ay, w, h) => { c.fillStyle = col; c.fillRect(ax, ay, w, h); };
  if (id === 'glaciar') {
    if (dentro) {
      const h = S * (0.6 + v * 0.7);
      c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + S * 0.28, y); c.lineTo(x, y + S * 0.15); c.lineTo(x - S * 0.28, y); c.closePath();
      c.fillStyle = v > 0.5 ? '#9ff0ff' : '#ffffff'; c.fill(); c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke();
      caja('#ffffff', x - S * 0.06, y - h * 0.6, S * 0.08, h * 0.35);
    } else {
      caja(TINTA, x - S * 0.42, y - S * 0.17, S * 0.84, S * 0.42);
      caja('#eaf9ff', x - S * 0.38, y - S * 0.21, S * 0.76, S * 0.34);
    }
  } else if (id === 'jungla') {
    if (dentro) {
      if (v < 0.75) { // árbol
        caja(TINTA, x - S * 0.1, y - S * 0.1, S * 0.2, S * 0.5);
        caja('#8a5a34', x - S * 0.06, y - S * 0.1, S * 0.12, S * 0.46);
        c.beginPath(); c.arc(x, y - S * 0.35, S * (0.38 + v * 0.15), 0, Math.PI * 2);
        c.fillStyle = v > 0.4 ? '#2f9e44' : '#3fbf55'; c.fill(); c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke();
        caja('#7ee08a', x - S * 0.2, y - S * 0.55, S * 0.12, S * 0.12);
      } else { // hongo alien
        caja(TINTA, x - S * 0.1, y - S * 0.15, S * 0.2, S * 0.4);
        caja('#ffe9c4', x - S * 0.07, y - S * 0.15, S * 0.14, S * 0.37);
        c.beginPath(); c.arc(x, y - S * 0.15, S * 0.3, Math.PI, 0); c.closePath();
        c.fillStyle = '#c45cff'; c.fill(); c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke();
        caja('#ffffff', x - S * 0.12, y - S * 0.33, S * 0.08, S * 0.08);
      }
    } else {
      c.beginPath(); c.ellipse(x, y, S * 0.4, S * 0.25, 0, 0.3, Math.PI * 2 - 0.3); c.lineTo(x, y); c.closePath();
      c.fillStyle = '#3f8f35'; c.fill(); c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke();
    }
  } else if (id === 'volcan') {
    if (dentro) {
      if (v < 0.25) { // volcancito
        c.beginPath(); c.moveTo(x - S * 0.7, y + S * 0.3); c.lineTo(x - S * 0.2, y - S * 0.5); c.lineTo(x + S * 0.2, y - S * 0.5); c.lineTo(x + S * 0.7, y + S * 0.3); c.closePath();
        c.fillStyle = '#4a2d24'; c.fill(); c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke();
        caja('#ff7a2f', x - S * 0.2, y - S * 0.56, S * 0.4, S * 0.14);
        caja('#ffd23f', x - S * 0.08, y - S * 0.4, S * 0.1, S * 0.3);
      } else { // grietas de lava
        c.beginPath(); c.moveTo(x - S * 0.4, y); c.lineTo(x - S * 0.1, y - S * 0.15); c.lineTo(x + S * 0.1, y + S * 0.1); c.lineTo(x + S * 0.4, y - S * 0.05);
        c.lineWidth = S * 0.16; c.strokeStyle = TINTA; c.stroke();
        c.lineWidth = S * 0.08; c.strokeStyle = v > 0.6 ? '#ffd23f' : '#ff7a2f'; c.stroke();
      }
    } else {
      c.beginPath(); c.arc(x, y, S * (0.2 + v * 0.25), 0, Math.PI * 2);
      c.fillStyle = '#ff7a2f'; c.fill(); c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke();
      caja('#ffd23f', x - S * 0.06, y - S * 0.06, S * 0.12, S * 0.12);
    }
  } else { // ciudad
    if (dentro) {
      const w = S * (0.5 + v * 0.4), h = S * (0.7 + v * 1.1);
      caja(TINTA, x - w / 2 - 4, y - h - 4, w + 8, h + 8);
      caja(v > 0.5 ? '#4b3fb0' : '#5b2c8f', x - w / 2, y - h, w, h);
      const luces = ['#7ef9ff', '#ff5fd2', '#ffd23f'];
      for (let fy = y - h + S * 0.12; fy < y - S * 0.15; fy += S * 0.24) {
        for (let fx = x - w / 2 + S * 0.1; fx < x + w / 2 - S * 0.1; fx += S * 0.2) {
          caja(luces[Math.floor((fx + fy) / 7) % 3], fx, fy, S * 0.09, S * 0.09);
        }
      }
    } else {
      caja('#ffffff', x, y, S * 0.08, S * 0.08);
      caja('#7ef9ff', x - S * 0.1, y, S * 0.06, S * 0.06);
    }
  }
}

const tablero = {
  lienzo: null, ctx: null, ancho: 0, alto: 0, idBucle: null,
  imagen: null, escalaImagen: 0.5,
  cam: { x: 0, y: 0, zoom: 1 }, zoomBase: 1, sigue: true, verTodo: false,
  arrastre: null, particulas: [], flotantes: [], foco: null, temblor: 0
};

function iniciarPartida() {
  sonar('listo');
  const m = MUNDOS[estado.mundo];
  estado.partida = {
    ronda: 1,
    turno: 0,
    jugadores: estado.jugadores.map((j) => ({
      num: j.num, humano: j.humano, pj: PERSONAJES[j.elegido], monedas: 10, estrellas: 0, casilla: 0
    }))
  };
  tablero.imagen = pintarMapa(m, tablero.escalaImagen, true);
  tablero.sigue = true;
  tablero.verTodo = false;
  construirHud();
  cambiarPantalla('juego');
  const inicio = m.mapa.casillas[0];
  tablero.cam.x = inicio.x;
  tablero.cam.y = inicio.y;
  tablero.cam.zoom = tablero.zoomBase;
  prepararDado();
  tareas.length = 0;
  cerrarMinijuego();
  Object.assign(juego, { fase: 'efecto', reto: null, alTerminarMov: null, mov: null });
  tablero.flotantes = [];
  tablero.foco = null;
  $('reto').hidden = true;
  $('carta').hidden = true;
  actualizarTurnoHud();
  const partida = estado.partida;
  moverEstrella(partida, '¡Una estrella fugaz cae del cielo!').then(() => {
    if (estado.partida === partida) empezarTurno();
  });
}

function construirHud() {
  const hud = $('hud');
  hud.querySelectorAll('.hud-jugador').forEach((n) => n.remove());
  hud.classList.toggle('ocho', estado.partida.jugadores.length > 4);
  estado.partida.jugadores.forEach((j) => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'hud-jugador h' + j.num;

    const retrato = document.createElement('div');
    retrato.className = 'hud-retrato color-j' + (j.num + 1);
    retrato.appendChild(crearSprite(j.pj.id));

    const info = document.createElement('div');
    const nombre = document.createElement('p');
    nombre.className = 'hud-nombre';
    nombre.textContent = j.pj.nombre + ' (J' + (j.num + 1) + (j.humano ? '' : ' Bot') + ')';

    const datos = document.createElement('p');
    datos.className = 'hud-datos';
    datos.append(crearDato('icono-moneda', j.monedas, 'monedas'), crearDato('icono-estrella', j.estrellas, 'estrellas'));

    info.append(nombre, datos);
    tarjeta.append(retrato, info);
    hud.appendChild(tarjeta);
  });

  const m = MUNDOS[estado.mundo];
  $('hud-ronda').textContent = 'Ronda ' + estado.partida.ronda + '/' + estado.rondas;
  $('hud-mundo').textContent = m.nombre + ': ' + m.regla.titulo;
}

function crearDato(claseIcono, valor, etiqueta) {
  const span = document.createElement('span');
  const icono = document.createElement('i');
  icono.className = claseIcono;
  icono.setAttribute('aria-hidden', 'true');
  const num = document.createElement('b');
  num.textContent = valor;
  span.setAttribute('aria-label', valor + ' ' + etiqueta);
  span.append(icono, num);
  return span;
}

function iniciarTablero() {
  if (!tablero.lienzo) {
    tablero.lienzo = $('tablero');
    tablero.ctx = tablero.lienzo.getContext('2d');
    conectarCamara();
  }
  ajustarTablero();
  if (!tablero.idBucle) tablero.idBucle = requestAnimationFrame(bucleTablero);
}

function detenerTablero() {
  if (tablero.idBucle) cancelAnimationFrame(tablero.idBucle);
  tablero.idBucle = null;
  ultimoCuadro = 0;
  if ($('capa-dado')) ocultarDado();
  reanudarFondo();
}

let ultimoCuadro = 0;
function bucleTablero(t) {
  const dt = Math.min(0.1, ultimoCuadro ? (t - ultimoCuadro) / 1000 : 0);
  ultimoCuadro = t;
  actualizarJuego(dt);
  if (MJ.activo) dibujarMJ();
  else {
    actualizarCamara();
    dibujarTablero(animacionesReducidas() ? 0 : t);
  }
  dibujarCopa(t / 1000);
  tablero.idBucle = requestAnimationFrame(bucleTablero);
}

function ajustarTablero() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  tablero.ancho = innerWidth;
  tablero.alto = innerHeight;
  tablero.lienzo.width = innerWidth * dpr;
  tablero.lienzo.height = innerHeight * dpr;
  tablero.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tablero.zoomBase = Math.min(1.1, Math.max(0.55, Math.min(innerWidth, innerHeight) / 950));
  tablero.particulas = Array.from({ length: 50 }, () => ({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight, v: Math.random(), fase: Math.random() * 6.28
  }));
}

/* --- Cámara: sigue al jugador del turno, se puede arrastrar y ver todo el mapa --- */
const zoomTodo = () => {
  const mapa = MUNDOS[estado.mundo].mapa;
  return Math.min(tablero.ancho / mapa.ancho, (tablero.alto - 120) / mapa.alto) * 0.95;
};

function actualizarCamara() {
  const cam = tablero.cam, mapa = MUNDOS[estado.mundo].mapa;
  let tx, ty, tz;
  if (tablero.foco) { tx = tablero.foco.x; ty = tablero.foco.y; tz = tablero.zoomBase; }
  else if (tablero.verTodo) { tx = mapa.ancho / 2; ty = mapa.alto / 2; tz = zoomTodo(); }
  else if (tablero.sigue) {
    const p = posJugador(jugadorActual(), estado.partida.turno);
    tx = p.x; ty = p.y; tz = tablero.zoomBase;
  } else return; // modo libre (arrastrando)
  const f = animacionesReducidas() ? 1 : 0.12;
  cam.x += (tx - cam.x) * f;
  cam.y += (ty - cam.y) * f;
  cam.zoom += (tz - cam.zoom) * f;
}

function limitarCamara() {
  const cam = tablero.cam, mapa = MUNDOS[estado.mundo].mapa;
  cam.x = Math.max(0, Math.min(mapa.ancho, cam.x));
  cam.y = Math.max(0, Math.min(mapa.alto, cam.y));
}

function conectarCamara() {
  const l = tablero.lienzo;
  l.addEventListener('pointerdown', (e) => {
    tablero.arrastre = { x: e.clientX, y: e.clientY, movido: false };
    l.setPointerCapture(e.pointerId);
  });
  l.addEventListener('pointermove', (e) => {
    const a = tablero.arrastre;
    if (!a) return;
    const dx = e.clientX - a.x, dy = e.clientY - a.y;
    if (!a.movido && Math.hypot(dx, dy) < 5) return;
    if (!a.movido) { a.movido = true; tablero.sigue = false; tablero.verTodo = false; actualizarBotonesCamara(); }
    tablero.cam.x -= dx / tablero.cam.zoom;
    tablero.cam.y -= dy / tablero.cam.zoom;
    limitarCamara();
    a.x = e.clientX;
    a.y = e.clientY;
  });
  const soltar = () => { tablero.arrastre = null; };
  l.addEventListener('pointerup', (e) => {
    if (tablero.arrastre && !tablero.arrastre.movido) clicEnTablero(e);
    soltar();
  });
  l.addEventListener('pointercancel', soltar);
  l.addEventListener('wheel', (e) => {
    e.preventDefault();
    acercar(e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });
}

function acercar(factor) {
  const min = zoomTodo(), max = 1.8;
  tablero.verTodo = false;
  tablero.zoomBase = Math.max(min, Math.min(max, tablero.zoomBase * factor));
  if (!tablero.sigue) tablero.cam.zoom = tablero.zoomBase;
  actualizarBotonesCamara();
}

function verMapa() {
  sonar('clic');
  tablero.verTodo = !tablero.verTodo;
  if (!tablero.verTodo) tablero.sigue = true;
  actualizarBotonesCamara();
}

function centrarCamara() {
  sonar('clic');
  tablero.verTodo = false;
  tablero.sigue = true;
  actualizarBotonesCamara();
}

function actualizarBotonesCamara() {
  $('btn-ver-mapa').textContent = tablero.verTodo ? 'Acercar' : 'Ver mapa';
  $('btn-centrar').disabled = tablero.sigue && !tablero.verTodo;
}

/* --- Dibujo del tablero en cada cuadro --- */
function dibujarTablero(t) {
  const c = tablero.ctx, w = tablero.ancho, h = tablero.alto;
  const m = MUNDOS[estado.mundo], mapa = m.mapa, cam = tablero.cam;
  c.fillStyle = m.colores.mar;
  c.fillRect(0, 0, w, h);

  c.save();
  const tiembla = juego.reloj < tablero.temblor && !animacionesReducidas() ? 10 : 0;
  c.translate(w / 2 + (Math.random() - 0.5) * tiembla, h / 2 + (Math.random() - 0.5) * tiembla);
  c.scale(cam.zoom, cam.zoom);
  c.translate(-cam.x, -cam.y);
  c.imageSmoothingEnabled = false;
  c.drawImage(tablero.imagen, 0, 0, mapa.ancho, mapa.alto);
  dibujarEstrellaFugaz(c);
  dibujarPersonajes(c, mapa, t);
  dibujarFlotantes(c);
  c.restore();

  dibujarParticulas(c, m.id, t, w, h);
}

function dibujarPersonajes(c, mapa, t) {
  const tam = ESPACIO * 0.95;
  const turno = estado.partida.turno;
  c.imageSmoothingEnabled = false;

  // Primero los que están quietos y al final el que tiene el turno (queda encima)
  const orden = estado.partida.jugadores.map((j, i) => i).filter((i) => i !== turno).concat([turno]);
  orden.forEach((idx) => {
    const j = estado.partida.jugadores[idx];
    const p = posJugador(j, idx);
    const brinco = idx === turno && !p.moviendo && t ? Math.round(Math.abs(Math.sin(t / 220)) * 6) : 0;

    if (!p.moviendo) {
      c.fillStyle = TINTA;
      c.fillRect(p.x - tam * 0.34, p.y + tam * 0.38, tam * 0.68, tam * 0.16);
      c.fillStyle = COLORES_J[j.num];
      c.fillRect(p.x - tam * 0.3, p.y + tam * 0.4, tam * 0.6, tam * 0.1);
    }

    const img = IMAGENES[j.pj.id];
    if (img && img.complete && img.naturalWidth) {
      // cuadros 0-1 quieto, 2-3 caminando
      const cuadro = p.moviendo ? 2 + (Math.floor(t / 120) % 2) : Math.floor(t / 550 + idx * 0.5) % 2;
      c.save();
      c.translate(Math.round(p.x), Math.round(p.y - brinco));
      if (p.mira < 0) c.scale(-1, 1);
      c.drawImage(img, cuadro * 32, 0, 32, 32, -tam / 2, -tam / 2, tam, tam);
      c.restore();
    }

    if (idx === turno) {
      const fy = p.y - tam * 0.62 - brinco;
      if (juego.fase === 'moviendo' || juego.fase === 'eligiendo') {
        // Pasos que le faltan
        c.fillStyle = TINTA; c.fillRect(p.x - 20, fy - 34, 40, 34);
        c.fillStyle = COLORES_J[j.num]; c.fillRect(p.x - 16, fy - 30, 32, 26);
        c.font = '16px "Press Start 2P", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#ffffff'; c.fillText(String(juego.pasos), p.x + 1, fy - 16);
      } else {
        c.fillStyle = TINTA;
        c.fillRect(p.x - 13, fy - 15, 26, 8); c.fillRect(p.x - 9, fy - 7, 18, 6); c.fillRect(p.x - 5, fy - 1, 10, 6);
        c.fillStyle = COLORES_J[j.num];
        c.fillRect(p.x - 10, fy - 12, 20, 4); c.fillRect(p.x - 6, fy - 8, 12, 5); c.fillRect(p.x - 2, fy - 3, 4, 5);
      }
    }
  });

  // Flechas para elegir camino
  if (juego.fase === 'eligiendo') {
    juego.opciones.forEach((op, i) => {
      const k = mapa.casillas[op];
      const sube = t ? Math.round(Math.abs(Math.sin(t / 200)) * 8) : 0;
      const y = k.y - ESPACIO * 0.35 - sube;
      const col = i === juego.eleccion ? '#ffd23f' : '#ffffff';
      c.fillStyle = TINTA;
      c.fillRect(k.x - 22, y - 26, 44, 14); c.fillRect(k.x - 15, y - 12, 30, 10); c.fillRect(k.x - 8, y - 2, 16, 10);
      c.fillStyle = col;
      c.fillRect(k.x - 18, y - 22, 36, 8); c.fillRect(k.x - 11, y - 14, 22, 8); c.fillRect(k.x - 4, y - 6, 8, 10);
      if (k.atajo) {
        c.font = '12px "Press Start 2P", monospace';
        c.textAlign = 'center';
        c.fillStyle = TINTA; c.fillRect(k.x - 40, y - 52, 80, 22);
        c.fillStyle = '#ff5fa2'; c.fillText('ATAJO', k.x, y - 37);
      }
    });
  }

}

// Partículas de ambiente en pantalla: nieve, luciérnagas, chispas o destellos neón
function dibujarParticulas(c, id, t, w, h) {
  if (!t) return;
  tablero.particulas.forEach((p) => {
    if (id === 'glaciar') {
      p.y += 0.5 + p.v; p.x += Math.sin(t / 800 + p.fase) * 0.4;
      if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
      c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(p.x, p.y, 4, 4);
    } else if (id === 'jungla') {
      p.x += Math.sin(t / 900 + p.fase) * 0.6; p.y += Math.cos(t / 1100 + p.fase) * 0.4;
      c.globalAlpha = Math.abs(Math.sin(t / 500 + p.fase));
      c.fillStyle = '#e6ff7a'; c.fillRect(p.x, p.y, 4, 4);
      c.globalAlpha = 1;
    } else if (id === 'volcan') {
      p.y -= 0.6 + p.v; p.x += Math.sin(t / 600 + p.fase) * 0.3;
      if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      c.fillStyle = p.v > 0.5 ? '#ffd23f' : '#ff7a2f'; c.fillRect(p.x, p.y, 4, 4);
    } else {
      c.globalAlpha = Math.max(0, Math.sin(t / 400 + p.fase * 3));
      c.fillStyle = p.v > 0.5 ? '#7ef9ff' : '#ff5fd2';
      c.fillRect(p.x, p.y, 4, 4); c.fillRect(p.x - 4, p.y + 4, 12, 0.01 + 4 * (p.v > 0.8));
      c.globalAlpha = 1;
    }
  });
}

function estrella(c, x, y, rExt, rInt) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? rInt : rExt;
    c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  c.closePath();
}

/* ---------- 9B. DADO DE 10 CARAS (Three.js) ---------- */
const TAM_DADO = 200;               // resolución del dado (se agranda en CSS para verse pixel)
const NUMEROS_D10 = [1, 7, 3, 9, 5, 10, 4, 8, 2, 6]; // 5 caras de arriba y 5 de abajo
const dado = { listo: false, malla: null, caras: [], texturas: {}, anim: null, idle: true };

function prepararDado() {
  if (dado.listo || !window.THREE) return;
  const T = THREE;
  dado.renderer = new T.WebGLRenderer({ canvas: $('lienzo-dado'), antialias: false, alpha: true });
  dado.renderer.setPixelRatio(1);
  dado.renderer.setSize(TAM_DADO, TAM_DADO, false);
  dado.escena = new T.Scene();
  dado.camara = new T.PerspectiveCamera(30, 1, 0.1, 50);
  dado.camara.position.set(0, 0, 7);
  dado.escena.add(new T.AmbientLight(0xffffff, 0.7));
  const luz = new T.DirectionalLight(0xffffff, 0.55);
  luz.position.set(2, 3, 5);
  dado.escena.add(luz);
  crearD10();
  dado.listo = true;
}

// Forma del d10 (trapezoedro pentagonal): 2 puntas y 10 caras en forma de cometa
function crearD10() {
  const T = THREE, V = T.Vector3;
  const h = 1.15, e = 0.10557 * h; // e hace que cada cara quede plana
  const arriba = new V(0, h, 0), abajo = new V(0, -h, 0);
  const U = [], L = [];
  for (let k = 0; k < 5; k++) {
    const a = k * 72 * Math.PI / 180, b = (k * 72 + 36) * Math.PI / 180;
    U.push(new V(Math.cos(a), e, Math.sin(a)));
    L.push(new V(Math.cos(b), -e, Math.sin(b)));
  }
  const cometas = [];
  for (let k = 0; k < 5; k++) cometas.push([arriba, U[k], L[k], U[(k + 1) % 5]]);
  for (let k = 0; k < 5; k++) cometas.push([abajo, L[k], U[(k + 1) % 5], L[(k + 1) % 5]]);

  const pos = [], uv = [];
  const geo = new T.BufferGeometry();
  dado.caras = cometas.map((c, i) => {
    let [a, b, f, d] = c;
    // Que la normal apunte hacia afuera
    let n = new V().subVectors(b, a).cross(new V().subVectors(d, a)).normalize();
    const centroCometa = new V().add(a).add(b).add(f).add(d).multiplyScalar(0.25);
    if (n.dot(centroCometa) < 0) { [b, d] = [d, b]; n.negate(); }
    // Centro de área (donde va el número)
    const t1 = new V().add(a).add(b).add(f).divideScalar(3), t2 = new V().add(a).add(f).add(d).divideScalar(3);
    const ar1 = new V().subVectors(b, a).cross(new V().subVectors(f, a)).length();
    const ar2 = new V().subVectors(f, a).cross(new V().subVectors(d, a)).length();
    const centro = t1.multiplyScalar(ar1).add(t2.multiplyScalar(ar2)).divideScalar(ar1 + ar2);
    // Ejes de la cara: "arriba" apunta a la punta del dado
    const vArriba = new V().subVectors(a, centro);
    vArriba.sub(n.clone().multiplyScalar(vArriba.dot(n))).normalize();
    const uDerecha = new V().crossVectors(vArriba, n).normalize();
    const extension = Math.max(...[a, b, f, d].map((p) => {
      const q = new V().subVectors(p, centro);
      return Math.max(Math.abs(q.dot(uDerecha)), Math.abs(q.dot(vArriba)));
    }));
    const s = 0.5 / (extension * 1.02);
    const aUV = (p) => { const q = new V().subVectors(p, centro); return [0.5 + q.dot(uDerecha) * s, 0.5 + q.dot(vArriba) * s]; };
    [[a, b, f], [a, f, d]].forEach((tri) => tri.forEach((p) => { pos.push(p.x, p.y, p.z); uv.push(...aUV(p)); }));
    geo.addGroup(i * 6, 6, i);
    return { numero: NUMEROS_D10[i], n, uDerecha, vArriba };
  });
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();

  dado.malla = new T.Mesh(geo, []);
  const bordes = new T.LineSegments(new T.EdgesGeometry(geo, 1), new T.LineBasicMaterial({ color: 0x1b1240 }));
  dado.malla.add(bordes);
  dado.escena.add(dado.malla);
}

// Textura de una cara: color del jugador + número grande en letra pixel
function texturaCara(numero, color) {
  const clave = numero + color;
  if (dado.texturas[clave]) return dado.texturas[clave];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(255,255,255,.18)'; // brillo pixel
  x.fillRect(0, 0, 128, 18);
  const texto = String(numero);
  x.font = (texto.length > 1 ? 24 : 34) + 'px "Press Start 2P", "Courier New", monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  x.lineWidth = 9;
  x.strokeStyle = '#1b1240';
  const conRaya = numero === 6 || numero === 9;
  const yNum = conRaya ? 58 : 66; // el 6 y el 9 suben un poco para que quepa la rayita
  x.strokeText(texto, 66, yNum);
  x.fillStyle = '#ffffff';
  x.fillText(texto, 66, yNum);
  if (conRaya) { // rayita para no confundir 6 y 9
    x.fillStyle = '#1b1240'; x.fillRect(46, 80, 40, 11);
    x.fillStyle = '#ffffff'; x.fillRect(50, 83, 32, 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  dado.texturas[clave] = mat;
  return mat;
}

function pintarDado(color) {
  dado.malla.material = dado.caras.map((cara) => texturaCara(cara.numero, color));
}

// Giro final: la cara del resultado mirando a la cámara y el número derecho
function giroFinal(numero) {
  const T = THREE;
  const cara = dado.caras.find((c) => c.numero === numero);
  const base = new T.Matrix4().makeBasis(cara.uDerecha, cara.vArriba, cara.n);
  const q = new T.Quaternion().setFromRotationMatrix(base).invert();
  const inclinado = new T.Quaternion().setFromEuler(new T.Euler(-0.32, 0.18, 0)); // un poco de 3D
  return inclinado.multiply(q);
}

function mostrarDado(color, quien) {
  $('capa-dado').hidden = false;
  $('resultado-dado').classList.remove('visible');
  $('quien-lanza').textContent = quien;
  dado.anim = null;
  dado.idle = true;
  if (dado.listo) {
    pintarDado(color);
    dado.malla.position.set(0, 0, 0);
    dado.malla.scale.setScalar(1);
  } else {
    $('lienzo-dado').hidden = true;
    $('dado-texto').textContent = '?';
  }
}

function ocultarDado() { $('capa-dado').hidden = true; }

// Empieza la animación de lanzar; llama a alTerminar cuando el dado se detiene
function animarDado(resultado, alTerminar) {
  dado.idle = false;
  const T = window.THREE;
  if (!dado.listo) { // sin Three.js: números que cambian rápido
    dado.anim = { t: 0, resultado, alTerminar, simple: true };
    return;
  }
  const eje = new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  dado.anim = { t: 0, resultado, alTerminar, eje, qFinal: giroFinal(resultado), qInicio: null, listo: false };
  if (animacionesReducidas()) dado.anim.t = 1.4;
}

function actualizarDado(dt) {
  if ($('capa-dado').hidden) return;
  const a = dado.anim;
  if (!dado.listo) {
    if (a && !a.listo) {
      a.t += dt;
      $('dado-texto').textContent = a.t < 1.1 ? 1 + Math.floor(Math.random() * 10) : a.resultado;
      if (a.t >= 1.1) terminarDado(a);
    }
    return;
  }
  const m = dado.malla, T = THREE;
  if (dado.idle) { // girando lento mientras espera; si lo están agitando, tiembla y gira rápido
    const ag = dado.agite || 0;
    m.rotation.y += dt * (1.2 + ag * 18);
    m.rotation.x = Math.sin(performance.now() / 700) * 0.4 + (Math.random() - 0.5) * ag * 0.8;
    m.position.y = Math.sin(performance.now() / 300) * 0.08 + (Math.random() - 0.5) * ag * 0.3;
    m.position.x = (Math.random() - 0.5) * ag * 0.3;
  } else if (a && !a.listo) {
    a.t += dt;
    const GIRO = 0.9, ACOMODO = 0.5;
    if (a.t < GIRO) {
      const vel = 22 * (1 - a.t / GIRO) + 5;
      a.eje.applyAxisAngle(new T.Vector3(0, 1, 0), dt * 3); // el eje cambia: giro más loco
      m.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(a.eje, vel * dt));
      m.position.y = Math.abs(Math.sin(a.t / GIRO * Math.PI * 2)) * 0.55 * (1 - a.t / GIRO);
      m.scale.setScalar(1 + 0.15 * Math.sin(a.t / GIRO * Math.PI));
    } else {
      if (!a.qInicio) a.qInicio = m.quaternion.clone();
      const k = Math.min(1, (a.t - GIRO) / ACOMODO);
      const suave = 1 - Math.pow(1 - k, 3);
      m.quaternion.copy(a.qInicio).slerp(a.qFinal, suave);
      m.position.y = Math.sin(k * Math.PI) * 0.12;
      m.scale.setScalar(1);
      if (k >= 1) terminarDado(a);
    }
  }
  dado.renderer.render(dado.escena, dado.camara);
}

function terminarDado(a) {
  a.listo = true;
  if (dado.listo) { dado.malla.quaternion.copy(a.qFinal); dado.malla.position.y = 0; dado.renderer.render(dado.escena, dado.camara); }
  const r = $('resultado-dado');
  r.textContent = a.resultado;
  r.classList.add('visible');
  sonar('listo');
  a.alTerminar();
}

/* ---------- 9C. TURNOS Y MOVIMIENTO ---------- */
const juego = { fase: 'esperando', espera: 0, pasos: 0, mov: null, opciones: null, eleccion: 0, reloj: 0, reto: null, alTerminarMov: null };
const DURACION_PASO = 0.3; // segundos por casilla

const jugadorActual = () => estado.partida.jugadores[estado.partida.turno];
const pausado = () => !$('capa-pausa').hidden;

function empezarTurno() {
  const j = jugadorActual();
  tablero.sigue = true;
  tablero.verTodo = false;
  actualizarBotonesCamara();
  actualizarTurnoHud();
  juego.fase = 'esperando';
  juego.espera = !j.humano && estado.partida.jugadores.length > 4 ? 0.45 : 1.1; // con 8, los bots no hacen esperar
  mostrarDado(COLORES_J[j.num], j.pj.nombre + (j.humano ? '' : ' (bot)'));
  dado.agite = 0;
  if (j.humano && esRemoto(j)) {
    ponerMensaje('Turno de ' + j.pj.nombre + ' (J' + (j.num + 1) + ')',
      [{ texto: 'Lanzar dado', clase: 'b-amarillo', accion: lanzarDado }],
      '¡Agita tu celular para lanzar el dado!');
  } else if (j.humano) {
    // Si este aparato tiene sensor de movimiento, se lanza agitándolo (agitar.js)
    const conSensor = estado.opciones.agitar && Agitar.disponible();
    const botones = [{ texto: 'Lanzar dado', clase: 'b-amarillo', accion: lanzarDado }];
    if (conSensor && Agitar.necesitaPermiso() && !empezarTurno.intentado) {
      // Primero se pide el permiso sin botón (Android lo da solo); iPhone necesitará el botón
      empezarTurno.intentado = true;
      Agitar.pedirPermiso().then(() => { if (juego.fase === 'esperando' && jugadorActual() === j) empezarTurno(); });
    }
    if (conSensor && Agitar.necesitaPermiso()) {
      botones.push({ texto: 'Activar sacudida', clase: 'b-cian', accion: () => Agitar.pedirPermiso().then((ok) => { if (ok && juego.fase === 'esperando') empezarTurno(); }) });
    }
    ponerMensaje('Turno de ' + j.pj.nombre + ' (J' + (j.num + 1) + ')', botones,
      conSensor ? '¡Agita el celular para lanzar! O toca el botón.' : 'Toca el dado o pulsa Espacio. Arrastra para mirar el mapa.');
    if (conSensor && !Agitar.necesitaPermiso()) Agitar.empezar(lanzarDado, (e) => { dado.agite = e; });
  } else {
    ponerMensaje('Turno de ' + j.pj.nombre + ' (bot)', [], 'El bot está lanzando el dado...');
  }
  aviso('Turno de ' + j.pj.nombre);
}

function lanzarDado() {
  if (juego.fase !== 'esperando' || pausado()) return;
  Agitar.parar();
  dado.agite = 0;
  juego.fase = 'lanzando';
  sonar('clic');
  const resultado = 1 + Math.floor(Math.random() * 10);
  ponerMensaje(jugadorActual().pj.nombre + ' lanza el dado...', [], '');
  animarDado(resultado, () => {
    juego.pasos = resultado;
    juego.fase = 'resultado';
    juego.espera = animacionesReducidas() ? 0.6 : 0.9;
    ponerMensaje('¡Sacó ' + resultado + '!', [], 'Avanza ' + resultado + (resultado === 1 ? ' casilla' : ' casillas'));
    aviso(jugadorActual().pj.nombre + ' sacó ' + resultado);
  });
}

function siguientePaso() {
  const j = jugadorActual();
  const k = MUNDOS[estado.mundo].mapa.casillas[j.casilla];
  if (k.sig.length > 1) {
    juego.fase = 'eligiendo';
    juego.opciones = k.sig;
    juego.eleccion = 0;
    juego.espera = 0.8;
    if (j.humano) {
      const casillas = MUNDOS[estado.mundo].mapa.casillas;
      ponerMensaje('¿Por dónde sigues?', juego.opciones.map((op, i) => ({
        texto: casillas[op].atajo ? 'Tomar el atajo' : 'Seguir el camino',
        clase: casillas[op].atajo ? 'b-rosa' : 'b-cian',
        accion: () => elegirCamino(i)
      })), 'Flechas para cambiar y Enter para elegir, o toca una flecha del mapa.');
    } else {
      ponerMensaje(j.pj.nombre + ' está decidiendo...', [], '');
    }
    return;
  }
  juego.mov = { desde: j.casilla, hacia: k.sig[0], t: 0 };
  juego.fase = 'moviendo';
}

function elegirCamino(i) {
  if (juego.fase !== 'eligiendo') return;
  const j = jugadorActual();
  sonar('elegir');
  juego.mov = { desde: j.casilla, hacia: juego.opciones[i], t: 0 };
  juego.fase = 'moviendo';
  ponerMensaje(j.pj.nombre + ' avanza', [], '');
}

function terminarMovimiento() {
  juego.mov = null;
  // Movimiento extra (cometa, hielo, lianas): avisa y no repite el efecto de la casilla
  if (juego.alTerminarMov) {
    const r = juego.alTerminarMov;
    juego.alTerminarMov = null;
    juego.fase = 'efecto';
    r();
    return;
  }
  juego.fase = 'efecto';
  const j = jugadorActual(), partida = estado.partida;
  resolverCasilla(j).then(() => {
    if (estado.partida !== partida) return;
    juego.fase = 'fin';
    juego.espera = 0.6;
  });
}

function pasarTurno() {
  const p = estado.partida;
  p.turno++;
  if (p.turno >= p.jugadores.length) {
    // Fin de la ronda: minijuego (minijuegos.js), luego la estrella salta
    p.turno = 0;
    juego.fase = 'efecto';
    jugarMinijuego(p).then(() => {
      if (estado.partida !== p) return;
      p.ronda++;
      if (p.ronda > estado.rondas) { terminarPartida(); return; }
      aviso('Ronda ' + p.ronda);
      actualizarTurnoHud();
      moverEstrella(p, 'Ronda ' + p.ronda + ': la estrella fugaz salta a otro lugar').then(() => {
        if (estado.partida === p) empezarTurno();
      });
    });
    return;
  }
  empezarTurno();
}

function terminarPartida() {
  juego.fase = 'terminado';
  estado.partida.ronda = estado.rondas;
  ocultarDado();
  actualizarTurnoHud();
  ponerMensaje('¡Se acabaron las rondas!', [], '');
  mostrarPodio();
}

// El "cerebro" de la partida: se llama en cada cuadro con el tiempo transcurrido
function actualizarJuego(dt) {
  // Pantalla de un invitado a distancia: no corre la lógica, solo dibuja lo que manda el anfitrión (espejo.js)
  if (typeof ESPEJO !== 'undefined' && ESPEJO.activo) { avanzarEspejo(dt); return; }
  if (pausado()) return;
  avanzarTareas(dt);
  if (MJ.activo) { actualizarMJ(dt); return; }
  actualizarDado(dt);
  if (juego.fase === 'reto') { actualizarReto(dt); return; }
  const j = jugadorActual();
  if (juego.fase === 'esperando' && !j.humano) {
    juego.espera -= dt;
    if (juego.espera <= 0) lanzarDado();
  } else if (juego.fase === 'resultado') {
    juego.espera -= dt;
    if (juego.espera <= 0) { ocultarDado(); siguientePaso(); }
  } else if (juego.fase === 'eligiendo' && !j.humano) {
    juego.espera -= dt;
    if (juego.espera <= 0) elegirCamino(Math.floor(Math.random() * juego.opciones.length));
  } else if (juego.fase === 'moviendo') {
    const rapido = !j.humano && estado.partida.jugadores.length > 4 ? 0.65 : 1; // bots más ágiles con 8
    juego.mov.t += dt / ((animacionesReducidas() ? DURACION_PASO * 0.6 : DURACION_PASO) * rapido * (juego.mov.dur || 1));
    if (juego.mov.t >= 1) {
      j.casilla = juego.mov.hacia;
      juego.pasos--;
      sonar('mover');
      const seguir = () => { if (juego.pasos > 0) siguientePaso(); else terminarMovimiento(); };
      // Si cae o pasa por la estrella fugaz, empieza el reto para atraparla
      if (estado.partida.estrella && estado.partida.estrella.casilla === j.casilla) {
        juego.fase = 'efecto';
        const partida = estado.partida;
        retoEstrella(j, partida).then(() => { if (estado.partida === partida) seguir(); });
      } else seguir();
    }
  } else if (juego.fase === 'fin') {
    juego.espera -= dt;
    if (juego.espera <= 0) pasarTurno();
  }
}

// Posición del jugador en el mundo (en movimiento va saltando entre casillas)
// Posición del jugador en el mundo: los pies quedan en el centro de su casilla.
// Si varios comparten casilla, se reparten un poco para que se vean todos.
const PIES = 0.36; // el sprite se sube esta parte de su tamaño para que los pies toquen la casilla
const GRUPOS = {
  1: [[0, 0]],
  2: [[-0.3, 0], [0.3, 0]],
  3: [[-0.34, 0.06], [0.34, 0.06], [0, -0.2]],
  4: [[-0.3, -0.16], [0.3, -0.16], [-0.3, 0.12], [0.3, 0.12]]
};
// De 5 a 8 en la misma casilla: dos filas de hasta 4
for (let n = 5; n <= 8; n++) {
  GRUPOS[n] = Array.from({ length: n }, (_, i) => {
    const fila = i < 4 ? 0 : 1, enFila = fila ? n - 4 : 4, k = fila ? i - 4 : i;
    return [(k - (enFila - 1) / 2) * 0.32, fila ? 0.14 : -0.18];
  });
}
function posJugador(j, idx) {
  const casillas = MUNDOS[estado.mundo].mapa.casillas;
  const tam = ESPACIO * 0.95;
  const moviendo = (i) => i === estado.partida.turno && juego.fase === 'moviendo' && juego.mov;
  if (moviendo(idx)) {
    const a = casillas[juego.mov.desde], b = casillas[juego.mov.hacia], t = Math.min(1, juego.mov.t);
    const alto = juego.mov.salto ? tam * 2.2 : tam * 0.4;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - tam * PIES - Math.sin(t * Math.PI) * alto, mira: b.x - a.x, moviendo: true };
  }
  const k = casillas[j.casilla];
  const juntos = estado.partida.jugadores.filter((o, i) => o.casilla === j.casilla && !moviendo(i));
  const [ox, oy] = GRUPOS[juntos.length][juntos.indexOf(j)] || [0, 0];
  return { x: k.x + ox * tam, y: k.y - tam * PIES + oy * tam, mira: 1, moviendo: false };
}

function ponerMensaje(texto, botones, nota) {
  ponerMensaje.botones = botones; // red.js los copia al celular del jugador
  $('texto-turno').textContent = texto;
  const cont = $('acciones-turno');
  cont.textContent = '';
  botones.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'boton boton-chico ' + b.clase;
    btn.textContent = b.texto;
    btn.addEventListener('click', () => { btn.blur(); b.accion(); });
    cont.appendChild(btn);
  });
  $('nota-turno').textContent = nota || '';
  $('nota-turno').hidden = !nota;
}

function actualizarTurnoHud() {
  $('hud-ronda').textContent = 'Ronda ' + estado.partida.ronda + '/' + estado.rondas;
  document.querySelectorAll('.hud-jugador').forEach((t, i) => t.classList.toggle('activo', i === estado.partida.turno && juego.fase !== 'terminado'));
}

// Clic o toque sobre una flecha del mapa al elegir camino
function clicEnTablero(e) {
  if (juego.fase !== 'eligiendo' || !jugadorActual().humano) return;
  const r = tablero.lienzo.getBoundingClientRect(), cam = tablero.cam;
  const wx = (e.clientX - r.left - tablero.ancho / 2) / cam.zoom + cam.x;
  const wy = (e.clientY - r.top - tablero.alto / 2) / cam.zoom + cam.y;
  const casillas = MUNDOS[estado.mundo].mapa.casillas;
  juego.opciones.forEach((op, i) => {
    const k = casillas[op];
    if (Math.hypot(k.x - wx, k.y - wy) < ESPACIO * 0.9) elegirCamino(i);
  });
}

/* ---------- 9D. EFECTOS DE CASILLAS, ESTRELLA FUGAZ Y PODIO ---------- */
// Esperas que respetan la pausa (avanzan en actualizarJuego)
const tareas = [];
function esperarSeg(s) {
  if (animacionesReducidas()) s *= 0.5;
  return new Promise((r) => tareas.push({ quedan: s, r }));
}
function avanzarTareas(dt) {
  juego.reloj += dt;
  for (let i = tareas.length - 1; i >= 0; i--) {
    tareas[i].quedan -= dt;
    if (tareas[i].quedan <= 0) { const t = tareas.splice(i, 1)[0]; t.r(); }
  }
}

const casillasMapa = () => MUNDOS[estado.mundo].mapa.casillas;
const azarEntero = (n) => Math.floor(Math.random() * n);

// Le pregunta algo al jugador humano con botones; devuelve el número del botón elegido
function pedirDecision(texto, botones, nota) {
  return new Promise((resolver) => {
    ponerMensaje(texto, botones.map((b, i) => ({ texto: b.texto, clase: b.clase, accion: () => { sonar('clic'); ponerMensaje(texto, [], ''); resolver(i); } })), nota);
    const primero = $('acciones-turno').querySelector('button');
    if (primero) primero.focus({ preventScroll: true });
  });
}

// La cámara mira un punto un momento y luego vuelve al jugador
async function mirarA(x, y, segundos) {
  tablero.foco = { x, y };
  await esperarSeg(segundos);
  tablero.foco = null;
}

/* --- Monedas, estrellas y textos flotantes --- */
function flotante(j, texto, color) {
  const p = posJugador(j, j.num);
  tablero.flotantes.push({ x: p.x, y: p.y - ESPACIO * 0.8, texto, color, t0: juego.reloj });
}

function cambiarMonedas(j, n) {
  const real = Math.max(-j.monedas, n);
  j.monedas += real;
  flotante(j, (real >= 0 ? '+' : '') + real, real >= 0 ? '#ffd23f' : '#ff4d5e');
  sonar(real >= 0 ? 'elegir' : 'quitar');
  actualizarHudJugador(j);
  return real;
}

function actualizarHudJugador(j) {
  const tarjeta = document.querySelector('.hud-jugador.h' + j.num);
  if (!tarjeta) return;
  const datos = tarjeta.querySelectorAll('.hud-datos span');
  const valores = [[j.monedas, 'monedas'], [j.estrellas, 'estrellas']];
  datos.forEach((span, i) => {
    const b = span.querySelector('b');
    if (b.textContent !== String(valores[i][0])) {
      b.textContent = valores[i][0];
      span.setAttribute('aria-label', valores[i][0] + ' ' + valores[i][1]);
      span.classList.remove('salto-dato');
      void span.offsetWidth; // reinicia la animación
      span.classList.add('salto-dato');
    }
  });
}

/* --- Carta grande en el centro (eventos y reglas del mundo) --- */
async function mostrarCarta(icono, titulo, texto, color, duracion = 1.7) {
  $('carta-3d').hidden = true;
  const carta = $('carta');
  carta.style.setProperty('--carta-color', color);
  $('carta-icono').textContent = icono;
  $('carta-titulo').textContent = titulo;
  $('carta-texto').textContent = texto;
  carta.hidden = false;
  carta.classList.remove('entra');
  void carta.offsetWidth;
  carta.classList.add('entra');
  sonar('listo');
  aviso(titulo + '. ' + texto);
  if (!duracion) return; // la cierra quien la abrió
  await esperarSeg(duracion);
  carta.hidden = true;
}

/* --- Movimientos extra (cometa, hielo y lianas) --- */
function moverExtra(j, pasos) {
  return new Promise((resolver) => {
    juego.alTerminarMov = resolver;
    juego.pasos = pasos;
    siguientePaso();
  });
}

// Lianas: un solo salto largo que avanza varias casillas de una vez
function saltoLargo(j, pasos) {
  return new Promise((resolver) => {
    let destino = j.casilla;
    for (let i = 0; i < pasos; i++) destino = casillasMapa()[destino].sig[0];
    juego.alTerminarMov = resolver;
    juego.pasos = 1;
    juego.mov = { desde: j.casilla, hacia: destino, t: 0, dur: 2.4, salto: true };
    juego.fase = 'moviendo';
    sonar('elegir');
  });
}

/* --- Lo que pasa al caer en cada casilla --- */
async function resolverCasilla(j) {
  const p = estado.partida, k = casillasMapa()[j.casilla];
  if (k.tipo === 'A') { cambiarMonedas(j, 3); ponerMensaje('¡Casilla azul!', [], j.pj.nombre + ' gana 3 monedas.'); await esperarSeg(1); }
  else if (k.tipo === 'R') { cambiarMonedas(j, -3); ponerMensaje('Casilla roja', [], j.pj.nombre + ' pierde 3 monedas.'); await esperarSeg(1); }
  else if (k.tipo === 'E') await eventoAlAzar(j, p);
  else if (k.tipo === 'M') await reglaDelMundo(j, p);
  else if (k.tipo === 'T') await observatorio(j, p);
  else if (k.tipo === 'D') await dueloCasilla(j, p);
}

// Casilla de duelo: eliges a un rival y juegan un minijuego 1 contra 1 (minijuegos.js)
async function dueloCasilla(j, p) {
  const rivales = p.jugadores.filter((o) => o !== j);
  ponerMensaje('¡Casilla de duelo!', [], j.pj.nombre + ' reta a alguien a un minijuego 1 contra 1.');
  await esperarSeg(0.9);
  if (estado.partida !== p) return;
  let rival;
  if (j.humano) {
    const i = await pedirDecision('¿A quién retas?', rivales.map((o) => ({ texto: o.pj.nombre + ' (' + o.monedas + ' monedas)', clase: 'b-crema' })),
      'El ganador le quita 5 monedas al otro.');
    rival = rivales[i];
  } else {
    // El bot suele retar al que tiene más monedas
    rival = Math.random() < 0.7 ? [...rivales].sort((a, b) => b.monedas - a.monedas)[0] : rivales[azarEntero(rivales.length)];
    await esperarSeg(0.8);
  }
  if (estado.partida !== p) return;
  ponerMensaje(j.pj.nombre + ' contra ' + rival.pj.nombre, [], '¡Que empiece el duelo!');
  sonar('listo');
  await esperarSeg(1);
  if (estado.partida !== p) return;
  await jugarMinijuego(p, { modo: 'duelo', jugadores: [j, rival] });
}

const EVENTOS = [
  { icono: '!!', titulo: 'Minijuego relámpago', texto: '¡Todos juegan ahora mismo! El ganador se lleva 5 monedas.', color: '#ffd23f',
    hacer: (j, p) => jugarMinijuego(p, { modo: 'relampago' }) },
  { icono: '$', titulo: 'Lluvia de meteoritos dorados', texto: '¡Ganas 5 monedas!', color: '#ffd23f',
    hacer: (j) => { cambiarMonedas(j, 5); } },
  { icono: '>>', titulo: 'Cometa veloz', texto: 'Te empuja 3 casillas más.', color: '#22d3ee',
    hacer: (j) => moverExtra(j, 3) },
  { icono: '@', titulo: 'Agujero negro', texto: 'Te traga y te escupe en otro lugar del mapa.', color: '#a06bff',
    hacer: async (j) => {
      j.casilla = 1 + azarEntero(casillasMapa().length - 1);
      sonar('quitar');
      await esperarSeg(0.8);
    } },
  { icono: '!', titulo: 'Robo cósmico', texto: 'Le quitas 3 monedas a otro jugador.', color: '#ff5fa2',
    hacer: async (j, p) => {
      const otros = p.jugadores.filter((o) => o !== j && o.monedas > 0);
      if (!otros.length) { ponerMensaje('Nadie tiene monedas para robar', [], ''); return; }
      const victima = otros[azarEntero(otros.length)];
      const robado = -cambiarMonedas(victima, -3);
      cambiarMonedas(j, robado);
      ponerMensaje(j.pj.nombre + ' le robó ' + robado + ' a ' + victima.pj.nombre, [], '');
      await esperarSeg(0.8);
    } },
  { icono: '<>', titulo: 'Intercambio', texto: 'Cambias de lugar con otro jugador.', color: '#3ddc7a',
    hacer: async (j, p) => {
      const otro = p.jugadores.filter((o) => o !== j)[azarEntero(p.jugadores.length - 1)];
      [j.casilla, otro.casilla] = [otro.casilla, j.casilla];
      sonar('elegir');
      ponerMensaje(j.pj.nombre + ' cambió de lugar con ' + otro.pj.nombre, [], '');
      await esperarSeg(1);
    } }
];

async function eventoAlAzar(j, p) {
  const ev = EVENTOS[azarEntero(EVENTOS.length)];
  ponerMensaje('¡Evento!', [], '');
  await mostrarCarta(ev.icono, ev.titulo, ev.texto, ev.color);
  if (estado.partida !== p) return;
  await ev.hacer(j, p);
  await esperarSeg(0.6);
}

async function reglaDelMundo(j, p) {
  const m = MUNDOS[estado.mundo];
  const color = m.colores.regla;
  if (m.id === 'glaciar') {
    await mostrarCarta('~', 'Hielo resbaloso', '¡Te deslizas 2 casillas más!', color);
    await moverExtra(j, 2);
  } else if (m.id === 'jungla') {
    await mostrarCarta('^4', 'Lianas', '¡Te balanceas y saltas 4 casillas!', color);
    await saltoLargo(j, 4);
  } else if (m.id === 'volcan') {
    await mostrarCarta('!', 'Erupción', 'El volcán explota: los demás pierden 2 monedas.', color);
    tablero.temblor = juego.reloj + 0.9;
    sonar('error');
    p.jugadores.filter((o) => o !== j).forEach((o) => cambiarMonedas(o, -2));
    await esperarSeg(1.2);
  } else {
    // Casino: ruleta rápida entre +6 y -4
    const carta = $('carta');
    const gana = Math.random() < 0.5;
    mostrarCarta('$', 'Casino', '¡Tragamonedas!', color, 0);
    const con3D = await girarTraga(gana); // rodillos 3D (minijuegos.js)
    if (!con3D) {
      for (let i = 0; i < 12; i++) {
        $('carta-texto').textContent = i % 2 ? '+6 monedas' : '-4 monedas';
        sonar('mover');
        await esperarSeg(0.07 + i * 0.012);
      }
    }
    $('carta-texto').textContent = gana ? '¡Ganaste 6 monedas!' : 'Perdiste 4 monedas';
    await esperarSeg(0.9);
    carta.hidden = true;
    $('carta-3d').hidden = true;
    cambiarMonedas(j, gana ? 6 : -4);
    await esperarSeg(0.8);
  }
}

/* --- Observatorio: muestra la estrella y deja teletransportarse cerca --- */
function casillasAntes(destino, pasos) {
  const casillas = casillasMapa();
  let actual = destino;
  for (let i = 0; i < pasos; i++) {
    const anterior = casillas.findIndex((c) => c.sig[0] === actual) ;
    if (anterior < 0) break;
    actual = anterior;
  }
  return actual;
}

async function observatorio(j, p) {
  const e = p.estrella;
  const k = casillasMapa()[e.casilla];
  ponerMensaje('Observatorio', [], 'Mira dónde está la estrella fugaz...');
  await mirarA(k.x, k.y, 1.4);
  if (estado.partida !== p) return;
  if (j.monedas < 8) {
    ponerMensaje('Observatorio', [], 'No te alcanzan las monedas para teletransportarte (cuesta 8).');
    await esperarSeg(1.2);
    return;
  }
  let acepta;
  if (j.humano) {
    acepta = (await pedirDecision('¿Teletransportarte cerca de la estrella?', [
      { texto: 'Sí (8 monedas)', clase: 'b-verde' },
      { texto: 'No', clase: 'b-crema' }
    ], 'Quedarás a 3 casillas de ella.')) === 0;
  } else {
    ponerMensaje(j.pj.nombre + ' está pensando...', [], '');
    await esperarSeg(0.8);
    acepta = Math.random() < 0.6;
  }
  if (estado.partida !== p || !acepta) return;
  cambiarMonedas(j, -8);
  j.casilla = casillasAntes(e.casilla, 3);
  sonar('listo');
  ponerMensaje('¡Teletransporte!', [], j.pj.nombre + ' quedó cerca de la estrella.');
  await esperarSeg(1.1);
}

/* --- Estrella fugaz --- */
function lugarParaEstrella(p) {
  const casillas = casillasMapa();
  let i;
  do { i = 1 + azarEntero(casillas.length - 1); }
  while (p.jugadores.some((j) => j.casilla === i) || (p.estrella && p.estrella.casilla === i));
  return i;
}

// Cae (o salta) a un nuevo lugar con animación y la cámara la muestra
async function moverEstrella(p, texto) {
  p.estrella = { casilla: lugarParaEstrella(p), cae: juego.reloj };
  const k = casillasMapa()[p.estrella.casilla];
  ponerMensaje(texto, [], '');
  aviso(texto);
  sonar('listo');
  await mirarA(k.x, k.y, 1.8);
}

async function retoEstrella(j, p) {
  const quien = j.pj.nombre;
  let red = false;
  ponerMensaje('¡' + quien + ' alcanzó la estrella fugaz!', [], '');
  await esperarSeg(0.6);
  if (estado.partida !== p) return;
  if (j.monedas >= 10) {
    if (j.humano) {
      red = (await pedirDecision('¿Usar la Red grande?', [
        { texto: 'Sí (10 monedas)', clase: 'b-verde' },
        { texto: 'No', clase: 'b-crema' }
      ], 'La zona verde del reto será el doble de ancha.')) === 0;
    } else {
      red = Math.random() < 0.7;
    }
    if (red) cambiarMonedas(j, -10);
  }
  if (estado.partida !== p) return;
  const atrapada = await jugarReto(j, red);
  if (estado.partida !== p) return;
  if (atrapada) {
    j.estrellas++;
    actualizarHudJugador(j);
    flotante(j, '+1 estrella', '#ffffff');
    sonar('listo');
    ponerMensaje('¡' + quien + ' atrapó la estrella fugaz!', [], '');
    await esperarSeg(1.2);
    if (estado.partida !== p) return;
    await moverEstrella(p, '¡Cae una nueva estrella fugaz!');
  } else {
    sonar('error');
    ponerMensaje('¡Se escapó!', [], 'La estrella salta a otro lugar.');
    await esperarSeg(1);
    if (estado.partida !== p) return;
    await moverEstrella(p, 'La estrella fugaz se escondió en otro lugar');
  }
}

// Reto de reflejos: presionar cuando la flecha esté en la zona verde
function jugarReto(j, red) {
  return new Promise((resolver) => {
    const ancho = red ? 0.3 : 0.15;
    const centro = 0.25 + Math.random() * 0.5;
    juego.reto = { j, ancho, centro, t: 0, vel: 0.9 + Math.random() * 0.3, resuelto: false, resolver,
      botPresiona: j.humano ? null : 0.8 + Math.random() * 1.6, botAcierta: Math.random() < (red ? 0.7 : 0.4) };
    ponerMensaje('¡Reto de la estrella fugaz!', [], '');
    $('reto-quien').textContent = j.pj.nombre + (j.humano ? '' : ' (bot)');
    $('reto-ayuda').textContent = j.humano ? 'Pulsa Espacio, Enter o el botón justo en la zona verde. ¡Un solo intento!' : 'El bot lo intenta...';
    $('reto-zona').style.left = ((centro - ancho / 2) * 100) + '%';
    $('reto-zona').style.width = (ancho * 100) + '%';
    $('btn-atrapar').disabled = !j.humano;
    $('reto').hidden = false;
    juego.fase = 'reto';
    if (j.humano) $('btn-atrapar').focus({ preventScroll: true });
  });
}

function posFlecha(r) { return (1 - Math.cos(r.t * r.vel * Math.PI * 2)) / 2; }

function actualizarReto(dt) {
  const r = juego.reto;
  if (!r || r.resuelto) return;
  r.t += dt;
  // El bot "acomoda" su intento para acertar o fallar según su suerte
  if (r.botPresiona !== null && r.t >= r.botPresiona) {
    const dentro = Math.abs(posFlecha(r) - r.centro) < r.ancho / 2;
    if (dentro === r.botAcierta || r.t > r.botPresiona + 2.5) { atrapar(); return; }
  }
  if (r.t > 6) { atrapar(); return; } // si no presiona, cuenta como fallo
  $('reto-flecha').style.left = (posFlecha(r) * 100) + '%';
}

function atrapar() {
  const r = juego.reto;
  if (!r || r.resuelto) return;
  r.resuelto = true;
  const acierta = r.t <= 6 && Math.abs(posFlecha(r) - r.centro) < r.ancho / 2;
  $('reto-flecha').style.left = (posFlecha(r) * 100) + '%';
  $('reto-ayuda').textContent = acierta ? '¡ATRAPADA!' : '¡Fallaste!';
  sonar(acierta ? 'listo' : 'error');
  esperarSeg(0.9).then(() => {
    $('reto').hidden = true;
    juego.reto = null;
    juego.fase = 'efecto';
    r.resolver(acierta);
  });
}

/* --- Dibujo de la estrella fugaz y los textos flotantes (coordenadas del mapa) --- */
function dibujarEstrellaFugaz(c) {
  const p = estado.partida;
  if (!p || !p.estrella) return;
  const k = casillasMapa()[p.estrella.casilla];
  const t = juego.reloj;
  const caida = Math.min(1, (t - p.estrella.cae) / 0.9);
  const fx = k.x - (1 - caida) * 700, fy = k.y - ESPACIO * 0.9 - (1 - caida) * 900;
  if (caida < 1) { // estela de la caída
    c.strokeStyle = 'rgba(255,255,255,.75)';
    c.lineWidth = 10;
    c.beginPath(); c.moveTo(fx - 160, fy - 200); c.lineTo(fx, fy); c.stroke();
  }
  const pulso = animacionesReducidas() ? 1 : 1 + Math.sin(t * 6) * 0.12;
  c.fillStyle = 'rgba(255,240,140,.35)';
  c.beginPath(); c.arc(fx, fy, ESPACIO * 0.6 * pulso, 0, Math.PI * 2); c.fill();
  if (dibujarEstrella3D(c, fx, fy, ESPACIO * 1.25 * pulso, t)) return; // estrella 3D (minijuegos.js)
  estrella(c, fx, fy, ESPACIO * 0.42 * pulso, ESPACIO * 0.18 * pulso);
  c.fillStyle = '#fff27a'; c.fill();
  c.lineWidth = 5; c.strokeStyle = TINTA; c.stroke();
  c.fillStyle = TINTA; // carita
  c.fillRect(fx - 9, fy - 4, 5, 7); c.fillRect(fx + 4, fy - 4, 5, 7);
}

function dibujarFlotantes(c) {
  const t = juego.reloj;
  tablero.flotantes = tablero.flotantes.filter((f) => t - f.t0 < 1.3);
  c.font = '18px "Press Start 2P", monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  tablero.flotantes.forEach((f) => {
    const k = (t - f.t0) / 1.3;
    const y = f.y - k * 50;
    c.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    c.fillStyle = TINTA;
    c.fillText(f.texto, f.x + 3, y + 3);
    c.fillStyle = f.color;
    c.fillText(f.texto, f.x, y);
    c.globalAlpha = 1;
  });
}

/* --- Podio final --- */
function mostrarPodio() {
  const p = estado.partida;
  const orden = [...p.jugadores].sort((a, b) => b.estrellas - a.estrellas || b.monedas - a.monedas);
  const ganador = orden[0];
  sumarVictoria(ganador.pj.id);
  $('podio-titulo').textContent = '¡Gana ' + ganador.pj.nombre + '!';
  const cont = $('podio-lugares');
  cont.textContent = '';
  const enPodio = orden.length > 4 ? [1, 0, 2] : [1, 0, 2, 3];
  cont.classList.toggle('tres', orden.length > 4);
  enPodio.forEach((pos) => { // 2.º, 1.º, 3.º (y 4.º) como un podio
    const j = orden[pos];
    const col = document.createElement('div');
    col.className = 'podio-col lugar-' + (pos + 1);
    const sprite = crearSprite(j.pj.id, pos === 0 ? 'victoria' : '');
    const nombre = document.createElement('p');
    nombre.className = 'podio-nombre';
    nombre.textContent = j.pj.nombre;
    const datos = document.createElement('p');
    datos.className = 'podio-datos';
    datos.textContent = j.estrellas + ' estrellas, ' + j.monedas + ' monedas';
    const bloque = document.createElement('div');
    bloque.className = 'podio-bloque color-j' + (j.num + 1);
    bloque.textContent = (pos + 1) + '.º';
    col.append(sprite, nombre, datos, bloque);
    cont.appendChild(col);
  });
  const resto = $('podio-resto');
  resto.textContent = '';
  orden.slice(enPodio.length).forEach((j, i) => {
    const li = document.createElement('li');
    li.textContent = (enPodio.length + i + 1) + '.º ' + j.pj.nombre + ': ' + j.estrellas + ' estrellas, ' + j.monedas + ' monedas';
    resto.appendChild(li);
  });
  resto.hidden = !resto.children.length;
  sonar('listo');
  aviso('Fin de la partida. Gana ' + ganador.pj.nombre);
  abrirVentana('capa-podio');
}

/* ---------- 10. PAUSA Y OPCIONES ---------- */
let focoAntes = null;

function abrirVentana(id) {
  focoAntes = document.activeElement;
  $(id).hidden = false;
  $(id).querySelector('button, input').focus();
}
function cerrarVentana(id) {
  $(id).hidden = true;
  if (focoAntes && document.contains(focoAntes)) focoAntes.focus();
  else if (document.activeElement) document.activeElement.blur();
}

function abrirPausa() {
  if (typeof ESPEJO !== 'undefined' && ESPEJO.activo) return; // solo el anfitrión pausa
  if (estado.pantalla !== 'juego' || !$('capa-pausa').hidden) return;
  sonar('clic');
  abrirVentana('capa-pausa');
  $('btn-continuar').focus();
}
function cerrarPausa() { sonar('clic'); cerrarVentana('capa-pausa'); }

function abrirOpciones() {
  $('op-volumen').value = estado.opciones.volumen;
  $('op-animaciones').checked = estado.opciones.sinAnimaciones;
  $('op-agitar').checked = estado.opciones.agitar;
  $('btn-permiso-sensor').hidden = !Agitar.necesitaPermiso();
  sonar('clic');
  abrirVentana('capa-opciones');
}

function aplicarOpciones() {
  document.body.classList.toggle('sin-animaciones', estado.opciones.sinAnimaciones);
  guardar('opciones', estado.opciones);
}

function pantallaCompleta() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch (e) {
    aviso('Tu navegador no permite pantalla completa aquí.');
  }
}

// Mantiene el foco del teclado dentro de la ventana abierta
function atraparFoco(e, id) {
  if (e.key !== 'Tab') return;
  const elementos = [...$(id).querySelectorAll('button, input')];
  const primero = elementos[0], ultimo = elementos[elementos.length - 1];
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
}

/* ---------- 11. TECLADO ---------- */
document.addEventListener('keydown', (e) => {
  if (typeof ESPEJO !== 'undefined' && ESPEJO.activo) { teclaEspejo(e, true); return; } // invitado a distancia
  const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  // Si hay una ventana abierta, el teclado solo actúa dentro de ella
  const abierta = document.querySelector('.capa:not([hidden])');
  if (abierta) {
    if (abierta.id === 'capa-pausa' && (tecla === 'Escape' || tecla === 'p')) cerrarPausa();
    else if (tecla === 'Escape') { sonar('clic'); cerrarVentana(abierta.id); }
    else atraparFoco(e, abierta.id);
    return;
  }

  const enControl = document.activeElement && document.activeElement.matches('button, input');
  if (estado.pantalla === 'menu') navegarLista(e, tecla);
  else if (estado.pantalla === 'modos') { if (tecla === 'Escape') volver(); else navegarLista(e, tecla); }
  else if (estado.pantalla === 'personajes') teclasPersonajes(e, tecla, enControl);
  else if (estado.pantalla === 'mundos') teclasMundos(e, tecla, enControl);
  else if (estado.pantalla === 'juego' && MJ.activo) {
    // En los minijuegos las teclas son de los 4 jugadores (minijuegos.js)
    if (tecla === 'Escape' || (tecla === 'p' && !manejarTeclaMJ(e))) { e.preventDefault(); abrirPausa(); }
    else if (manejarTeclaMJ(e)) e.preventDefault();
  }
  else if (estado.pantalla === 'juego') {
    if (tecla === 'Escape' || tecla === 'p') { e.preventDefault(); abrirPausa(); }
    else if (juego.fase === 'reto' && (tecla === ' ' || tecla === 'Enter') && juego.reto && juego.reto.j.humano) { e.preventDefault(); atrapar(); }
    else if (juego.fase === 'esperando' && (tecla === ' ' || tecla === 'Enter') && !enControl && jugadorActual().humano) { e.preventDefault(); lanzarDado(); }
    else if (juego.fase === 'eligiendo' && jugadorActual().humano && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd'].includes(tecla)) {
      e.preventDefault();
      juego.eleccion = (juego.eleccion + 1) % juego.opciones.length;
      sonar('mover');
    }
    else if (juego.fase === 'eligiendo' && (tecla === ' ' || tecla === 'Enter') && !enControl && jugadorActual().humano) { e.preventDefault(); elegirCamino(juego.eleccion); }
    else if (tecla === 'm') verMapa();
    else if (tecla === 'c') centrarCamara();
    else if (tecla === '+' || tecla === '=') acercar(1.15);
    else if (tecla === '-') acercar(1 / 1.15);
  }
});

function teclasPersonajes(e, tecla, enControl) {
  if (tecla === 'Escape') { volver(); return; }
  const j2 = estado.modo === 'bots' ? 0 : 1; // con bots, las flechas también mueven a J1
  const movimientos = {
    w: [0, 0, -1], a: [0, -1, 0], s: [0, 0, 1], d: [0, 1, 0],
    ArrowUp: [j2, 0, -1], ArrowLeft: [j2, -1, 0], ArrowDown: [j2, 0, 1], ArrowRight: [j2, 1, 0]
  };
  if (movimientos[tecla]) {
    e.preventDefault();
    const [num, dx, dy] = movimientos[tecla];
    moverCursor(num, dx, dy);
    return;
  }
  if (tecla === ' ' || tecla === 'Enter') {
    if (enControl) return; // deja que el botón con foco haga su acción
    e.preventDefault();
    if (!$('btn-ir-mundos').disabled) { irAMundos(); return; }
    elegir(tecla === ' ' ? 0 : j2);
    return;
  }
  if (tecla === 'q') quitar(0);
  if (tecla === 'Backspace') { e.preventDefault(); quitar(j2); }
}

function teclasMundos(e, tecla, enControl) {
  if (tecla === 'Escape' || tecla === 'b') { volver(); return; }
  if (tecla === 'ArrowLeft' || tecla === 'a') { e.preventDefault(); seleccionarMundo(estado.mundo - 1, true); }
  if (tecla === 'ArrowRight' || tecla === 'd') { e.preventDefault(); seleccionarMundo(estado.mundo + 1, true); }
  if ((tecla === ' ' || tecla === 'Enter') && !enControl) { e.preventDefault(); iniciarPartida(); }
}

/* ---------- 12. ARRANQUE ---------- */
function conectarEventos() {
  $('btn-jugar-menu').addEventListener('click', () => { sonar('clic'); cambiarPantalla('modos'); });
  $('btn-como').addEventListener('click', () => { sonar('clic'); abrirVentana('capa-como'); });
  $('btn-records').addEventListener('click', mostrarRecords);
  $('btn-creditos').addEventListener('click', () => { sonar('clic'); abrirVentana('capa-creditos'); });
  document.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => {
    sonar('clic');
    cerrarVentana(b.closest('.capa').id);
  }));
  // Con el ratón, pasar por encima de un botón del menú lo selecciona
  document.querySelectorAll('.lista-navegable .boton').forEach((b) => b.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') b.focus({ preventScroll: true });
  }));
  document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => elegirModo(b.dataset.modo)));
  document.querySelectorAll('[data-atras]').forEach((b) => b.addEventListener('click', volver));
  document.querySelectorAll('[data-cantidad]').forEach((b) => b.addEventListener('click', () => {
    b.blur();
    estado.humanos = Number(b.dataset.cantidad);
    sonar('clic');
    prepararSeleccion();
  }));
  document.querySelectorAll('[data-rondas]').forEach((b) => b.addEventListener('click', () => { estado.rondasElegidas = true; elegirRondas(Number(b.dataset.rondas)); }));
  document.querySelectorAll('[data-total]').forEach((b) => b.addEventListener('click', () => {
    b.blur(); // para que Espacio y Enter sigan eligiendo personaje
    estado.total = Number(b.dataset.total);
    // Con 8 jugadores la ronda es más larga: por defecto se juegan 6 rondas
    if (!estado.rondasElegidas) elegirRondas(estado.total > 4 ? 6 : 10);
    sonar('clic');
    prepararSeleccion();
  }));

  $('btn-ir-mundos').addEventListener('click', irAMundos);
  $('btn-jugar').addEventListener('click', iniciarPartida);
  $('btn-pausa').addEventListener('click', abrirPausa);
  $('btn-azar').addEventListener('click', mundoAlAzar);
  $('btn-ver-mapa').addEventListener('click', verMapa);
  $('btn-centrar').addEventListener('click', centrarCamara);
  $('caja-dado').addEventListener('click', () => { $('caja-dado').blur(); if (jugadorActual().humano) lanzarDado(); });
  $('btn-continuar').addEventListener('click', cerrarPausa);
  $('btn-salir').addEventListener('click', () => { cerrarVentana('capa-pausa'); cerrarMinijuego(); cambiarPantalla('menu'); });
  $('btn-atrapar').addEventListener('click', atrapar);
  $('btn-podio-menu').addEventListener('click', () => { cerrarVentana('capa-podio'); cambiarPantalla('menu'); });
  $('btn-podio-otra').addEventListener('click', () => { cerrarVentana('capa-podio'); iniciarPartida(); });

  $('btn-opciones').addEventListener('click', abrirOpciones);
  $('btn-cerrar-opciones').addEventListener('click', () => { sonar('clic'); cerrarVentana('capa-opciones'); });
  $('btn-pantalla-completa').addEventListener('click', pantallaCompleta);
  $('op-volumen').addEventListener('input', (e) => { estado.opciones.volumen = Number(e.target.value); aplicarOpciones(); });
  $('op-volumen').addEventListener('change', () => sonar('clic'));
  $('op-animaciones').addEventListener('change', (e) => { estado.opciones.sinAnimaciones = e.target.checked; aplicarOpciones(); });
  $('op-agitar').addEventListener('change', (e) => { estado.opciones.agitar = e.target.checked; aplicarOpciones(); if (!e.target.checked) Agitar.parar(); });
  $('btn-permiso-sensor').addEventListener('click', () => Agitar.pedirPermiso().then((ok) => {
    $('btn-permiso-sensor').hidden = ok;
    aviso(ok ? 'Sensor de movimiento activado.' : 'No se dio permiso al sensor. Puedes lanzar con el botón.');
  }));

  window.addEventListener('resize', () => { if (estado.pantalla === 'juego') ajustarTablero(); });
  // Pausa automática si se cambia de pestaña en medio del juego
  document.addEventListener('visibilitychange', () => { if (document.hidden) abrirPausa(); });
}

function arrancar() {
  estado.opciones = Object.assign(estado.opciones, cargar('opciones', {}));
  aplicarOpciones();
  cargarImagenes();
  construirRejilla();
  construirMundos();
  conectarEventos();
  iniciarFondo();
  cambiarPantalla('menu');
}

arrancar();
