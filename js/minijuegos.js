/* =========================================================
   NEBULA PARTY - minijuegos.js  (v0.9: 12 minijuegos para 2 a 8 jugadores)
   Índice:
   1. Utilidades 3D       2. Controles de los 4 jugadores
   3. Motor (ruleta, instrucciones, cuenta, resultados)
   4. Minijuegos 2D con objetos 3D (1 a 5) y 4B. nuevos (9 a 12)
   5. Minijuegos 3D (6 a 8)
   6. Objetos 3D del tablero (estrella, tragamonedas, copa)
   Usa cosas de script.js: estado, PERSONAJES, IMAGENES, COLORES_J,
   TINTA, sonar, aviso, $, pausado, cambiarMonedas, ponerMensaje.
   ========================================================= */
'use strict';

/* ---------- 1. UTILIDADES 3D ---------- */
const hay3D = () => !!window.THREE;
const ARENA = { w: 960, h: 540 };      // tamaño lógico de los minijuegos
const RES_3D = { w: 480, h: 270 };     // el 3D se dibuja a la mitad y se agranda (pixel)

function crearRender3D(ancho, alto, lienzo) {
  const r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(ancho, alto, false);
  return r;
}

function mat(color, brillo) {
  return new THREE.MeshLambertMaterial({ color, emissive: brillo || 0x000000 });
}

function ponerLuces(escena) {
  escena.add(new THREE.AmbientLight(0xffffff, 0.62));
  const d = new THREE.DirectionalLight(0xffffff, 0.75);
  d.position.set(3, 6, 5);
  escena.add(d);
}

function texturaTexto(texto, fondo, color, ancho, alto, tam) {
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  const x = c.getContext('2d');
  if (fondo) { x.fillStyle = fondo; x.fillRect(0, 0, ancho, alto); }
  x.font = tam + 'px "Press Start 2P", "Courier New", monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = Math.max(3, tam / 4); x.strokeStyle = TINTA;
  x.strokeText(texto, ancho / 2, alto / 2 + 2);
  x.fillStyle = color; x.fillText(texto, ancho / 2, alto / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

// Sprite 2D de un personaje dentro de una escena 3D (siempre mira a la cámara)
function spritePersonaje(idPj, tam) {
  const tex = new THREE.Texture(IMAGENES[idPj]);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.repeat.set(1 / 6, 1);
  tex.needsUpdate = true;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(tam, tam, 1);
  s.userData.tex = tex;
  return s;
}
function cuadroSprite(s, cuadro, voltear) {
  const t = s.userData.tex;
  t.repeat.x = voltear ? -1 / 6 : 1 / 6;
  t.offset.x = voltear ? (cuadro + 1) / 6 : cuadro / 6;
}

function estrellasFondo(escena, cantidad, radio) {
  const pos = [];
  for (let i = 0; i < cantidad; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(radio);
    pos.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  escena.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));
}

/* ---------- 2. CONTROLES DE LOS 4 JUGADORES ---------- */
const TECLAS_MJ = [
  { arriba: ['KeyW'], abajo: ['KeyS'], izq: ['KeyA'], der: ['KeyD'], accion: ['Space'] },
  { arriba: ['ArrowUp'], abajo: ['ArrowDown'], izq: ['ArrowLeft'], der: ['ArrowRight'], accion: ['Enter', 'NumpadEnter'] },
  { arriba: ['KeyI'], abajo: ['KeyK'], izq: ['KeyJ'], der: ['KeyL'], accion: ['KeyO'] },
  { arriba: ['Numpad8'], abajo: ['Numpad5'], izq: ['Numpad4'], der: ['Numpad6'], accion: ['Numpad0'] }
];
const TEXTO_TECLAS = ['W A S D + Espacio', 'Flechas + Enter', 'I J K L + O', 'Numérico 8 4 5 6 + 0'];
const mando = Array.from({ length: 8 }, () => ({ arriba: false, abajo: false, izq: false, der: false, accion: false, pulsos: [], inclX: 0, inclY: 0, usaInclinar: false, empuje: 0 }));

function apretar(num, boton, baja) {
  const m = mando[num];
  if (baja && !m[boton]) m.pulsos.push(boton);
  m[boton] = baja;
}

// Devuelve true si la tecla es de algún jugador
function teclaMinijuego(e, baja) {
  let usada = false;
  TECLAS_MJ.forEach((t, num) => {
    Object.keys(t).forEach((boton) => {
      if (!t[boton].includes(e.code)) return;
      // Con bots, J1 también usa las flechas y Enter
      const quien = estado.modo === 'bots' && num === 1 ? 0 : num;
      apretar(quien, boton, baja);
      usada = true;
    });
  });
  return usada;
}

function pulso(num, boton) {
  const p = mando[num].pulsos, i = p.indexOf(boton);
  if (i < 0) return false;
  p.splice(i, 1);
  return true;
}

function soltarTodo() { mando.forEach((m) => { m.arriba = m.abajo = m.izq = m.der = m.accion = false; m.pulsos.length = 0; m.inclX = m.inclY = m.empuje = 0; }); }

document.addEventListener('keyup', (e) => { if (MJ.activo) teclaMinijuego(e, false); });
window.addEventListener('blur', soltarTodo);

// Dirección (-1, 0 o 1) de un jugador humano
const ejeX = (num) => (mando[num].der ? 1 : 0) - (mando[num].izq ? 1 : 0);
const ejeY = (num) => (mando[num].abajo ? 1 : 0) - (mando[num].arriba ? 1 : 0);
// Con inclinación (celular): x = derecha, y = inclinar hacia adelante. Si no, la cruceta.
const inclinaX = (num) => (mando[num].usaInclinar ? mando[num].inclX : ejeX(num));
const inclinaY = (num) => (mando[num].usaInclinar ? mando[num].inclY : -ejeY(num));
function tomarEmpuje(num) { const e = mando[num].empuje; mando[num].empuje = 0; return e; }

// Sensores del aparato donde corre el juego (si es un celular) para el primer humano local
function humanoLocalConSensor() {
  if (!Agitar.disponible()) return null;
  return MJ.jug.find((j) => j.humano && !esRemoto(j)) || null;
}
function activarSensoresLocales(def) {
  const j = humanoLocalConSensor();
  MJ.sensorLocal = j ? j.num : null;
  $('mj-recentrar').hidden = !(j && def.inclinar);
  if (!j) return;
  if (def.inclinar) {
    mando[j.num].usaInclinar = true;
    Inclinar.alCambiar = (x, y) => { mando[j.num].inclX = x; mando[j.num].inclY = y; };
  }
  if (def.agitar) Agitar.empezarContinuo((f) => { mando[j.num].empuje += f * 0.007; });
}
function apagarSensoresLocales() {
  Inclinar.alCambiar = null;
  Agitar.pararContinuo();
  mando.forEach((m) => { m.usaInclinar = false; });
  if ($('mj-recentrar')) $('mj-recentrar').hidden = true;
}

/* ---------- 3. MOTOR DE MINIJUEGOS ---------- */
const MJ = { activo: false, def: null, fase: null, t: 0, jug: [], resolver: null, c: null, ultimo: null, cartel: '', r3d: null, camOrto: null };
const PREMIOS = [10, 6, 3, 0];
const PREMIOS_8 = [10, 8, 6, 4, 2, 0, 0, 0];

// Lugares de salida para N jugadores: esquinas y, si son más de 4, puntos medios
const LUGARES_8 = [[150, 140], [810, 140], [150, 460], [810, 460], [480, 140], [480, 460], [150, 300], [810, 300]];
function enCirculo(n, r, giro) {
  return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2 + (giro || 0); return [Math.cos(a) * r, Math.sin(a) * r]; });
}

function manejarTeclaMJ(e) { return teclaMinijuego(e, true); }

// Se llama al terminar cada ronda (desde pasarTurno en script.js)
// modo: 'ronda' (fin de ronda), 'duelo' (1 contra 1) o 'relampago' (carta de evento)
async function jugarMinijuego(p, opciones) {
  const modo = (opciones && opciones.modo) || 'ronda';
  const participantes = (opciones && opciones.jugadores) || p.jugadores;
  const lista = MINIJUEGOS.filter((m) => (m.tipo === '2D' || hay3D()) && !(modo === 'duelo' && m.soloGrupo));
  let elegido = lista[Math.floor(Math.random() * lista.length)];
  while (lista.length > 1 && elegido === MJ.ultimo) elegido = lista[Math.floor(Math.random() * lista.length)];
  MJ.ultimo = elegido;
  ponerMensaje(modo === 'duelo' ? '¡Duelo!' : modo === 'relampago' ? '¡Minijuego relámpago!' : '¡Hora del minijuego!', [], '');
  abrirCapaMJ(p, participantes, modo);
  await girarRuleta(lista, lista.indexOf(elegido));
  if (estado.partida !== p) return;
  const ranking = await correrMinijuego(elegido);
  if (estado.partida !== p) return;
  await mostrarResultados(ranking, p);
  cerrarMinijuego();
}

function abrirCapaMJ(p, participantes, modo) {
  MJ.activo = true;
  MJ.sesion = (MJ.sesion || 0) + 1; // para que las pantallas a distancia sepan que empezó otro
  MJ.modo = modo || 'ronda';
  MJ.apuestas = {};
  MJ.apuestaAbierta = MJ.modo === 'duelo';
  MJ.jug = (participantes || p.jugadores).map((j) => ({ num: j.num, pj: j.pj, humano: j.humano, ref: j, puntos: 0, vivo: true }));
  $('mj-ruleta-titulo').textContent = MJ.modo === 'duelo' ? '¡Duelo: ' + MJ.jug.map((j) => j.pj.nombre).join(' contra ') + '!' : MJ.modo === 'relampago' ? '¡Minijuego relámpago!' : '¡Minijuego!';
  MJ.lienzo = $('mj-lienzo');
  MJ.c = MJ.lienzo.getContext('2d');
  ajustarMJ();
  soltarTodo();
  $('capa-mj').hidden = false;
  ['mj-ruleta', 'mj-intro', 'mj-resultados'].forEach((id) => { $(id).hidden = true; });
  MJ.cartel = '';
  if (hay3D() && !MJ.r3d) {
    MJ.r3d = crearRender3D(RES_3D.w, RES_3D.h);
    MJ.camOrto = new THREE.OrthographicCamera(0, ARENA.w, 0, -ARENA.h, -2000, 2000);
    MJ.camOrto.position.z = 500;
  }
}

function cerrarMinijuego() {
  apagarSensoresLocales();
  MJ.activo = false;
  MJ.def = null;
  MJ.fase = null;
  if ($('capa-mj')) $('capa-mj').hidden = true;
  soltarTodo();
}

function ajustarMJ() {
  if (!MJ.lienzo) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  MJ.lienzo.width = innerWidth * dpr;
  MJ.lienzo.height = innerHeight * dpr;
  MJ.escala = Math.min(innerWidth / ARENA.w, innerHeight / ARENA.h);
  MJ.ox = (innerWidth - ARENA.w * MJ.escala) / 2;
  MJ.oy = (innerHeight - ARENA.h * MJ.escala) / 2;
  MJ.dpr = dpr;
}
window.addEventListener('resize', () => { if (MJ.activo) ajustarMJ(); });

// Espera a que la fase termine (se resuelve dentro de actualizarMJ)
function esperarFase(fase, datos) {
  return new Promise((r) => { MJ.fase = fase; MJ.t = 0; MJ.datos = datos || {}; MJ.resolver = r; });
}
function terminarFase(valor) { const r = MJ.resolver; MJ.resolver = null; if (r) r(valor); }

/* --- Ruleta 3D --- */
const ruleta = { r: null, escena: null, cam: null, giro: null, lista: null };

function prepararRuleta(lista) {
  if (!hay3D()) return;
  if (!ruleta.r) {
    ruleta.r = crearRender3D(256, 256, $('ruleta-lienzo'));
    ruleta.cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    ruleta.cam.position.set(0, 5, 3.4);
    ruleta.cam.lookAt(0, 0, 0.2);
  }
  ruleta.escena = new THREE.Scene();
  ponerLuces(ruleta.escena);
  ruleta.giro = new THREE.Group();
  const n = lista.length, paso = Math.PI * 2 / n;
  const colores = [0xff5fa2, 0x22d3ee, 0xffd23f, 0x3ddc7a, 0xa06bff, 0xff8a3d, 0x3d8bff, 0xff4d5e];
  lista.forEach((m, k) => {
    const cuña = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.3, 8, 1, false, k * paso, paso), mat(colores[k % colores.length]));
    ruleta.giro.add(cuña);
    const soporte = new THREE.Group();
    soporte.rotation.y = k * paso + paso / 2;
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.34),
      new THREE.MeshBasicMaterial({ map: texturaTexto(m.corto, null, '#ffffff', 256, 64, 22), transparent: true }));
    etiqueta.position.set(0, 0.17, 1.2);
    etiqueta.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    soporte.add(etiqueta);
    ruleta.giro.add(soporte);
  });
  const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 16), mat(0xffffff, 0x333333));
  ruleta.giro.add(centro);
  ruleta.escena.add(ruleta.giro);
  const borde = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.1, 6, 40), mat(0x1b1240));
  borde.rotation.x = Math.PI / 2;
  ruleta.escena.add(borde);
}

function girarRuleta(lista, indice) {
  $('mj-ruleta').hidden = false;
  $('ruleta-nombre').textContent = '...';
  ruleta.lista = lista;
  prepararRuleta(lista);
  const paso = Math.PI * 2 / lista.length;
  const final = Math.PI - (indice * paso + paso / 2) + Math.PI * 2 * 5;
  return esperarFase('ruleta', { indice, final, dur: animacionesReducidas() ? 0.6 : 3.2, ultimoSector: -1 });
}

function actualizarRuleta(dt) {
  const d = MJ.datos;
  const k = Math.min(1, MJ.t / d.dur);
  const angulo = d.final * (1 - Math.pow(1 - k, 3));
  const paso = Math.PI * 2 / ruleta.lista.length;
  // Sector que está bajo la flecha (para el sonido y el nombre)
  const bajo = ((Math.floor((Math.PI - angulo) / paso) % ruleta.lista.length) + ruleta.lista.length) % ruleta.lista.length;
  if (bajo !== d.ultimoSector) { d.ultimoSector = bajo; sonar('mover'); $('ruleta-nombre').textContent = ruleta.lista[bajo].nombre; }
  if (hay3D()) {
    ruleta.giro.rotation.y = angulo;
    ruleta.r.render(ruleta.escena, ruleta.cam);
  }
  if (k >= 1 && !d.listo) {
    d.listo = true;
    $('ruleta-nombre').textContent = ruleta.lista[d.indice].nombre;
    sonar('listo');
  }
  if (k >= 1 && MJ.t > d.dur + 1.2) { $('mj-ruleta').hidden = true; terminarFase(); }
}

/* --- Instrucciones, cuenta, juego y resultados --- */
async function correrMinijuego(def) {
  MJ.def = def;
  MJ.jug.forEach((j) => { j.puntos = 0; j.vivo = true; });
  def.iniciar(MJ);
  // Instrucciones
  $('mj-titulo').textContent = def.nombre;
  $('mj-tipo').textContent = def.tipo === '3D' ? 'Minijuego 3D' : 'Minijuego 2D + 3D';
  $('mj-frase').textContent = def.frase;
  $('mj-como').textContent = def.controles;
  const lista = $('mj-controles');
  lista.textContent = '';
  MJ.jug.forEach((j) => {
    const li = document.createElement('li');
    const color = document.createElement('span');
    color.className = 'mj-color color-j' + (j.num + 1);
    color.textContent = 'J' + (j.num + 1);
    const texto = document.createElement('span');
    const conSensor = (def.inclinar || def.agitar) ? (def.inclinar ? 'inclinando ' : 'agitando ') : '';
    const teclas = esRemoto(j) ? 'Su celular' + (conSensor ? ' (' + conSensor.trim() + ')' : '') : estado.modo === 'bots' ? 'W A S D / flechas + Espacio / Enter' : TEXTO_TECLAS[j.num];
    texto.textContent = j.pj.nombre + ': ' + (j.humano ? teclas : 'Bot');
    texto.id = 'mj-listo-' + j.num;
    li.append(color, texto);
    lista.appendChild(li);
  });
  activarSensoresLocales(def);
  const local = MJ.sensorLocal !== null && MJ.sensorLocal !== undefined;
  $('mj-sensor').hidden = !(local && (def.inclinar || def.agitar));
  $('mj-sensor').textContent = def.inclinar
    ? 'Sostén el celular como te quede cómodo y pulsa ¡Empezar!: esa posición será el "centro". Desde ahí, inclínalo para moverte. Si te acomodas, toca Re-centrar.'
    : '¡Agita el celular para jugar! (también puedes tocar A muchas veces).';
  $('mj-intro').hidden = false;
  aviso(def.nombre + '. ' + def.frase);
  await esperarFase('intro', { listos: MJ.jug.map((j) => !j.humano) });
  $('mj-intro').hidden = true;
  if (def.inclinar) Inclinar.centrar(); // la posición actual es el centro
  const usaInclinar = mando.map((m) => m.usaInclinar);
  soltarTodo();
  mando.forEach((m, i) => { m.usaInclinar = usaInclinar[i]; });
  await esperarFase('cuenta');
  MJ.apuestaAbierta = false;
  await esperarFase('jugando');
  MJ.cartel = '¡FIN!';
  sonar('listo');
  await esperarFase('final');
  MJ.cartel = '';
  return def.ranking(MJ.jug);
}

function empezarYa() { if (MJ.fase === 'intro') terminarFase(); }

function mostrarResultados(ranking, p) {
  const lista = $('mj-lista-resultados');
  lista.textContent = '';
  let premios = ranking.length > 4 ? PREMIOS_8 : PREMIOS;
  if (MJ.modo === 'relampago') premios = [5, 0, 0, 0];
  if (MJ.modo === 'duelo') { const robado = Math.min(5, ranking[1].ref.monedas); premios = [robado, -robado]; }
  ranking.forEach((j, i) => {
    const li = document.createElement('li');
    li.className = 'mj-res lugar-' + (i + 1);
    const pos = document.createElement('b');
    pos.textContent = (i + 1) + '.º';
    const nombre = document.createElement('span');
    nombre.textContent = j.pj.nombre + ' (J' + (j.num + 1) + ')';
    const dato = document.createElement('span');
    dato.className = 'mj-dato';
    dato.textContent = MJ.def.hud(j);
    const premio = document.createElement('span');
    premio.className = 'mj-premio';
    premio.textContent = premios[i] > 0 ? '+' + premios[i] : String(premios[i] || 0);
    li.append(pos, crearSprite(j.pj.id, i === 0 ? 'victoria' : ''), nombre, dato, premio);
    lista.appendChild(li);
    if (premios[i]) cambiarMonedas(j.ref, premios[i]);
  });
  // Apuestas de los que miraban el duelo: +2 monedas si acertaron
  Object.entries(MJ.apuestas || {}).forEach(([num, quien]) => {
    if (quien === ranking[0].num && p) cambiarMonedas(p.jugadores[Number(num)], 2);
  });
  $('mj-ganador').textContent = '¡' + ranking[0].pj.nombre + (MJ.modo === 'duelo' ? ' gana el duelo!' : ' gana el minijuego!');
  $('mj-resultados').hidden = false;
  aviso('Gana ' + ranking[0].pj.nombre);
  return esperarFase('resultados').then(() => { $('mj-resultados').hidden = true; });
}

// Se llama en cada cuadro desde actualizarJuego (no corre en pausa)
function actualizarMJ(dt) {
  MJ.t += dt;
  const f = MJ.fase;
  if (f === 'ruleta') actualizarRuleta(dt);
  else if (f === 'intro') {
    MJ.jug.forEach((j, i) => {
      if (j.humano && pulso(j.num, 'accion') && !MJ.datos.listos[i]) {
        MJ.datos.listos[i] = true;
        sonar('elegir');
        $('mj-listo-' + j.num).textContent += '  ¡LISTO!';
      }
    });
    if (MJ.datos.listos.every(Boolean) || MJ.t > 12) terminarFase();
  } else if (f === 'cuenta') {
    const n = 3 - Math.floor(MJ.t);
    const texto = n > 0 ? String(n) : '¡YA!';
    if (texto !== MJ.cartel) { MJ.cartel = texto; sonar(n > 0 ? 'mover' : 'listo'); }
    if (MJ.t > 3.6) { MJ.cartel = ''; terminarFase(); }
  } else if (f === 'jugando') {
    MJ.def.actualizar(dt, MJ);
    if (MJ.def.fin) terminarFase();
  } else if (f === 'final') {
    MJ.def.actualizar(dt * 0.3, MJ); // cámara lenta al terminar
    if (MJ.t > 1.4) terminarFase();
  } else if (f === 'resultados') {
    if ((MJ.jug.some((j) => j.humano && pulso(j.num, 'accion')) && MJ.t > 1) || MJ.t > 9) terminarFase();
  }
  mando.forEach((m) => { m.pulsos.length = 0; });
  // Los botones táctiles solo se ven mientras se juega
  $('mj-tactil').classList.toggle('oculto', !['cuenta', 'jugando', 'final'].includes(MJ.fase));
}

function dibujarMJ() {
  const c = MJ.c;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#120a33';
  c.fillRect(0, 0, MJ.lienzo.width, MJ.lienzo.height);
  if (!MJ.def || MJ.fase === 'ruleta') return;
  const k = MJ.dpr * MJ.escala;
  c.setTransform(k, 0, 0, k, MJ.dpr * MJ.ox, MJ.dpr * MJ.oy);
  c.imageSmoothingEnabled = false;
  c.save();
  c.beginPath(); c.rect(0, 0, ARENA.w, ARENA.h); c.clip();
  MJ.def.dibujar(c, MJ);
  c.restore();
  dibujarHudMJ(c);
  if (MJ.cartel) texto(c, MJ.cartel, ARENA.w / 2, ARENA.h / 2, MJ.cartel.length > 3 ? 64 : 96, '#ffd23f');
}

function dibujarHudMJ(c) {
  const muchos = MJ.jug.length > 4;
  MJ.jug.forEach((j, i) => {
    const ancho = muchos ? 114 : 224;
    const x = muchos ? 4 + i * 119 : 12 + i * 236 + (4 - MJ.jug.length) * 118, y = 8;
    c.fillStyle = TINTA; c.fillRect(x, y, ancho, 44);
    c.fillStyle = '#fff6e0'; c.fillRect(x + 3, y + 3, ancho - 6, 38);
    c.fillStyle = COLORES_J[j.num]; c.fillRect(x + 3, y + 3, 38, 38);
    dibujarPj(c, j, x + 22, y + 22, 34, 0);
    if (!muchos) texto(c, j.pj.nombre, x + 48, y + 15, 9, TINTA, 'left', true);
    texto(c, MJ.def.hud(j), x + 46, y + (muchos ? 22 : 32), muchos ? 6 : 10, j.vivo ? '#138a43' : '#c22b3d', 'left', true);
  });
}

// Texto pixel con sombra
function texto(c, s, x, y, tam, color, alinear, sinSombra) {
  c.font = tam + 'px "Press Start 2P", "Courier New", monospace';
  c.textAlign = alinear || 'center';
  c.textBaseline = 'middle';
  if (!sinSombra) { c.fillStyle = TINTA; c.fillText(s, x + Math.max(2, tam / 10), y + Math.max(2, tam / 10)); }
  c.fillStyle = color;
  c.fillText(s, x, y);
}

// Personaje 2D: cuadro 0-1 quieto, 2-3 moverse, 4-5 victoria
function dibujarPj(c, j, x, y, tam, cuadro, voltear) {
  const img = IMAGENES[j.pj.id];
  if (!img || !img.complete) return;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  if (voltear) c.scale(-1, 1);
  c.drawImage(img, cuadro * 32, 0, 32, 32, -tam / 2, -tam / 2, tam, tam);
  c.restore();
}
const cuadroQuieto = (j) => Math.floor(MJ.t * 2 + j.num * 0.5) % 2;
const cuadroMover = () => 2 + (Math.floor(MJ.t * 8) % 2);
const cuadroVictoria = () => 4 + (Math.floor(MJ.t * 6) % 2);

// Capa 3D de los juegos 2D: escena con cámara ortográfica del tamaño de la arena
function capa3D(c, escena) {
  if (!MJ.r3d || !escena) return;
  MJ.r3d.render(escena, MJ.camOrto);
  c.drawImage(MJ.r3d.domElement, 0, 0, ARENA.w, ARENA.h);
}
const en3D = (obj, x, y) => obj.position.set(x, -y, 0);

function fondoEspacio(c, arriba, abajo) {
  const g = c.createLinearGradient(0, 0, 0, ARENA.h);
  g.addColorStop(0, arriba); g.addColorStop(1, abajo);
  c.fillStyle = g; c.fillRect(0, 0, ARENA.w, ARENA.h);
  c.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 60; i++) c.fillRect((i * 137) % ARENA.w, (i * 89 + 60) % ARENA.h, 3, 3);
}

const azarEn = (a, b) => a + Math.random() * (b - a);
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 4. MINIJUEGOS 2D CON OBJETOS 3D ---------- */

// 1. DUELO DE RAYOS: reflejos
const mjDuelo = {
  id: 'duelo', nombre: 'Duelo de rayos', corto: 'DUELO', tipo: '2D',
  frase: 'Espera la señal. Cuando el orbe se ponga rojo y diga ¡FUEGO!, dispara primero. Si disparas antes, quedas fuera.',
  controles: 'Botón de acción para disparar.',
  iniciar(mj) {
    this.fin = false; this.t = 0; this.disparo = false;
    this.senal = azarEn(2, 5);
    const n = mj.jug.length;
    const lugares = n <= 4 ? [[170, 170], [790, 170], [170, 420], [790, 420]]
      : enCirculo(n, 1, -Math.PI / 2 + Math.PI / n).map(([x, y]) => [480 + x * 360, 290 + y * 190]);
    mj.jug.forEach((j, i) => {
      j.x = lugares[i][0]; j.y = lugares[i][1]; j.tiempo = null; j.falso = false;
      j.botT = Math.random() < 0.08 ? azarEn(0.5, this.senal - 0.2) : this.senal + azarEn(0.22, 0.65);
    });
    this.escena = null;
    if (hay3D()) {
      this.escena = new THREE.Scene(); ponerLuces(this.escena);
      this.orbe = new THREE.Mesh(new THREE.IcosahedronGeometry(62, 1), mat(0x22d3ee, 0x115566));
      this.anillo = new THREE.Mesh(new THREE.TorusGeometry(96, 7, 6, 32), mat(0xffd23f, 0x332200));
      en3D(this.orbe, 480, 290); en3D(this.anillo, 480, 290);
      this.escena.add(this.orbe, this.anillo);
    }
  },
  actualizar(dt, mj) {
    this.t += dt;
    const listo = this.t >= this.senal;
    if (listo && !this.disparo) { this.disparo = true; sonar('listo'); }
    mj.jug.forEach((j) => {
      if (j.tiempo !== null || j.falso) return;
      const presiona = j.humano ? pulso(j.num, 'accion') : this.t >= j.botT;
      if (!presiona) return;
      if (!listo) { j.falso = true; j.vivo = false; sonar('error'); }
      else { j.tiempo = this.t - this.senal; sonar('elegir'); }
    });
    const pendientes = mj.jug.filter((j) => j.tiempo === null && !j.falso).length;
    if ((listo && (pendientes === 0 || this.t > this.senal + 2.5)) || (!listo && pendientes === 0)) this.fin = true;
  },
  valor: (j) => (j.tiempo !== null ? j.tiempo : j.falso ? 99 : 50),
  ranking(jug) { return [...jug].sort((a, b) => this.valor(a) - this.valor(b)); },
  hud: (j) => (j.falso ? '¡PRONTO!' : j.tiempo !== null ? j.tiempo.toFixed(2) + ' s' : '...'),
  dibujar(c, mj) {
    fondoEspacio(c, '#2a1a5e', '#4b3a8a');
    c.fillStyle = '#8d86b8'; c.fillRect(0, 330, ARENA.w, 210);
    c.fillStyle = '#6f6a9c';
    [[120, 400, 50], [520, 470, 70], [860, 380, 40], [330, 360, 30]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2); c.fill(); });
    // Rayos de los que ya dispararon
    mj.jug.forEach((j) => {
      if (j.tiempo === null) return;
      c.strokeStyle = COLORES_J[j.num]; c.lineWidth = 12;
      c.beginPath(); c.moveTo(j.x, j.y - 10); c.lineTo(480, 290); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.stroke();
    });
    const rojo = this.disparo;
    if (this.escena) {
      this.orbe.material.color.set(rojo ? 0xff3344 : 0x22d3ee);
      this.orbe.material.emissive.set(rojo ? 0x661111 : 0x115566);
      this.orbe.rotation.x = this.t * 0.8; this.orbe.rotation.y = this.t * 1.3;
      this.anillo.rotation.x = 1.1 + Math.sin(this.t) * 0.2; this.anillo.rotation.y = this.t * 0.6;
      const s = rojo ? 1.15 + Math.sin(this.t * 20) * 0.05 : 1;
      this.orbe.scale.setScalar(s);
      capa3D(c, this.escena);
    } else {
      c.fillStyle = rojo ? '#ff3344' : '#22d3ee';
      c.beginPath(); c.arc(480, 290, 62, 0, Math.PI * 2); c.fill();
    }
    mj.jug.forEach((j) => {
      const cuadro = j.tiempo !== null ? cuadroVictoria() : cuadroQuieto(j);
      c.globalAlpha = j.falso ? 0.4 : 1;
      dibujarPj(c, j, j.x, j.y, mj.jug.length > 4 ? 84 : 110, cuadro, j.x > 480);
      c.globalAlpha = 1;
      if (j.falso) texto(c, 'X', j.x, j.y, 60, '#ff4d5e');
    });
    if (!this.fin) texto(c, rojo ? '¡FUEGO!' : 'Espera...', 480, 140, rojo ? 48 : 24, rojo ? '#ff4d5e' : '#ffffff');
  }
};

// 2. LLUVIA DE METEORITOS: esquivar
const mjMeteoros = {
  id: 'meteoros', nombre: 'Lluvia de meteoritos', corto: 'METEOROS', tipo: '2D',
  frase: 'Caen rocas sobre la plataforma. Mira las sombras y muévete a los lados para esquivarlas. Gana el último que siga en pie.',
  controles: 'Izquierda y derecha para moverte.',
  SUELO: 440,
  iniciar(mj) {
    this.fin = false; this.t = 0; this.espera = 1; this.rocas = [];
    const n = mj.jug.length;
    mj.jug.forEach((j, i) => { j.x = n > 1 ? 130 + i * (700 / (n - 1)) : 480; j.vy = 0; j.y = this.SUELO - 40; j.tFuera = 0; j.mira = 1; j.botDir = 0; j.botPiensa = 0; });
    this.escena = null;
    if (hay3D()) { this.escena = new THREE.Scene(); ponerLuces(this.escena); }
  },
  crearRoca(mj) {
    const vivos = mj.jug.filter((j) => j.vivo);
    const x = Math.random() < 0.45 && vivos.length ? vivos[Math.floor(Math.random() * vivos.length)].x + azarEn(-30, 30) : azarEn(90, 870);
    const roca = { x: limitar(x, 90, 870), y: -60, vy: 230 + this.t * 11, r: azarEn(28, 46), giro: azarEn(-3, 3) };
    if (this.escena) { roca.malla = this.mallaPara('rocas', roca); this.escena.add(roca.malla); }
    this.rocas.push(roca);
  },
  // Mallas 3D (también las usa la pantalla a distancia para reconstruir lo que ve)
  mallaPara(lista, o) { return lista === 'rocas' ? new THREE.Mesh(new THREE.DodecahedronGeometry(o.r, 0), mat(0xb07a4a, 0x401a05)) : null; },
  firmaMalla(lista, o) { return lista === 'rocas' ? String(Math.round(o.r)) : null; },
  actualizar(dt, mj) {
    this.t += dt;
    this.espera -= dt;
    if (this.espera <= 0) { this.crearRoca(mj); this.espera = Math.max(0.22, 0.85 - this.t * 0.025); }
    mj.jug.forEach((j) => {
      if (!j.vivo) { j.vy += 900 * dt; j.y += j.vy * dt; return; }
      let dir;
      if (j.humano) dir = ejeX(j.num);
      else {
        j.botPiensa -= dt;
        if (j.botPiensa <= 0) {
          j.botPiensa = azarEn(0.12, 0.3);
          const peligro = this.rocas.find((r) => Math.abs(r.x - j.x) < r.r + 40 && (this.SUELO - r.y) / r.vy < 1.1);
          if (peligro && Math.random() > 0.12) j.botDir = j.x > peligro.x ? 1 : -1;
          else j.botDir = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
          if (j.x < 120) j.botDir = 1; if (j.x > 840) j.botDir = -1;
        }
        dir = j.botDir;
      }
      if (dir) j.mira = dir;
      j.moviendo = dir !== 0;
      j.x = limitar(j.x + dir * 300 * dt, 95, 865);
    });
    this.rocas.forEach((r) => {
      r.y += r.vy * dt;
      if (r.y >= this.SUELO - r.r * 0.4 && !r.cayo) {
        r.cayo = true;
        sonar('quitar');
        mj.jug.forEach((j) => {
          if (j.vivo && Math.abs(j.x - r.x) < r.r + 22) { j.vivo = false; j.tFuera = this.t; j.vy = -520; sonar('error'); }
        });
      }
    });
    this.rocas = this.rocas.filter((r) => {
      if (r.cayo && r.y > this.SUELO + 10) { if (r.malla) this.escena.remove(r.malla); return false; }
      return true;
    });
    const vivos = mj.jug.filter((j) => j.vivo).length;
    if (vivos <= 1 || this.t > 35) this.fin = true;
  },
  ranking(jug) { return [...jug].sort((a, b) => (b.vivo - a.vivo) || (b.tFuera - a.tFuera)); },
  hud: (j) => (j.vivo ? 'EN PIE' : 'FUERA'),
  dibujar(c, mj) {
    fondoEspacio(c, '#1d1150', '#4a2a7a');
    c.fillStyle = TINTA; c.fillRect(70, this.SUELO, 820, 40);
    c.fillStyle = '#a06bff'; c.fillRect(74, this.SUELO + 2, 812, 14);
    c.fillStyle = '#6b44c9'; c.fillRect(74, this.SUELO + 16, 812, 20);
    // Sombras que avisan dónde cae cada roca
    this.rocas.forEach((r) => {
      const k = limitar(1 - (this.SUELO - r.y) / this.SUELO, 0.1, 1);
      c.fillStyle = 'rgba(27,18,64,' + (0.25 + k * 0.45) + ')';
      c.beginPath(); c.ellipse(r.x, this.SUELO + 4, r.r * k * 1.3, 8 * k + 2, 0, 0, Math.PI * 2); c.fill();
    });
    mj.jug.forEach((j) => {
      if (j.y > ARENA.h + 80) return;
      dibujarPj(c, j, j.x, j.y, 80, j.vivo ? (j.moviendo ? cuadroMover() : cuadroQuieto(j)) : 0, j.mira < 0);
    });
    if (this.escena) {
      this.rocas.forEach((r) => { en3D(r.malla, r.x, r.y); r.malla.rotation.x += r.giro * 0.016; r.malla.rotation.y += r.giro * 0.02; });
      capa3D(c, this.escena);
    } else {
      this.rocas.forEach((r) => { c.fillStyle = '#b07a4a'; c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2); c.fill(); });
    }
  }
};

// 3. COSECHA DE POLVO ESTELAR: recoger
const mjPolvo = {
  id: 'polvo', nombre: 'Cosecha de polvo estelar', corto: 'POLVO', tipo: '2D',
  frase: 'Corre por la arena y recoge cristales. Los dorados valen 3. Gana quien junte más en 20 segundos.',
  controles: 'Muévete en las 4 direcciones.',
  DUR: 20,
  iniciar(mj) {
    this.fin = false; this.t = 0; this.cristales = []; this.textos = [];
    mj.jug.forEach((j, i) => { j.x = LUGARES_8[i][0]; j.y = LUGARES_8[i][1]; j.mira = i % 2 ? -1 : 1; j.botObj = null; j.botRuido = azarEn(0.7, 0.9); });
    this.escena = null;
    if (hay3D()) { this.escena = new THREE.Scene(); ponerLuces(this.escena); }
    for (let i = 0; i < 7; i++) this.crearCristal();
  },
  crearCristal() {
    const dorado = Math.random() < 0.15;
    const cr = { x: azarEn(90, 870), y: azarEn(130, 500), valor: dorado ? 3 : 1, fase: Math.random() * 6 };
    if (this.escena) { cr.malla = this.mallaPara('cristales', cr); this.escena.add(cr.malla); }
    this.cristales.push(cr);
  },
  mallaPara(lista, o) {
    if (lista !== 'cristales') return null;
    const dorado = o.valor > 1;
    return new THREE.Mesh(new THREE.OctahedronGeometry(dorado ? 24 : 16, 0), dorado ? mat(0xffd23f, 0x664400) : mat(0x7ef9ff, 0x115566));
  },
  firmaMalla(lista, o) { return lista === 'cristales' ? String(o.valor) : null; },
  actualizar(dt, mj) {
    this.t += dt;
    mj.jug.forEach((j) => {
      let dx, dy;
      if (j.humano) { dx = ejeX(j.num); dy = ejeY(j.num); }
      else {
        if (!j.botObj || !this.cristales.includes(j.botObj) || Math.random() < 0.01) {
          j.botObj = this.cristales.reduce((mejor, cr) => {
            const v = cr.valor / (Math.hypot(cr.x - j.x, cr.y - j.y) + 60);
            return !mejor || v > mejor.v ? { cr, v } : mejor;
          }, null)?.cr;
        }
        if (j.botObj) { dx = j.botObj.x - j.x; dy = j.botObj.y - j.y; } else { dx = dy = 0; }
      }
      const largo = Math.hypot(dx, dy) || 1;
      const vel = j.humano ? 270 : 270 * j.botRuido;
      j.moviendo = Math.abs(dx) + Math.abs(dy) > 0.5;
      if (j.moviendo) {
        j.x = limitar(j.x + dx / largo * vel * dt, 60, 900);
        j.y = limitar(j.y + dy / largo * vel * dt, 110, 510);
        if (Math.abs(dx) > 0.5) j.mira = Math.sign(dx);
      }
      this.cristales = this.cristales.filter((cr) => {
        if (Math.hypot(cr.x - j.x, cr.y - j.y) > 38) return true;
        j.puntos += cr.valor;
        sonar('elegir');
        this.textos.push({ x: cr.x, y: cr.y, s: '+' + cr.valor, t0: this.t, color: COLORES_J[j.num] });
        if (cr.malla) this.escena.remove(cr.malla);
        return false;
      });
    });
    while (this.cristales.length < 7) this.crearCristal();
    if (this.t >= this.DUR) this.fin = true;
  },
  ranking(jug) { return [...jug].sort((a, b) => b.puntos - a.puntos); },
  hud: (j) => j.puntos + ' cristales',
  dibujar(c, mj) {
    c.fillStyle = '#2b2f6b'; c.fillRect(0, 0, ARENA.w, ARENA.h);
    c.fillStyle = '#353a80';
    for (let x = 0; x < ARENA.w; x += 64) for (let y = 64; y < ARENA.h; y += 64) if ((x + y) / 64 % 2) c.fillRect(x, y, 64, 64);
    c.strokeStyle = TINTA; c.lineWidth = 8; c.strokeRect(50, 100, 860, 420);
    if (this.escena) {
      this.cristales.forEach((cr) => { en3D(cr.malla, cr.x, cr.y - 10 - Math.sin(this.t * 3 + cr.fase) * 6); cr.malla.rotation.y = this.t * 2 + cr.fase; cr.malla.rotation.x = 0.4; });
      capa3D(c, this.escena);
    } else {
      this.cristales.forEach((cr) => { c.fillStyle = cr.valor > 1 ? '#ffd23f' : '#7ef9ff'; c.fillRect(cr.x - 12, cr.y - 22, 24, 24); });
    }
    [...mj.jug].sort((a, b) => a.y - b.y).forEach((j) => dibujarPj(c, j, j.x, j.y - 20, 72, j.moviendo ? cuadroMover() : cuadroQuieto(j), j.mira < 0));
    this.textos = this.textos.filter((tx) => this.t - tx.t0 < 0.8);
    this.textos.forEach((tx) => texto(c, tx.s, tx.x, tx.y - 40 - (this.t - tx.t0) * 50, 18, tx.color));
    texto(c, Math.max(0, Math.ceil(this.DUR - this.t)) + ' s', 480, 80, 18, '#ffffff');
  }
};

// 4. RAYO TRACTOR: presionar rápido, 2 contra 2
const mjTractor = {
  id: 'tractor', nombre: 'Rayo tractor', corto: 'TRACTOR', tipo: '2D',
  frase: 'Dos equipos: la nave roja contra la azul (los nombres de cada equipo salen en pantalla). Presiona tu botón lo más rápido que puedas para jalar la vaca espacial hacia tu nave.',
  controles: 'Presiona el botón de acción muchas veces.',
  iniciar(mj) {
    this.fin = false; this.t = 0; this.pos = 0;
    mj.jug.forEach((j, i) => {
      const k = Math.floor(i / 2); // puesto dentro de su equipo
      j.equipo = i % 2; j.x = j.equipo ? 850 - k * 80 : 110 + k * 80; j.y = 470; j.salto = 0;
      j.ritmo = azarEn(5.2, 7.6); j.acum = Math.random();
    });
    this.escena = null;
    if (hay3D()) {
      this.escena = new THREE.Scene(); ponerLuces(this.escena);
      this.naves = [0xff4d5e, 0x3d8bff].map((color, e) => {
        const nave = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(44, 70, 18, 10), mat(0xb8b4d8, 0x222233));
        const cupula = new THREE.Mesh(new THREE.SphereGeometry(34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, 0x220000));
        cupula.position.y = 8;
        nave.add(base, cupula);
        for (let k = 0; k < 6; k++) {
          const luz = new THREE.Mesh(new THREE.SphereGeometry(6, 6, 4), mat(0xffd23f, 0x886600));
          luz.position.set(Math.cos(k / 6 * Math.PI * 2) * 58, -4, Math.sin(k / 6 * Math.PI * 2) * 58);
          nave.add(luz);
        }
        nave.rotation.x = 0.45;
        en3D(nave, e ? 790 : 170, 130);
        this.escena.add(nave);
        return nave;
      });
    }
  },
  actualizar(dt, mj) {
    this.t += dt;
    mj.jug.forEach((j) => {
      j.salto = Math.max(0, j.salto - dt);
      let veces = 0;
      if (j.humano) { while (pulso(j.num, 'accion')) veces++; }
      else { j.acum += dt * j.ritmo * azarEn(0.7, 1.3); while (j.acum >= 1) { j.acum--; veces++; } }
      if (!veces) return;
      j.puntos += veces;
      j.salto = 0.12;
      this.pos += (j.equipo ? 1 : -1) * 0.017 * veces;
      if (j.humano) sonar('mover');
    });
    if (Math.abs(this.pos) >= 1 || this.t > 15) { this.fin = true; if (this.pos === 0) this.pos = Math.random() < 0.5 ? -0.01 : 0.01; }
    this.pos = limitar(this.pos, -1, 1);
  },
  ranking(jug) {
    const gana = this.pos < 0 ? 0 : 1;
    return [...jug].sort((a, b) => ((b.equipo === gana) - (a.equipo === gana)) || (b.puntos - a.puntos));
  },
  hud: (j) => j.puntos + ' jalones',
  dibujar(c, mj) {
    fondoEspacio(c, '#160c3e', '#3b2d9e');
    c.fillStyle = '#3ddc7a'; c.fillRect(0, 500, ARENA.w, 40);
    c.fillStyle = '#2a9e57'; c.fillRect(0, 500, ARENA.w, 8);
    const vx = 480 + this.pos * 330, vy = 330 - Math.abs(this.pos) * 60;
    // Rayos de las dos naves hacia la vaca
    [[170, 'rgba(255,77,94,.35)'], [790, 'rgba(61,139,255,.35)']].forEach(([nx, col]) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(nx - 30, 150); c.lineTo(nx + 30, 150); c.lineTo(vx + 30, vy + 30); c.lineTo(vx - 30, vy + 30); c.closePath(); c.fill();
    });
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(478, 200, 4, 300);
    // Vaca espacial (pixel art 2D)
    const p = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(vx + x * 4, vy + y * 4, w * 4, h * 4); };
    p(-11, -7, 22, 13, TINTA); p(-10, -6, 20, 11, '#ffffff'); p(-6, -5, 5, 4, TINTA); p(3, -2, 5, 5, TINTA);
    p(9, -9, 8, 8, TINTA); p(10, -8, 6, 6, '#ffffff'); p(13, -4, 4, 3, '#ff9ad5'); p(12, -7, 1, 1, TINTA);
    p(10, -12, 1, 3, TINTA); p(14, -12, 1, 3, TINTA); p(9, -13, 3, 2, '#3ddc7a'); p(13, -13, 3, 2, '#3ddc7a');
    p(-9, 5, 3, 4, TINTA); p(6, 5, 3, 4, TINTA);
    if (this.escena) {
      this.naves.forEach((n, e) => { n.rotation.y = this.t * (e ? -2 : 2); en3D(n, e ? 790 : 170, 125 + Math.sin(this.t * 3 + e) * 6); });
      capa3D(c, this.escena);
    } else {
      ['#ff4d5e', '#3d8bff'].forEach((col, e) => { c.fillStyle = col; c.fillRect(e ? 730 : 110, 110, 120, 30); });
    }
    mj.jug.forEach((j) => dibujarPj(c, j, j.x, j.y - j.salto * 120, 80, j.salto > 0 ? 4 : cuadroQuieto(j), j.equipo === 1));
    [0, 1].forEach((e) => {
      const nombres = mj.jug.filter((j) => j.equipo === e).map((j) => 'J' + (j.num + 1)).join(' + ');
      texto(c, nombres, e ? 790 : 170, 220, nombres.length > 10 ? 10 : 14, e ? '#9ac3ff' : '#ff9aa5');
    });
  }
};

// 5. MEMORIA DE CONSTELACIONES
const mjMemoria = {
  id: 'memoria', nombre: 'Memoria de constelaciones', corto: 'MEMORIA', tipo: '2D',
  frase: 'Las estrellas se encienden en un orden. Cuando termine, repítelo con tus direcciones. Cada ronda es más larga. Si te equivocas, quedas fuera.',
  controles: 'Arriba, izquierda, derecha y abajo.',
  ESTRELLAS: { arriba: [480, 150, 0xffd23f, '#ffd23f'], izq: [300, 300, 0x22d3ee, '#22d3ee'], der: [660, 300, 0xff5fa2, '#ff5fa2'], abajo: [480, 450, 0x3ddc7a, '#3ddc7a'] },
  iniciar(mj) {
    this.fin = false; this.t = 0; this.sec = []; this.nivel = 0; this.encendida = null; this.toques = [];
    mj.jug.forEach((j) => { j.prog = 0; j.listo = false; j.nivelFuera = 0; });
    this.escena = null;
    if (hay3D()) {
      this.escena = new THREE.Scene(); ponerLuces(this.escena);
      this.esferas = {};
      Object.entries(this.ESTRELLAS).forEach(([dir, [x, y, color]]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(40, 14, 10), mat(color, 0x000000));
        en3D(m, x, y);
        this.esferas[dir] = m;
        this.escena.add(m);
      });
    }
    this.nuevaRonda();
  },
  nuevaRonda() {
    const dirs = Object.keys(this.ESTRELLAS);
    if (!this.sec.length) for (let i = 0; i < 2; i++) this.sec.push(dirs[Math.floor(Math.random() * 4)]);
    this.sec.push(dirs[Math.floor(Math.random() * 4)]);
    this.nivel = this.sec.length;
    this.fase = 'mostrar'; this.tf = -0.6;
    MJ.jug.forEach((j) => { j.prog = 0; j.listo = false; j.botProx = azarEn(0.5, 0.9); });
  },
  marcarFuera(j) { j.vivo = false; j.nivelFuera = this.nivel; sonar('error'); },
  actualizar(dt, mj) {
    this.t += dt; this.tf += dt;
    if (this.fase === 'mostrar') {
      mj.jug.forEach((j) => { if (j.humano) mando[j.num].pulsos.length = 0; });
      const i = Math.floor(this.tf / 0.7);
      const enciende = this.tf >= 0 && this.tf % 0.7 < 0.5 && i < this.sec.length;
      const nueva = enciende ? this.sec[i] : null;
      if (nueva && this.encendida !== nueva + i) sonar('mover');
      this.encendida = nueva ? nueva + i : null;
      this.luz = nueva;
      if (i >= this.sec.length) { this.fase = 'repetir'; this.tf = 0; this.luz = null; sonar('listo'); }
      return;
    }
    // Repetir
    const limite = 2 + this.nivel * 0.9;
    mj.jug.forEach((j) => {
      if (!j.vivo || j.listo) return;
      let dir = null;
      if (j.humano) dir = ['arriba', 'izq', 'der', 'abajo'].find((d) => pulso(j.num, d)) || null;
      else {
        j.botProx -= dt;
        if (j.botProx <= 0) {
          j.botProx = azarEn(0.3, 0.6);
          const acierta = Math.random() < 0.97 - this.nivel * 0.035;
          dir = acierta ? this.sec[j.prog] : Object.keys(this.ESTRELLAS).filter((d) => d !== this.sec[j.prog])[Math.floor(Math.random() * 3)];
        }
      }
      if (!dir) return;
      this.toques.push({ dir, t0: this.t, color: COLORES_J[j.num] });
      if (dir === this.sec[j.prog]) { j.prog++; if (j.humano) sonar('elegir'); if (j.prog >= this.sec.length) j.listo = true; }
      else this.marcarFuera(j);
    });
    const vivos = mj.jug.filter((j) => j.vivo);
    if (this.tf > limite || vivos.every((j) => j.listo)) {
      vivos.forEach((j) => { if (!j.listo) this.marcarFuera(j); });
      const siguen = mj.jug.filter((j) => j.vivo);
      if (siguen.length <= 1 || this.nivel >= 10) this.fin = true;
      else this.nuevaRonda();
    }
  },
  ranking(jug) { return [...jug].sort((a, b) => (b.vivo - a.vivo) || (b.nivelFuera - a.nivelFuera) || (b.prog - a.prog)); },
  hud: (j) => (j.vivo ? (j.listo ? '¡BIEN!' : j.prog + '/' + (mjMemoria.sec.length || 0)) : 'FUERA'),
  dibujar(c, mj) {
    fondoEspacio(c, '#0e0830', '#2d1c6e');
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 4;
    const e = this.ESTRELLAS;
    c.beginPath();
    [['arriba', 'izq'], ['izq', 'abajo'], ['abajo', 'der'], ['der', 'arriba']].forEach(([a, b]) => { c.moveTo(e[a][0], e[a][1]); c.lineTo(e[b][0], e[b][1]); });
    c.stroke();
    this.toques = this.toques.filter((tq) => this.t - tq.t0 < 0.3);
    if (this.escena) {
      Object.entries(this.esferas).forEach(([dir, m]) => {
        const on = this.luz === dir || this.toques.some((tq) => tq.dir === dir);
        m.material.emissive.set(on ? e[dir][2] : 0x000000);
        m.material.color.set(on ? 0xffffff : e[dir][2]);
        m.scale.setScalar(on ? 1.35 : 0.85);
        m.rotation.y = this.t;
      });
      capa3D(c, this.escena);
    } else {
      Object.entries(e).forEach(([dir, [x, y, , col]]) => { c.fillStyle = this.luz === dir ? '#ffffff' : col; c.beginPath(); c.arc(x, y, 40, 0, Math.PI * 2); c.fill(); });
    }
    texto(c, this.fase === 'mostrar' ? 'Mira con atención...' : '¡Repite! Nivel ' + this.nivel, 480, 80, 18, '#ffffff');
    const n = mj.jug.length, muchos = n > 4, paso = ARENA.w / n;
    mj.jug.forEach((j, i) => {
      const x = paso * (i + 0.5) + (muchos ? 0 : 20), y = 515;
      dibujarPj(c, j, x - (muchos ? 40 : 70), y - 10, muchos ? 36 : 48, j.vivo ? cuadroQuieto(j) : 0);
      const t = muchos ? 8 : 15, q = muchos ? 6 : 12;
      for (let k = 0; k < this.sec.length; k++) {
        c.fillStyle = TINTA; c.fillRect(x - (muchos ? 20 : 40) + k * t, y - q / 2, q, q);
        c.fillStyle = !j.vivo ? '#555' : k < j.prog ? COLORES_J[j.num] : '#fff6e0';
        c.fillRect(x - (muchos ? 19 : 38) + k * t, y - q / 2 + 1, q - 2, q - 2);
      }
    });
  }
};

/* ---------- 5. MINIJUEGOS 3D ---------- */
// Pieza común: jugador como sprite con sombra
function crearFicha3D(escena, j, tam) {
  const s = spritePersonaje(j.pj.id, tam);
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(tam * 0.32, 12), new THREE.MeshBasicMaterial({ color: 0x1b1240, transparent: true, opacity: 0.45 }));
  sombra.rotation.x = -Math.PI / 2;
  const aro = new THREE.Mesh(new THREE.RingGeometry(tam * 0.3, tam * 0.38, 16), new THREE.MeshBasicMaterial({ color: COLORES_J[j.num] }));
  aro.rotation.x = -Math.PI / 2;
  // Flecha de su color que se ve siempre, incluso a través de las piezas
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const x = c.getContext('2d');
  x.fillStyle = TINTA; x.fillRect(2, 1, 12, 5); x.fillRect(4, 6, 8, 4); x.fillRect(6, 10, 4, 4);
  x.fillStyle = '#' + new THREE.Color(COLORES_J[j.num]).getHexString();
  x.fillRect(3, 2, 10, 3); x.fillRect(5, 5, 6, 4); x.fillRect(7, 9, 2, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const flecha = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  flecha.scale.set(tam * 0.4, tam * 0.4, 1);
  flecha.renderOrder = 10;
  escena.add(s, sombra, aro, flecha);
  return { s, sombra, aro, flecha, tam };
}
function moverFicha(f, x, y, z, suelo, cuadro, voltear) {
  f.s.position.set(x, y + f.tam * 0.5, z);
  f.flecha.position.set(x, y + f.tam * 1.2 + Math.sin(MJ.t * 6) * 0.08, z);
  f.flecha.visible = suelo !== null;
  cuadroSprite(f.s, cuadro, voltear);
  const visible = suelo !== null;
  f.sombra.visible = f.aro.visible = visible;
  if (visible) { f.sombra.position.set(x, suelo + 0.02, z); f.aro.position.set(x, suelo + 0.03, z); }
}

function render3DCompleto(c, escena, cam) {
  if (!MJ.r3d) return;
  MJ.r3d.render(escena, cam);
  c.drawImage(MJ.r3d.domElement, 0, 0, ARENA.w, ARENA.h);
}

// 6. SUMO PLANETARIO
const mjSumo = {
  id: 'sumo', nombre: 'Sumo planetario', corto: 'SUMO', tipo: '3D',
  frase: 'Todos sobre un planeta que se encoge. Embiste con tu botón para sacar a los demás. Gana el último que quede arriba.',
  controles: 'Muévete en 4 direcciones. Acción = embestida.',
  iniciar(mj) {
    this.fin = false; this.t = 0; this.R = 6;
    this.escena = new THREE.Scene(); ponerLuces(this.escena); estrellasFondo(this.escena, 300, 60);
    this.cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
    this.plato = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.6, 40), mat(0x9df06c, 0x0a2a0a));
    this.plato.scale.set(this.R, 1, this.R);
    this.planeta = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat(0x5a8fd8, 0x0a1430));
    this.planeta.scale.set(this.R, this.R * 0.7, this.R); this.planeta.position.y = -this.R * 0.7 + 0.2;
    this.borde = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 48), mat(0xffffff, 0x444444));
    this.borde.rotation.x = Math.PI / 2; this.borde.position.y = 0.31;
    this.escena.add(this.planeta, this.plato, this.borde);
    const inicio = enCirculo(mj.jug.length, 3.4, Math.PI / 4);
    mj.jug.forEach((j, i) => {
      Object.assign(j, { x: inicio[i][0], z: inicio[i][1], y: 0.3, vx: 0, vz: 0, vy: 0, enfriar: 0, embiste: 0, dirX: 0, dirZ: 1, tFuera: 0, mira: 1 });
      j.ficha = crearFicha3D(this.escena, j, 1.4);
    });
  },
  actualizar(dt, mj) {
    this.t += dt;
    this.R = Math.max(3, 6 - this.t * 0.09);
    mj.jug.forEach((j) => {
      if (!j.vivo) { j.vy -= 20 * dt; j.y += j.vy * dt; j.x += j.vx * dt; j.z += j.vz * dt; return; }
      let ax, az, quiere;
      if (j.humano) { ax = ejeX(j.num); az = ejeY(j.num); quiere = pulso(j.num, 'accion'); }
      else {
        const rivales = mj.jug.filter((o) => o !== j && o.vivo);
        const obj = rivales.sort((a, b) => Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z))[0];
        ax = obj ? obj.x - j.x : 0; az = obj ? obj.z - j.z : 0;
        const d = Math.hypot(j.x, j.z);
        if (d > this.R - 1.2 && Math.random() < 0.8) { ax = -j.x; az = -j.z; } // a veces no se fija en el borde
        ax += azarEn(-0.6, 0.6); az += azarEn(-0.6, 0.6);
        quiere = obj && Math.hypot(obj.x - j.x, obj.z - j.z) < 2.4 && Math.random() < dt * 3; // embisten seguido
      }
      const l = Math.hypot(ax, az);
      if (l > 0.1) { j.dirX = ax / l; j.dirZ = az / l; j.vx += j.dirX * 16 * dt; j.vz += j.dirZ * 16 * dt; if (Math.abs(ax) > 0.1) j.mira = Math.sign(ax); }
      j.moviendo = l > 0.1;
      j.enfriar -= dt; j.embiste -= dt;
      if (quiere && j.enfriar <= 0) { j.vx += j.dirX * 9; j.vz += j.dirZ * 9; j.enfriar = 1.1; j.embiste = 0.3; sonar('clic'); }
      const roce = Math.pow(0.12, dt);
      j.vx *= roce; j.vz *= roce;
      const v = Math.hypot(j.vx, j.vz), max = j.embiste > 0 ? 14 : 5;
      if (v > max) { j.vx *= max / v; j.vz *= max / v; }
      j.x += j.vx * dt; j.z += j.vz * dt;
      if (Math.hypot(j.x, j.z) > this.R + 0.2) { j.vivo = false; j.tFuera = this.t; j.vy = 2; sonar('error'); }
    });
    // Choques entre jugadores
    for (let a = 0; a < mj.jug.length; a++) for (let b = a + 1; b < mj.jug.length; b++) {
      const A = mj.jug[a], B = mj.jug[b];
      if (!A.vivo || !B.vivo) continue;
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d > 1.1 || d === 0) continue;
      const nx = dx / d, nz = dz / d, solapa = (1.1 - d) / 2;
      A.x -= nx * solapa; A.z -= nz * solapa; B.x += nx * solapa; B.z += nz * solapa;
      const fuerzaA = A.embiste > 0 ? 11 : 3, fuerzaB = B.embiste > 0 ? 11 : 3;
      B.vx += nx * fuerzaA; B.vz += nz * fuerzaA; A.vx -= nx * fuerzaB; A.vz -= nz * fuerzaB;
      if (A.embiste > 0 || B.embiste > 0) sonar('quitar');
    }
    if (mj.jug.filter((j) => j.vivo).length <= 1 || this.t > 45) this.fin = true;
  },
  ranking(jug) { return [...jug].sort((a, b) => (b.vivo - a.vivo) || (b.tFuera - a.tFuera) || (Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))); },
  hud: (j) => (j.vivo ? 'ARRIBA' : 'FUERA'),
  dibujar(c, mj) {
    fondoEspacio(c, '#0b0626', '#22145a');
    this.plato.scale.set(this.R, 1, this.R);
    this.borde.scale.set(this.R, this.R, 1);
    this.planeta.rotation.y = this.t * 0.2;
    this.cam.position.set(Math.sin(this.t * 0.25) * 2.5, 10, 11);
    this.cam.lookAt(0, -0.5, 0.5);
    mj.jug.forEach((j) => {
      const cuadro = !j.vivo ? 0 : j.embiste > 0 ? 4 : j.moviendo ? cuadroMover() : cuadroQuieto(j);
      moverFicha(j.ficha, j.x, j.y, j.z, j.vivo ? 0.3 : null, cuadro, j.mira < 0);
      j.ficha.s.visible = j.y > -25;
    });
    render3DCompleto(c, this.escena, this.cam);
  }
};

// 7. HEXÁGONOS QUE CAEN
const mjHex = {
  id: 'hex', nombre: 'Hexágonos que caen', corto: 'HEXÁGONOS', tipo: '3D',
  frase: '3 pisos de hexágonos que se rompen después de pisarlos. Si caes, bajas al piso de abajo. Gana el último que siga en pie.',
  controles: 'Muévete en las 4 direcciones.',
  NIVELES: [0, -3.5, -7], COLORES: [0x22d3ee, 0xff5fa2, 0xffd23f],
  iniciar(mj) {
    this.fin = false; this.t = 0;
    this.escena = new THREE.Scene(); ponerLuces(this.escena); estrellasFondo(this.escena, 300, 70);
    this.cam = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 200);
    this.camY = 0;
    this.piezas = [];
    const geo = new THREE.CylinderGeometry(0.93, 0.93, 0.35, 6);
    this.NIVELES.forEach((y, n) => {
      for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) {
        if (Math.abs(q + r) > 3) continue;
        const x = 1.5 * q, z = Math.sqrt(3) * (r + q / 2);
        const m = new THREE.Mesh(geo, mat(this.COLORES[n], 0x0a0a1a));
        m.position.set(x, y, z);
        this.escena.add(m);
        this.piezas.push({ x, z, nivel: n, y, malla: m, estado: 0, t0: 0, vy: 0 });
      }
    });
    const inicio = enCirculo(mj.jug.length, 2.6, Math.PI / 4);
    mj.jug.forEach((j, i) => {
      Object.assign(j, { x: inicio[i][0], z: inicio[i][1], y: 0.175, vy: 0, tFuera: 0, mira: 1, botObj: null, botT: 0 });
      j.ficha = crearFicha3D(this.escena, j, 1.2);
    });
  },
  apoyo(j) {
    // La pieza intacta más alta que está debajo del jugador
    let mejor = null;
    this.piezas.forEach((p) => {
      if (p.estado === 2) return;
      const tope = p.y + 0.175;
      if (tope > j.y + 0.05) return;
      if (Math.hypot(p.x - j.x, p.z - j.z) > 0.85) return;
      if (!mejor || tope > mejor.y + 0.175) mejor = p;
    });
    return mejor;
  },
  actualizar(dt, mj) {
    this.t += dt;
    this.piezas.forEach((p) => {
      if (p.estado === 1 && this.t - p.t0 > 0.55) { p.estado = 2; p.vy = 0; }
      if (p.estado === 2 && p.malla.visible) { p.vy -= 25 * dt; p.malla.position.y += p.vy * dt; if (p.malla.position.y < p.y - 12) p.malla.visible = false; }
    });
    mj.jug.forEach((j) => {
      if (!j.vivo) return;
      let dx, dz;
      if (j.humano) { dx = ejeX(j.num); dz = ejeY(j.num); }
      else {
        j.botT -= dt;
        const nivelActual = this.NIVELES.findIndex((y) => Math.abs(y + 0.175 - j.y) < 0.1);
        if (!j.botObj || j.botObj.estado !== 0 || j.botT <= 0) {
          j.botT = azarEn(0.6, 1.2);
          const opciones = this.piezas.filter((p) => p.estado === 0 && p.nivel === nivelActual);
          j.botObj = opciones.length ? opciones[Math.floor(Math.random() * opciones.length)] : null;
        }
        dx = j.botObj ? j.botObj.x - j.x : 0; dz = j.botObj ? j.botObj.z - j.z : 0;
      }
      const l = Math.hypot(dx, dz);
      j.moviendo = l > 0.15;
      if (j.moviendo) { j.x += dx / l * 4.2 * dt; j.z += dz / l * 4.2 * dt; if (Math.abs(dx) > 0.1) j.mira = Math.sign(dx); }
      const pisar = (p) => {
        j.y = p.y + 0.175; j.vy = 0;
        if (p.estado === 0) { p.estado = 1; p.t0 = this.t; p.malla.material.color.set(0xffffff); }
      };
      const p = this.apoyo(j);
      if (p && j.y - (p.y + 0.175) <= 0.05) pisar(p);
      else {
        j.vy -= 20 * dt;
        const nuevaY = j.y + j.vy * dt;
        if (p && p.y + 0.175 >= nuevaY) pisar(p); // cae justo sobre una pieza de abajo
        else j.y = nuevaY;
        if (j.y < this.NIVELES[2] - 4) { j.vivo = false; j.tFuera = this.t; sonar('error'); }
      }
    });
    if (mj.jug.filter((j) => j.vivo).length <= 1 || this.t > 60) this.fin = true;
  },
  ranking(jug) { return [...jug].sort((a, b) => (b.vivo - a.vivo) || (b.tFuera - a.tFuera) || (b.y - a.y)); },
  hud(j) {
    if (!j.vivo) return 'FUERA';
    const n = mjHex.NIVELES.findIndex((y) => j.y >= y - 0.2);
    return 'PISO ' + (3 - Math.max(0, n));
  },
  dibujar(c, mj) {
    fondoEspacio(c, '#0b0626', '#2a1a6a');
    const vivos = mj.jug.filter((j) => j.vivo);
    const humanos = vivos.filter((j) => j.humano);
    const ref = humanos.length ? humanos : vivos;
    const foco = ref.length ? Math.min(...ref.map((j) => j.y)) : this.NIVELES[2];
    this.camY += (foco - this.camY) * 0.12;
    // Los pisos que quedan encima de alguien se vuelven casi transparentes
    const masBajo = vivos.length ? Math.min(...vivos.map((j) => j.y)) : this.NIVELES[2];
    this.piezas.forEach((p) => {
      const transparente = masBajo < p.y - 0.5;
      const m = p.malla.material;
      if (m.userData.transp !== transparente) {
        m.userData.transp = transparente;
        m.transparent = transparente; m.opacity = transparente ? 0.18 : 1; m.depthWrite = !transparente;
      }
    });
    this.cam.position.set(0, this.camY + 13, 12.5);
    this.cam.lookAt(0, this.camY - 1.5, 0.5);
    this.piezas.forEach((p) => { if (p.estado === 1) p.malla.material.color.set(Math.floor(this.t * 12) % 2 ? 0xffffff : this.COLORES[p.nivel]); });
    mj.jug.forEach((j) => {
      const p = j.vivo ? this.apoyo(j) : null;
      moverFicha(j.ficha, j.x, j.y, j.z, p ? p.y + 0.175 : null, j.moviendo ? cuadroMover() : cuadroQuieto(j), j.mira < 0);
      j.ficha.s.visible = j.vivo || j.y > this.NIVELES[2] - 10;
    });
    render3DCompleto(c, this.escena, this.cam);
  }
};

// 8. TÚNEL DE ASTEROIDES
const mjTunel = {
  id: 'tunel', nombre: 'Túnel de asteroides', corto: 'TÚNEL', tipo: '3D', inclinar: true,
  frase: 'Pilotas tu nave por un túnel. Pasa por los anillos de luz para sumar puntos y esquiva los asteroides. Gana quien tenga más puntos en 30 segundos.',
  controles: 'Inclina el celular como un timón (adelante baja, atrás sube) o usa la cruceta.',
  DUR: 30,
  iniciar(mj) {
    this.fin = false; this.t = 0; this.objetos = []; this.espera = 0.5;
    this.escena = new THREE.Scene(); ponerLuces(this.escena); estrellasFondo(this.escena, 300, 80);
    this.cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 200);
    this.cam.position.set(0, 0.8, 6.5);
    this.cam.lookAt(0, 0, -10);
    this.aros = [];
    for (let i = 0; i < 12; i++) {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.06, 4, 24), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x22d3ee : 0xff5fa2 }));
      aro.position.z = -i * 6;
      this.escena.add(aro);
      this.aros.push(aro);
    }
    const inicio = enCirculo(mj.jug.length, 1.4, Math.PI / 4);
    mj.jug.forEach((j, i) => {
      Object.assign(j, { x: inicio[i][0], y: inicio[i][1], aturdido: 0 });
      j.nave = new THREE.Group();
      const cuerpo = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 6), mat(COLORES_J[j.num], 0x220000));
      cuerpo.rotation.x = -Math.PI / 2;
      const alas = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.35), mat(0xdedcf0));
      alas.position.z = 0.2;
      j.nave.add(cuerpo, alas);
      j.piloto = spritePersonaje(j.pj.id, 0.6);
      j.piloto.position.set(0, 0.35, 0.1);
      j.nave.add(j.piloto);
      this.escena.add(j.nave);
    });
  },
  crearObjeto() {
    const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * 2.6;
    const anillo = Math.random() < 0.45;
    const o = { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, z: -70, anillo, r: anillo ? 0.75 : azarEn(0.5, 0.9), cruzo: false };
    // Cada bot ve este objeto a su manera: apunta con error, a veces lo ignora o no lo esquiva
    o.bot = Array.from({ length: 8 }, () => ({ ex: azarEn(-0.8, 0.8), ey: azarEn(-0.8, 0.8), ignora: Math.random() < 0.25, esquiva: Math.random() < 0.6 }));
    o.malla = this.mallaPara('objetos', o);
    o.malla.position.set(o.x, o.y, o.z);
    this.escena.add(o.malla);
    this.objetos.push(o);
  },
  mallaPara(lista, o) {
    if (lista !== 'objetos') return null;
    return o.anillo
      ? new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 6, 20), mat(0xffd23f, 0x887700))
      : new THREE.Mesh(new THREE.DodecahedronGeometry(o.r, 0), mat(0xa07050, 0x2a1005));
  },
  firmaMalla(lista, o) { return lista === 'objetos' ? (o.anillo ? 'a' : 'r' + Math.round(o.r * 10)) : null; },
  actualizar(dt, mj) {
    this.t += dt;
    const vel = 20 + this.t * 0.5;
    this.espera -= dt;
    if (this.espera <= 0) { this.crearObjeto(); this.espera = Math.max(0.18, 0.45 - this.t * 0.008); }
    mj.jug.forEach((j) => {
      j.aturdido -= dt;
      let dx, dy;
      if (j.humano) {
        // Celular: inclinarlo como timón (adelante = baja). Cruceta: arriba sube.
        dx = limitar(inclinaX(j.num) * 1.3, -1, 1);
        dy = mando[j.num].usaInclinar ? limitar(-mando[j.num].inclY * 1.3, -1, 1) : -ejeY(j.num);
      } else {
        // Bots imperfectos: solo ven lo que está cerca, apuntan con error y a veces se distraen
        j.distraido = (j.distraido || 0) - dt;
        if (j.distraido <= 0 && Math.random() < dt * 0.25) j.distraido = azarEn(0.5, 1.1);
        const anillo = this.objetos.filter((o) => o.anillo && o.z < -2 && o.z > -14 && !o.bot[j.num].ignora).sort((a, b) => b.z - a.z)[0];
        dx = anillo ? anillo.x + anillo.bot[j.num].ex - j.x : -j.x * 0.3;
        dy = anillo ? anillo.y + anillo.bot[j.num].ey - j.y : -j.y * 0.3;
        const roca = this.objetos.find((o) => !o.anillo && o.z > -5 && o.z < 0 && o.bot[j.num].esquiva && Math.hypot(o.x - j.x, o.y - j.y) < o.r + 0.7);
        if (roca) { dx = j.x - roca.x; dy = j.y - roca.y; }
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        const vel = j.distraido > 0 ? 0.1 : 0.7;
        dx *= vel; dy *= vel;
      }
      j.x += dx * 4.5 * dt; j.y += dy * 4.5 * dt;
      const d = Math.hypot(j.x, j.y);
      if (d > 2.9) { j.x *= 2.9 / d; j.y *= 2.9 / d; }
    });
    this.objetos.forEach((o) => {
      o.z += vel * dt;
      if (!o.cruzo && o.z >= 0) {
        o.cruzo = true;
        mj.jug.forEach((j) => {
          if (j.aturdido > 0) return;
          const d = Math.hypot(o.x - j.x, o.y - j.y);
          if (o.anillo && d < 0.75) { j.puntos++; if (j.humano) sonar('elegir'); }
          if (!o.anillo && d < o.r + 0.4) { j.puntos = Math.max(0, j.puntos - 1); j.aturdido = 1; sonar('error'); }
        });
      }
    });
    this.objetos = this.objetos.filter((o) => { if (o.z > 8) { this.escena.remove(o.malla); return false; } return true; });
    this.aros.forEach((a) => { a.position.z += vel * dt; if (a.position.z > 6) a.position.z -= 72; });
    if (this.t >= this.DUR) this.fin = true;
  },
  ranking(jug) { return [...jug].sort((a, b) => b.puntos - a.puntos); },
  hud: (j) => j.puntos + ' anillos',
  dibujar(c, mj) {
    c.fillStyle = '#05021a'; c.fillRect(0, 0, ARENA.w, ARENA.h);
    this.objetos.forEach((o) => { o.malla.position.set(o.x, o.y, o.z); if (!o.anillo) { o.malla.rotation.x += 0.03; o.malla.rotation.y += 0.02; } else o.malla.rotation.z += 0.05; });
    mj.jug.forEach((j) => {
      j.nave.position.set(j.x, j.y, 0);
      j.nave.rotation.z = Math.sin(this.t * 3 + j.num) * 0.15;
      j.nave.visible = !(j.aturdido > 0 && Math.floor(this.t * 12) % 2);
      cuadroSprite(j.piloto, cuadroQuieto(j));
    });
    render3DCompleto(c, this.escena, this.cam);
    texto(c, Math.max(0, Math.ceil(this.DUR - this.t)) + ' s', 480, 80, 18, '#ffffff');
  }
};

/* ---------- 4B. MINIJUEGOS NUEVOS (9 a 12) ---------- */

// 9. CARRERA DE COHETES (2D + cohetes 3D): agitar el celular
const mjCohetes = {
  id: 'cohetes', nombre: 'Carrera de cohetes', corto: 'COHETES', tipo: '2D', agitar: true,
  frase: '¡Agita el celular para acelerar tu cohete! Gana el primero que llegue a la luna. En PC, presiona tu botón de acción muy rápido.',
  controles: 'Agita el celular o presiona Acción muchas veces.',
  META: 120, SUELO: 470,
  iniciar(mj) {
    this.fin = false; this.t = 0;
    const n = mj.jug.length;
    mj.jug.forEach((j, i) => {
      Object.assign(j, { x: 480 + (i - (n - 1) / 2) * Math.min(200, 860 / n), h: 0, v: 0, llego: null, ritmo: azarEn(5.2, 7.4), acum: Math.random(), pausa: 0, fuego: 0 });
    });
    this.escena = null;
    if (hay3D()) {
      this.escena = new THREE.Scene(); ponerLuces(this.escena);
      mj.jug.forEach((j) => {
        const g = new THREE.Group();
        const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 64, 10), mat(0xf2f0ff, 0x222233));
        const punta = new THREE.Mesh(new THREE.ConeGeometry(18, 34, 10), mat(COLORES_J[j.num], 0x220000));
        punta.position.y = 49;
        g.add(cuerpo, punta);
        [-1, 1].forEach((lado) => {
          const aleta = new THREE.Mesh(new THREE.BoxGeometry(14, 26, 8), mat(COLORES_J[j.num], 0x220000));
          aleta.position.set(lado * 22, -24, 0);
          g.add(aleta);
        });
        j.cohete = g;
        this.escena.add(g);
      });
    }
  },
  actualizar(dt, mj) {
    this.t += dt;
    mj.jug.forEach((j) => {
      if (j.llego !== null) return;
      let imp = 0;
      if (j.humano) { while (pulso(j.num, 'accion')) imp++; imp += tomarEmpuje(j.num); }
      else {
        j.pausa -= dt;
        if (j.pausa <= 0 && Math.random() < dt * 0.35) j.pausa = azarEn(0.3, 0.9); // se cansa un momento
        if (j.pausa <= 0) { j.acum += dt * j.ritmo * azarEn(0.7, 1.3); while (j.acum >= 1) { j.acum--; imp++; } }
      }
      j.v += imp * 0.022;
      j.v -= j.v * 1.2 * dt;
      j.h += j.v * dt;
      j.fuego = Math.min(1, j.v * 6);
      if (j.h >= 1) { j.h = 1; j.llego = this.t; sonar('listo'); }
    });
    const llegadas = mj.jug.filter((j) => j.llego !== null).map((j) => j.llego);
    if (mj.jug.every((j) => j.llego !== null) || (llegadas.length && this.t > Math.min(...llegadas) + 2.5) || this.t > 30) this.fin = true;
  },
  ranking(jug) { return [...jug].sort((a, b) => ((a.llego === null) - (b.llego === null)) || ((a.llego || 0) - (b.llego || 0)) || (b.h - a.h)); },
  hud: (j) => (j.llego !== null ? '¡LLEGÓ!' : Math.round(j.h * 100) + '%'),
  dibujar(c, mj) {
    fondoEspacio(c, '#0b0626', '#3b6fd8');
    // Luna arriba
    c.fillStyle = TINTA; c.beginPath(); c.arc(480, 40, 118, 0, Math.PI); c.fill();
    c.fillStyle = '#e6e1ff'; c.beginPath(); c.arc(480, 40, 112, 0, Math.PI); c.fill();
    c.fillStyle = '#c9c2ea';
    [[420, 80, 14], [530, 95, 10], [470, 120, 8]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = '#3ddc7a'; c.fillRect(0, 500, ARENA.w, 40);
    mj.jug.forEach((j) => {
      const y = this.SUELO - j.h * (this.SUELO - this.META);
      j.yPantalla = y;
      if (j.fuego > 0.05) { // fuego que parpadea
        const largo = 20 + j.fuego * 50 * (0.7 + Math.random() * 0.3);
        c.fillStyle = '#ff7a2f'; c.fillRect(j.x - 12, y + 40, 24, largo);
        c.fillStyle = '#ffd23f'; c.fillRect(j.x - 6, y + 40, 12, largo * 0.6);
      }
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(j.x, this.META); c.lineTo(j.x, this.SUELO + 40); c.stroke();
    });
    if (this.escena) {
      mj.jug.forEach((j) => { en3D(j.cohete, j.x, j.yPantalla); j.cohete.rotation.y = this.t * 2 + j.num; j.cohete.rotation.z = Math.sin(this.t * 9 + j.num) * j.fuego * 0.08; });
      capa3D(c, this.escena);
    } else {
      mj.jug.forEach((j) => { c.fillStyle = '#f2f0ff'; c.fillRect(j.x - 18, j.yPantalla - 32, 36, 64); });
    }
    mj.jug.forEach((j) => dibujarPj(c, j, j.x, j.yPantalla - 2, 34, j.llego !== null ? cuadroVictoria() : 0));
  }
};

// 10. EQUILIBRIO EN EL METEORITO (3D): inclinar
const mjEquilibrio = {
  id: 'equilibrio', nombre: 'Equilibrio en el meteorito', corto: 'EQUILIBRIO', tipo: '3D', inclinar: true,
  frase: 'Están sobre un meteorito que se balancea cada vez más. Muévete hacia el lado que sube para no resbalar. Gana el último que quede arriba.',
  controles: 'Inclina el celular (o usa la cruceta) para moverte.',
  R: 3.9,
  iniciar(mj) {
    this.fin = false; this.t = 0; this.tx = 0; this.tz = 0;
    this.escena = new THREE.Scene(); ponerLuces(this.escena); estrellasFondo(this.escena, 300, 60);
    this.cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
    this.cam.position.set(0, 9, 10.5);
    this.cam.lookAt(0, -0.3, 0.6);
    this.roca = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(this.R, this.R * 0.75, 0.8, 9), mat(0x9a6640, 0x200a00));
    const cima = new THREE.Mesh(new THREE.CylinderGeometry(this.R * 0.98, this.R, 0.05, 9), mat(0xc98b55, 0x1a0800));
    cima.position.y = 0.42;
    this.roca.add(cuerpo, cima);
    [[1.6, 1.2], [-2, -0.6], [0.4, -2.2]].forEach(([x, z]) => {
      const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.06, 8), mat(0x8a5a34));
      crater.position.set(x, 0.45, z);
      this.roca.add(crater);
    });
    this.escena.add(this.roca);
    const n = mj.jug.length;
    mj.jug.forEach((j, i) => {
      const a = i / n * Math.PI * 2 + 0.6;
      Object.assign(j, { x: Math.cos(a) * 1.6, z: Math.sin(a) * 1.6, y: 0.45, vx: 0, vz: 0, vy: 0, tFuera: 0, mira: 1, botT: 0, botX: 0, botZ: 0 });
      j.ficha = crearFicha3D(this.escena, j, 1.3);
    });
  },
  alturaEn(x, z) { return 0.45 + x * Math.sin(this.tz) - z * Math.sin(this.tx); },
  actualizar(dt, mj) {
    this.t += dt;
    const vivos = mj.jug.filter((j) => j.vivo);
    const mx = vivos.reduce((s, j) => s + j.x, 0) / (vivos.length || 1);
    const mz = vivos.reduce((s, j) => s + j.z, 0) / (vivos.length || 1);
    const fuerza = 0.16 + this.t * 0.012;
    // El peso de los jugadores y un balanceo que crece con el tiempo inclinan la roca
    const objZ = limitar(-mx * 0.08 + Math.sin(this.t * 1.1) * fuerza, -0.5, 0.5);
    const objX = limitar(mz * 0.08 + Math.sin(this.t * 0.8 + 1) * fuerza, -0.5, 0.5);
    this.tz += (objZ - this.tz) * Math.min(1, dt * 2);
    this.tx += (objX - this.tx) * Math.min(1, dt * 2);
    mj.jug.forEach((j) => {
      if (!j.vivo) { j.vy -= 20 * dt; j.y += j.vy * dt; j.x += j.vx * dt; j.z += j.vz * dt; return; }
      let ax, az;
      if (j.humano) { ax = inclinaX(j.num); az = -inclinaY(j.num); }
      else {
        j.botT -= dt;
        if (j.botT <= 0) { // decide cada rato, con algo de torpeza
          j.botT = azarEn(0.3, 0.65);
          const torpe = Math.random() < 0.18 ? -1 : 1; // a veces se equivoca de lado
          j.botX = (-j.x * 0.3 + this.tz * 2.4) * torpe + azarEn(-0.6, 0.6);
          j.botZ = (-j.z * 0.3 - this.tx * 2.4) * torpe + azarEn(-0.6, 0.6);
        }
        ax = limitar(j.botX, -1, 1); az = limitar(j.botZ, -1, 1);
      }
      if (Math.abs(ax) > 0.1) j.mira = Math.sign(ax);
      j.moviendo = Math.abs(ax) + Math.abs(az) > 0.15;
      j.vx += (ax * 10 - this.tz * 24) * dt;
      j.vz += (az * 10 + this.tx * 24) * dt;
      const roce = Math.pow(0.25, dt);
      j.vx *= roce; j.vz *= roce;
      j.x += j.vx * dt; j.z += j.vz * dt;
      j.y = this.alturaEn(j.x, j.z);
      if (Math.hypot(j.x, j.z) > this.R + 0.1) { j.vivo = false; j.tFuera = this.t; j.vy = 1; sonar('error'); }
    });
    for (let a = 0; a < mj.jug.length; a++) for (let b = a + 1; b < mj.jug.length; b++) {
      const A = mj.jug[a], B = mj.jug[b];
      if (!A.vivo || !B.vivo) continue;
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d > 1 || d === 0) continue;
      const nx = dx / d, nz = dz / d, solapa = (1 - d) / 2;
      A.x -= nx * solapa; A.z -= nz * solapa; B.x += nx * solapa; B.z += nz * solapa;
      B.vx += nx * 2.5; B.vz += nz * 2.5; A.vx -= nx * 2.5; A.vz -= nz * 2.5;
    }
    if (vivos.length <= (mj.jug.length > 1 ? 1 : 0) || this.t > 40) this.fin = true;
  },
  ranking(jug) { return [...jug].sort((a, b) => (b.vivo - a.vivo) || (b.tFuera - a.tFuera)); },
  hud: (j) => (j.vivo ? 'ARRIBA' : 'FUERA'),
  dibujar(c, mj) {
    fondoEspacio(c, '#0b0626', '#2a1a6a');
    this.roca.rotation.set(this.tx, 0, this.tz);
    mj.jug.forEach((j) => {
      const cuadro = !j.vivo ? 0 : j.moviendo ? cuadroMover() : cuadroQuieto(j);
      moverFicha(j.ficha, j.x, j.y, j.z, j.vivo ? j.y : null, cuadro, j.mira < 0);
      j.ficha.s.visible = j.y > -25;
    });
    render3DCompleto(c, this.escena, this.cam);
  }
};

// 11. PINTA EL PLANETA (2D)
const mjPintar = {
  id: 'pintar', nombre: 'Pinta el planeta', corto: 'PINTAR', tipo: '2D',
  frase: 'Corre y deja un rastro de tu color. Puedes pintar encima del color de los demás. Gana quien tenga más pintado en 20 segundos.',
  controles: 'Muévete en las 4 direcciones.',
  DUR: 20, COL: 24, FIL: 11, TAM: 36, X0: 48, Y0: 110,
  iniciar(mj) {
    this.fin = false; this.t = 0;
    this.celdas = new Array(this.COL * this.FIL).fill(-1);
    mj.jug.forEach((j, i) => { Object.assign(j, { x: LUGARES_8[i][0], y: LUGARES_8[i][1], mira: i % 2 ? -1 : 1, botObj: null, botT: 0 }); });
  },
  celdaDe(x, y) {
    const c = Math.floor((x - this.X0) / this.TAM), f = Math.floor((y - this.Y0) / this.TAM);
    return c >= 0 && c < this.COL && f >= 0 && f < this.FIL ? f * this.COL + c : -1;
  },
  actualizar(dt, mj) {
    this.t += dt;
    mj.jug.forEach((j) => {
      let dx, dy;
      if (j.humano) { dx = ejeX(j.num); dy = ejeY(j.num); }
      else {
        j.botT -= dt;
        if (j.botT <= 0 || !j.botObj) { // busca una zona cercana que no sea suya
          j.botT = azarEn(0.6, 1.1);
          let mejor = null;
          for (let k = 0; k < 12; k++) {
            const x = limitar(j.x + azarEn(-220, 220), this.X0 + 10, this.X0 + this.COL * this.TAM - 10);
            const y = limitar(j.y + azarEn(-160, 160), this.Y0 + 10, this.Y0 + this.FIL * this.TAM - 10);
            const i = this.celdaDe(x, y);
            if (i >= 0 && this.celdas[i] !== j.num) { mejor = { x, y }; break; }
          }
          j.botObj = mejor || { x: azarEn(100, 860), y: azarEn(130, 480) };
        }
        dx = j.botObj.x - j.x; dy = j.botObj.y - j.y;
        if (Math.hypot(dx, dy) < 10) j.botT = 0;
      }
      const largo = Math.hypot(dx, dy) || 1;
      j.moviendo = largo > 0.5;
      if (j.moviendo) {
        const vel = j.humano ? 250 : 215;
        j.x = limitar(j.x + dx / largo * vel * dt, this.X0 + 8, this.X0 + this.COL * this.TAM - 8);
        j.y = limitar(j.y + dy / largo * vel * dt, this.Y0 + 8, this.Y0 + this.FIL * this.TAM - 8);
        if (Math.abs(dx) > 0.5) j.mira = Math.sign(dx);
      }
      const i = this.celdaDe(j.x, j.y);
      if (i >= 0) this.celdas[i] = j.num;
    });
    mj.jug.forEach((j) => { j.puntos = this.celdas.filter((c) => c === j.num).length; });
    if (this.t >= this.DUR) this.fin = true;
  },
  ranking(jug) { return [...jug].sort((a, b) => b.puntos - a.puntos); },
  hud: (j) => j.puntos + ' pintadas',
  dibujar(c, mj) {
    c.fillStyle = '#3b2d9e'; c.fillRect(0, 0, ARENA.w, ARENA.h);
    c.fillStyle = TINTA; c.fillRect(this.X0 - 8, this.Y0 - 8, this.COL * this.TAM + 16, this.FIL * this.TAM + 16);
    for (let f = 0; f < this.FIL; f++) for (let k = 0; k < this.COL; k++) {
      const v = this.celdas[f * this.COL + k];
      c.fillStyle = v < 0 ? ((f + k) % 2 ? '#8d86b8' : '#9b95c4') : COLORES_J[v];
      c.fillRect(this.X0 + k * this.TAM, this.Y0 + f * this.TAM, this.TAM - 2, this.TAM - 2);
    }
    [...mj.jug].sort((a, b) => a.y - b.y).forEach((j) => dibujarPj(c, j, j.x, j.y - 18, 64, j.moviendo ? cuadroMover() : cuadroQuieto(j), j.mira < 0));
    texto(c, Math.max(0, Math.ceil(this.DUR - this.t)) + ' s', 480, 80, 18, '#ffffff');
  }
};

// 12. CUENTA LOS ALIENS (2D + naves 3D)
const mjAliens = {
  id: 'aliens', nombre: 'Cuenta los aliens', corto: 'ALIENS', tipo: '2D',
  frase: 'Pasarán naves de colores muy rápido. Fíjate bien: al final te preguntarán cuántas naves de un color pasaron. Gana quien se acerque más.',
  controles: 'Mira con atención. Luego arriba/abajo cambia tu número y Acción lo confirma.',
  COLORES: [[0xff5fa2, '#ff5fa2', 'ROSADAS'], [0x3ddc7a, '#3ddc7a', 'VERDES'], [0x22d3ee, '#22d3ee', 'AZULES']],
  iniciar(mj) {
    this.fin = false; this.t = 0; this.fase = 'pasan'; this.tf = 0; this.naves = [];
    this.objetivo = Math.floor(Math.random() * 3);
    this.plan = [];
    for (let t = 0.3; t < 6.5; t += azarEn(0.14, 0.42)) {
      this.plan.push({ t, c: Math.floor(Math.random() * 3), y: azarEn(140, 440), vel: azarEn(420, 760) * (Math.random() < 0.5 ? 1 : -1) });
    }
    this.cuantas = [0, 0, 0];
    this.plan.forEach((n) => { this.cuantas[n.c]++; });
    const real = this.cuantas[this.objetivo];
    mj.jug.forEach((j) => Object.assign(j, { resp: 0, bloq: false, tResp: 99, botResp: Math.max(0, real + Math.round(azarEn(-2.4, 2.4))), botT: azarEn(1.5, 5) }));
    this.escena = null;
    if (hay3D()) { this.escena = new THREE.Scene(); ponerLuces(this.escena); }
  },
  crearNave(n) {
    const nave = { x: n.vel > 0 ? -60 : ARENA.w + 60, y: n.y, vel: n.vel, c: n.c };
    if (this.escena) { nave.malla = this.mallaPara('naves', nave); this.escena.add(nave.malla); }
    this.naves.push(nave);
  },
  mallaPara(lista, o) {
    if (lista !== 'naves' || o.c === undefined) return null;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(24, 36, 10, 10), mat(0xb8b4d8, 0x222233)));
    const cupula = new THREE.Mesh(new THREE.SphereGeometry(18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(this.COLORES[o.c][0], 0x221122));
    cupula.position.y = 4;
    g.add(cupula);
    g.rotation.x = 0.5;
    return g;
  },
  firmaMalla(lista, o) { return lista === 'naves' ? String(o.c) : null; },
  actualizar(dt, mj) {
    this.t += dt;
    if (this.fase === 'pasan') {
      mj.jug.forEach((j) => { mando[j.num].pulsos.length = 0; });
      while (this.plan.length && this.plan[0].t <= this.t) { this.crearNave(this.plan.shift()); sonar('mover'); }
      this.naves.forEach((n) => { n.x += n.vel * dt; });
      this.naves = this.naves.filter((n) => {
        const fuera = n.x < -80 || n.x > ARENA.w + 80;
        if (fuera && n.malla) this.escena.remove(n.malla);
        return !fuera;
      });
      if (!this.plan.length && !this.naves.length) { this.fase = 'responder'; this.tf = 0; sonar('listo'); }
      return;
    }
    this.tf += dt;
    if (this.fase === 'responder') {
      mj.jug.forEach((j) => {
        if (j.bloq) return;
        if (j.humano) {
          if (pulso(j.num, 'arriba') || pulso(j.num, 'der')) { j.resp = Math.min(40, j.resp + 1); sonar('mover'); }
          if (pulso(j.num, 'abajo') || pulso(j.num, 'izq')) { j.resp = Math.max(0, j.resp - 1); sonar('mover'); }
          if (pulso(j.num, 'accion')) { j.bloq = true; j.tResp = this.tf; sonar('elegir'); }
        } else if (this.tf >= j.botT) { j.resp = j.botResp; j.bloq = true; j.tResp = this.tf; }
      });
      if (mj.jug.every((j) => j.bloq) || this.tf > 10) {
        mj.jug.forEach((j) => { if (!j.bloq) { j.bloq = true; j.tResp = 99; } });
        this.fase = 'revelar'; this.tf = 0; sonar('listo');
      }
    } else if (this.tf > 2.4) this.fin = true;
  },
  ranking(jug) {
    const real = this.cuantas[this.objetivo];
    return [...jug].sort((a, b) => (Math.abs(a.resp - real) - Math.abs(b.resp - real)) || (a.tResp - b.tResp));
  },
  hud(j) {
    const f = mjAliens.fase;
    if (f === 'pasan') return 'Mirando...';
    if (f === 'responder') return j.bloq ? '¡Listo!' : 'Pensando...';
    return 'Dijo ' + j.resp;
  },
  // Lo que ve cada jugador en su celular
  ayudaMando(j) {
    if (mjAliens.fase === 'pasan') return '¡Cuenta las naves ' + mjAliens.COLORES[mjAliens.objetivo][2].toLowerCase() + '!';
    if (mjAliens.fase === 'responder') return j.bloq ? 'Respuesta enviada: ' + j.resp : 'Tu número: ' + j.resp + '. Arriba/abajo para cambiar, A para confirmar.';
    return 'Eran ' + mjAliens.cuantas[mjAliens.objetivo] + '. Tú dijiste ' + j.resp + '.';
  },
  dibujar(c, mj) {
    fondoEspacio(c, '#120838', '#3b2d9e');
    const [, col, nombre] = this.COLORES[this.objetivo];
    if (this.fase === 'pasan') {
      texto(c, '¡Fíjate bien!', 480, 90, 22, '#ffffff');
      if (this.escena) {
        this.naves.forEach((n) => { en3D(n.malla, n.x, n.y); n.malla.rotation.y += 0.1; });
        capa3D(c, this.escena);
      } else {
        this.naves.forEach((n) => { c.fillStyle = this.COLORES[n.c][1]; c.fillRect(n.x - 30, n.y - 10, 60, 20); });
      }
      return;
    }
    texto(c, '¿Cuántas naves', 480, 120, 24, '#ffffff');
    texto(c, nombre + ' pasaron?', 480, 165, 30, col);
    if (this.fase === 'revelar') texto(c, String(this.cuantas[this.objetivo]), 480, 250, 64, '#ffd23f');
    const n = mj.jug.length;
    mj.jug.forEach((j, i) => {
      const paso = Math.min(210, 900 / n), caja = Math.min(92, paso - 14);
      const x = 480 + (i - (n - 1) / 2) * paso, y = 420;
      dibujarPj(c, j, x, y - 50, n > 4 ? 56 : 72, j.bloq ? cuadroQuieto(j) : cuadroMover());
      c.fillStyle = TINTA; c.fillRect(x - caja / 2, y, caja, 56);
      c.fillStyle = '#fff6e0'; c.fillRect(x - caja / 2 + 4, y + 4, caja - 8, 48);
      // En el celular cada uno ve su número; en la pantalla grande se tapa hasta el final
      const oculto = this.fase === 'responder' && (j.bloq || esRemoto(j));
      texto(c, this.fase === 'revelar' || !oculto ? String(j.resp) : (j.bloq ? 'OK' : '?'), x, y + 29, 22, TINTA, 'center', true);
    });
  }
};

const MINIJUEGOS = [mjDuelo, mjMeteoros, mjPolvo, mjTractor, mjMemoria, mjSumo, mjHex, mjTunel, mjCohetes, mjEquilibrio, mjPintar, mjAliens];

/* --- Controles táctiles (celular) para J1 --- */
function conectarTactil() {
  document.querySelectorAll('#mj-tactil [data-boton]').forEach((b) => {
    const boton = b.dataset.boton;
    const soltar = () => apretar(0, boton, false);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); apretar(0, boton, true); });
    b.addEventListener('pointerup', soltar);
    b.addEventListener('pointercancel', soltar);
    b.addEventListener('pointerleave', soltar);
  });
  $('btn-mj-empezar').addEventListener('click', empezarYa);
  $('mj-recentrar').addEventListener('click', () => { Inclinar.centrar(); sonar('clic'); aviso('Centro guardado'); });
  $('btn-mj-continuar').addEventListener('click', () => { if (MJ.fase === 'resultados') terminarFase(); });
}
conectarTactil();

/* ---------- 6. OBJETOS 3D DEL TABLERO ---------- */
// Estrella fugaz 3D (se dibuja dentro del canvas del tablero)
const estrella3D = { r: null, escena: null, cam: null, malla: null };
function dibujarEstrella3D(c, x, y, tam, t) {
  if (!hay3D()) return false;
  if (!estrella3D.r) {
    estrella3D.r = crearRender3D(96, 96);
    estrella3D.escena = new THREE.Scene(); ponerLuces(estrella3D.escena);
    estrella3D.cam = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    estrella3D.cam.position.set(0, 0, 4.2);
    const forma = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1;
      if (i) forma.lineTo(Math.cos(a) * r, -Math.sin(a) * r); else forma.moveTo(Math.cos(a) * r, -Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.35, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
    geo.center();
    estrella3D.malla = new THREE.Group();
    estrella3D.malla.add(new THREE.Mesh(geo, mat(0xffe14a, 0x665000)));
    [-0.2, 0.2].forEach((ox) => {
      const ojo = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), mat(0x1b1240));
      ojo.position.set(ox, 0.05, 0.3);
      estrella3D.malla.add(ojo);
    });
    estrella3D.escena.add(estrella3D.malla);
  }
  estrella3D.malla.rotation.y = Math.sin(t * 1.6) * 0.9;
  estrella3D.malla.rotation.z = Math.sin(t * 0.9) * 0.15;
  estrella3D.r.render(estrella3D.escena, estrella3D.cam);
  c.imageSmoothingEnabled = false;
  c.drawImage(estrella3D.r.domElement, x - tam / 2, y - tam / 2, tam, tam);
  return true;
}

// Tragamonedas 3D del casino: 3 rodillos cuadrados que giran
const traga = { r: null, escena: null, cam: null, rodillos: [], texturas: {} };
const SIMBOLOS = [['7', '#ff5fa2'], ['$', '#3ddc7a'], ['+6', '#ffd23f'], ['-4', '#ff4d5e']];
function materialSimbolo(s) {
  if (!traga.texturas[s]) {
    const col = (SIMBOLOS.find((x) => x[0] === s) || [s, '#ffffff'])[1];
    traga.texturas[s] = new THREE.MeshLambertMaterial({ map: texturaTexto(s, '#fff6e0', col, 64, 64, s.length > 1 ? 20 : 30) });
  }
  return traga.texturas[s];
}
function prepararTraga() {
  if (!hay3D()) return false;
  if (!traga.r) {
    traga.r = crearRender3D(192, 96, $('carta-3d'));
    traga.escena = new THREE.Scene(); ponerLuces(traga.escena);
    traga.cam = new THREE.PerspectiveCamera(30, 2, 0.1, 20);
    traga.cam.position.set(0, 0, 4.6);
    traga.rodillos = [-1.15, 0, 1.15].map((x) => {
      const caja = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), SIMBOLOS.map((s) => materialSimbolo(s[0])).concat([materialSimbolo('7'), materialSimbolo('$')]));
      caja.position.x = x;
      traga.escena.add(caja);
      return caja;
    });
  }
  return true;
}
// gana = true/false; devuelve una promesa que termina cuando paran los 3 rodillos
async function girarTraga(gana) {
  if (!prepararTraga()) return false;
  const final = gana ? '+6' : '-4';
  $('carta-3d').hidden = false;
  traga.rodillos.forEach((r) => { r.material[4] = materialSimbolo('7'); });
  traga.frente = ['7', '7', '7'];
  const dur = [1.0, 1.4, 1.8];
  let t = 0;
  const inicio = juego.reloj;
  while (t < dur[2] + 0.1) {
    await esperarSeg(0.016);
    t = juego.reloj - inicio;
    traga.rodillos.forEach((r, i) => {
      if (t < dur[i]) { r.rotation.x = t * 14; if (Math.floor(t * 10) % 3 === 0) sonar('mover'); }
      else { r.rotation.x = 0; r.material[4] = materialSimbolo(final); traga.frente[i] = final; }
    });
    traga.r.render(traga.escena, traga.cam);
  }
  sonar(gana ? 'listo' : 'error');
  return true;
}

// Copa 3D del podio
const copa = { r: null, escena: null, cam: null, malla: null };
function dibujarCopa(t) {
  if (!hay3D() || $('capa-podio').hidden) return;
  if (!copa.r) {
    copa.r = crearRender3D(120, 120, $('copa-3d'));
    copa.escena = new THREE.Scene(); ponerLuces(copa.escena);
    copa.cam = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    copa.cam.position.set(0, 0.6, 5);
    copa.cam.lookAt(0, 0.2, 0);
    const perfil = [[0, -1], [0.55, -1], [0.55, -0.85], [0.15, -0.75], [0.12, -0.2], [0.3, -0.05], [0.65, 0.35], [0.75, 1], [0.68, 1], [0.58, 0.4], [0, 0.25]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const oro = mat(0xffd23f, 0x553300);
    copa.malla = new THREE.Group();
    copa.malla.add(new THREE.Mesh(new THREE.LatheGeometry(perfil, 16), oro));
    [-1, 1].forEach((lado) => {
      const asa = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 12, Math.PI), oro);
      asa.position.set(lado * 0.72, 0.55, 0);
      asa.rotation.z = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
      copa.malla.add(asa);
    });
    copa.escena.add(copa.malla);
  }
  copa.malla.rotation.y = t * 1.5;
  copa.r.render(copa.escena, copa.cam);
}
