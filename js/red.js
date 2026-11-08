/* =========================================================
   NEBULA PARTY - red.js  (modo Multijugador con celulares)
   La PC crea una sala con PeerJS (conexión directa entre navegadores)
   y muestra un QR. Cada celular abre control.html y se vuelve un mando.
   1. Sala y QR   2. Conexiones   3. Qué muestra cada celular
   4. Lo que llega de los celulares
   ========================================================= */
'use strict';

const PREFIJO_SALA = 'nebulaparty-';
const RED = {
  peer: null, codigo: null,
  mandos: Array(8).fill(null),    // conexión de cada jugador (J1 a J8)
  perdido: Array(8).fill(false),  // se desconectó en plena partida
  vistas: Array(8).fill(''), version: Array(8).fill(0), acciones: Array.from({ length: 8 }, () => []),
  intervalo: null
};

// ¿Este jugador juega desde su celular?
function esRemoto(j) { return estado.modo === 'online' && !!RED.mandos[j.num]; }

// Para pruebas con un servidor PeerJS propio: ?peerhost=localhost&peerport=9000
function opcionesPeer() {
  const q = new URLSearchParams(location.search);
  const host = q.get('peerhost');
  return host ? { host, port: Number(q.get('peerport') || 9000), path: '/', secure: false } : {};
}

/* ---------- 1. SALA Y QR ---------- */
function abrirSala() {
  sonar('clic');
  estado.modo = 'online';
  cambiarPantalla('sala');
  dibujarSala();
  if (!window.Peer) {
    mensajeSala('No se pudo cargar la conexión. Revisa tu internet y vuelve a intentarlo.', true);
    return;
  }
  if (RED.peer && !RED.peer.destroyed) { mostrarQR(); return; } // la sala sigue abierta
  crearPeer(0);
  if (!RED.intervalo) RED.intervalo = setInterval(actualizarMandos, 150);
}

function crearPeer(intento) {
  RED.codigo = codigoAzar();
  mensajeSala('Creando la sala...');
  const peer = new Peer(PREFIJO_SALA + RED.codigo, opcionesPeer());
  RED.peer = peer;
  peer.on('open', () => { mostrarQR(); mensajeSala('Apunta la cámara del celular al código y entra solo a la sala. Los puestos vacíos los juega un bot.'); });
  peer.on('connection', conexionNueva);
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* nada */ } });
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id' && intento < 3) { peer.destroy(); crearPeer(intento + 1); return; }
    if (err.type === 'peer-unavailable') return; // un celular se fue; no afecta la sala
    mensajeSala('No se pudo crear la sala (' + err.type + '). Este modo necesita internet y funciona desde GitHub Pages; en la vista previa de Claude no se puede conectar.', true);
  });
}

function cerrarSala() {
  RED.mandos.forEach((c) => { if (c) try { c.close(); } catch (e) { /* nada */ } });
  RED.mandos = Array(8).fill(null);
  RED.perdido = Array(8).fill(false);
  if (RED.peer) RED.peer.destroy();
  RED.peer = null;
}

function codigoAzar() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 4; i++) s += letras[Math.floor(Math.random() * letras.length)];
  return s;
}

function urlControl() {
  const u = new URL('control.html', location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('sala', RED.codigo);
  const q = new URLSearchParams(location.search);
  ['peerhost', 'peerport'].forEach((k) => { if (q.get(k)) u.searchParams.set(k, q.get(k)); });
  return u.href;
}

function mostrarQR() {
  $('sala-codigo').textContent = RED.codigo;
  $('sala-invitacion').textContent = urlInvitacion();
  $('sala-url').textContent = urlControl();
  const lienzo = $('sala-qr');
  const c = lienzo.getContext('2d');
  if (!window.qrcode) { lienzo.hidden = true; return; }
  const qr = qrcode(0, 'M');
  qr.addData(urlControl());
  qr.make();
  const n = qr.getModuleCount(), borde = 3, t = Math.max(3, Math.floor(260 / (n + borde * 2)));
  lienzo.width = lienzo.height = (n + borde * 2) * t;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, lienzo.width, lienzo.height);
  c.fillStyle = TINTA;
  for (let f = 0; f < n; f++) for (let k = 0; k < n; k++) if (qr.isDark(f, k)) c.fillRect((k + borde) * t, (f + borde) * t, t, t);
  lienzo.hidden = false;
}

function mensajeSala(texto, error) {
  $('sala-estado').textContent = texto;
  $('sala-estado').classList.toggle('error', !!error);
}

function dibujarSala() {
  const lista = $('sala-lista');
  lista.textContent = '';
  RED.mandos.forEach((m, i) => {
    const li = document.createElement('li');
    li.className = 'sala-puesto' + (m ? ' conectado' : '');
    const color = document.createElement('span');
    color.className = 'mj-color color-j' + (i + 1);
    color.textContent = 'J' + (i + 1);
    const texto = document.createElement('span');
    texto.textContent = m ? '¡Conectado!' : 'Esperando...';
    li.append(color, texto);
    lista.appendChild(li);
  });
  const n = RED.mandos.filter(Boolean).length;
  $('btn-sala-empezar').disabled = n === 0;
  $('btn-sala-empezar').textContent = n ? 'Elegir personajes (' + n + ' celular' + (n > 1 ? 'es' : '') + ')' : 'Elegir personajes';
}

// Los celulares conectados quedan como J1, J2... en orden (los demás puestos son bots)
function empezarOnline() {
  RED.votos = {};
  const conectados = RED.mandos.filter(Boolean);
  if (!conectados.length) return;
  RED.mandos = Array.from({ length: 8 }, (_, i) => conectados[i] || null);
  RED.mandos.forEach((c, i) => { if (c) { c.num = i; RED.vistas[i] = ''; c.send({ tipo: 'hola', num: i, color: COLORES_J[i] }); } });
  RED.perdido = Array(8).fill(false);
  sonar('clic');
  estado.humanos = conectados.length;
  if (estado.humanos > 4) estado.total = 8;
  prepararSeleccion();
  cambiarPantalla('personajes');
}

/* ---------- 2. CONEXIONES ---------- */
function conexionNueva(conn) {
  if (conn.metadata && conn.metadata.espejo) { espejoNuevo(conn); return; }
  conn.on('open', () => {
    let puesto = -1;
    if (estado.pantalla === 'sala') puesto = RED.mandos.findIndex((m) => !m);
    else puesto = RED.perdido.findIndex((p, i) => p && !RED.mandos[i]); // volver a un puesto perdido
    if (puesto < 0) {
      conn.send({ tipo: 'lleno', texto: estado.pantalla === 'sala' ? 'La sala está llena (8 jugadores).' : 'La partida ya empezó.' });
      setTimeout(() => conn.close(), 600);
      return;
    }
    RED.mandos[puesto] = conn;
    conn.num = puesto;
    RED.vistas[puesto] = '';
    conn.send({ tipo: 'hola', num: puesto, color: COLORES_J[puesto] });
    if (RED.perdido[puesto]) { // vuelve a jugar como humano
      RED.perdido[puesto] = false;
      estado.jugadores[puesto].humano = true;
      if (estado.partida) estado.partida.jugadores[puesto].humano = true;
    }
    sonar('elegir');
    aviso('Se conectó el jugador ' + (puesto + 1));
    if (estado.pantalla === 'sala') dibujarSala();
  });
  conn.on('data', (d) => datoDeMando(conn, d));
  conn.on('close', () => mandoPerdido(conn));
  conn.on('error', () => mandoPerdido(conn));
}

function mandoPerdido(conn) {
  const num = conn.num;
  if (num === undefined || RED.mandos[num] !== conn) return;
  RED.mandos[num] = null;
  if (estado.pantalla === 'sala') { dibujarSala(); return; }
  // En plena partida: un bot toma su lugar hasta que vuelva a conectarse
  RED.perdido[num] = true;
  const j = estado.jugadores[num];
  if (j) j.humano = false;
  if (estado.partida) {
    const pj = estado.partida.jugadores[num];
    pj.humano = false;
    if (jugadorActual() === pj && ponerMensaje.botones && ponerMensaje.botones.length) setTimeout(() => {
      const b = ponerMensaje.botones;
      if (b && b.length && jugadorActual() === pj && !pj.humano) b[0].accion();
    }, 800);
    if (juego.reto && juego.reto.j === pj) { juego.reto.botPresiona = juego.reto.t; juego.reto.botAcierta = Math.random() < 0.4; }
  }
  if (estado.pantalla === 'personajes') { dibujarSeleccion(); turnoDeBots(); }
  aviso('El jugador ' + (num + 1) + ' se desconectó: juega un bot por ahora.');
  sonar('error');
}

/* ---------- 3. QUÉ MUESTRA CADA CELULAR ---------- */
// El líder es el celular conectado con el número más bajo (normalmente J1): maneja la sala y la partida
const esLider = (num) => RED.mandos.findIndex(Boolean) === num;
const RONDAS_OPC = [6, 10, 15, 20];

// Votación del mapa: cada celular elige un mundo o "Al azar"
RED.votos = {};
function votarMundo(num, opcion) {
  if (estado.pantalla !== 'mundos') return;
  RED.votos[num] = opcion;
  sonar('elegir');
  dibujarVotos();
  const humanos = estado.jugadores.filter((j) => j.humano && RED.mandos[j.num]);
  if (humanos.every((j) => RED.votos[j.num] !== undefined)) resolverVotos();
}
function dibujarVotos() {
  document.querySelectorAll('.tarjeta-mundo').forEach((t, i) => {
    let caja = t.querySelector('.votos');
    if (!caja) { caja = document.createElement('span'); caja.className = 'votos'; t.appendChild(caja); }
    caja.textContent = '';
    Object.entries(RED.votos).forEach(([num, op]) => {
      if (op !== i) return;
      const v = document.createElement('i');
      v.className = 'voto color-j' + (Number(num) + 1);
      v.textContent = 'J' + (Number(num) + 1);
      caja.appendChild(v);
    });
  });
  const azar = Object.entries(RED.votos).filter(([, op]) => op === 'azar').map(([n]) => 'J' + (Number(n) + 1));
  $('btn-azar').textContent = azar.length ? 'Al azar (' + azar.join(' ') + ')' : 'Al azar';
}
function resolverVotos() {
  const votos = Object.values(RED.votos);
  RED.votos = {};
  const conMundo = votos.filter((v) => v !== 'azar');
  if (!conMundo.length) { // todos al azar: sorteo y empieza de una
    mundoAlAzar();
    setTimeout(() => { if (estado.pantalla === 'mundos') iniciarPartida(); }, animacionesReducidas() ? 500 : 2600);
    return;
  }
  const cuenta = {};
  conMundo.forEach((v) => { cuenta[v] = (cuenta[v] || 0) + 1; });
  const max = Math.max(...Object.values(cuenta));
  const empatados = Object.keys(cuenta).filter((k) => cuenta[k] === max).map(Number);
  const ganador = empatados[Math.floor(Math.random() * empatados.length)];
  seleccionarMundo(ganador, true);
  aviso('Ganó la votación: ' + MUNDOS[ganador].nombre);
  setTimeout(() => { if (estado.pantalla === 'mundos') iniciarPartida(); }, 1500);
}

function vistaDe(num) {
  const j = estado.jugadores[num];
  const pj = j && j.elegido !== null && j.elegido !== undefined ? PERSONAJES[j.elegido] : null;
  const base = { pj: pj ? pj.id : null, nombre: pj ? pj.nombre : null };
  const espera = (texto, sub) => Object.assign({ vista: 'espera', texto, sub }, base);
  const p = estado.partida;
  if (estado.pantalla === 'sala') {
    if (esLider(num)) {
      const n = RED.mandos.filter(Boolean).length;
      return Object.assign({
        vista: 'botones', texto: 'Eres el líder', sub: 'Cuando estén todos, toca Empezar. Hay ' + n + ' celular' + (n > 1 ? 'es' : '') + ' conectado' + (n > 1 ? 's' : '') + '.',
        botones: [{ texto: '¡Empezar!' }, { texto: 'Jugadores: ' + estado.total }, { texto: 'Rondas: ' + estado.rondas }],
        acciones: [empezarOnline,
          () => { estado.total = estado.total === 8 && n <= 4 ? 4 : 8; sonar('clic'); }, // con más de 4 celulares siempre son 8
          () => { const i = RONDAS_OPC.indexOf(estado.rondas); elegirRondas(RONDAS_OPC[(i + 1) % RONDAS_OPC.length]); estado.rondasElegidas = true; }]
      }, base);
    }
    return espera('¡Conectado!', 'Eres el jugador ' + (num + 1) + '. El líder (J' + (RED.mandos.findIndex(Boolean) + 1) + ') empieza la partida desde su celular.');
  }
  if (estado.pantalla === 'personajes') {
    if (!j || j.elegido === null) return Object.assign({ vista: 'mando', texto: 'Elige tu personaje', sub: 'Cruceta para moverte y A para elegir.' }, base);
    return Object.assign({ vista: 'botones', texto: '¡Listo!', sub: 'Esperando a los demás...', botones: [{ texto: 'Cambiar personaje' }], acciones: [() => quitar(num)] }, base);
  }
  if (estado.pantalla === 'mundos') {
    if (RED.votos[num] === undefined) {
      return Object.assign({ vista: 'botones', texto: 'Vota el mundo', sub: 'Gana el más votado. Si todos eligen Al azar, ¡empieza de una!',
        botones: MUNDOS.map((m) => ({ texto: m.nombre })).concat([{ texto: 'Al azar' }]),
        acciones: MUNDOS.map((m, i) => () => votarMundo(num, i)).concat([() => votarMundo(num, 'azar')]) }, base);
    }
    const v = RED.votos[num];
    return espera('¡Votaste!', (v === 'azar' ? 'Al azar' : MUNDOS[v].nombre) + '. Esperando a los demás...');
  }
  if (estado.pantalla !== 'juego' || !p) return espera('Nebula Party', 'El anfitrión está en el menú.');
  if (!$('capa-podio').hidden) {
    if (esLider(num)) return Object.assign({ vista: 'botones', texto: $('podio-titulo').textContent, sub: '¿Qué hacemos?',
      botones: [{ texto: 'Jugar otra vez' }, { texto: 'Volver a la sala' }],
      acciones: [() => { cerrarVentana('capa-podio'); iniciarPartida(); }, () => { cerrarVentana('capa-podio'); abrirSala(); }] }, base);
    return espera($('podio-titulo').textContent, 'Fin de la partida. El líder elige qué sigue.');
  }
  if (pausado()) {
    if (esLider(num)) return Object.assign({ vista: 'botones', texto: 'Pausa', sub: 'El juego está en pausa.',
      botones: [{ texto: 'Continuar' }, { texto: 'Volver a la sala' }],
      acciones: [cerrarPausa, () => { cerrarVentana('capa-pausa'); cerrarMinijuego(); abrirSala(); }] }, base);
    return espera('Pausa', 'El líder puede continuar desde su celular.');
  }
  if (MJ.activo) {
    const juega = MJ.jug.find((x) => x.num === num);
    if (!juega) { // no juega este minijuego (duelo): puede apostar
      if (MJ.modo === 'duelo' && MJ.apuestaAbierta && MJ.apuestas[num] === undefined) {
        return Object.assign({ vista: 'botones', texto: '¿Quién gana el duelo?', sub: 'Si aciertas, ganas 2 monedas.',
          botones: MJ.jug.map((x) => ({ texto: x.pj.nombre })),
          acciones: MJ.jug.map((x) => () => { MJ.apuestas[num] = x.num; sonar('elegir'); }) }, base);
      }
      const ap = MJ.apuestas[num];
      const porQuien = ap !== undefined ? MJ.jug.find((x) => x.num === ap) : null;
      return espera(MJ.modo === 'duelo' ? 'Mirando el duelo' : 'Mirando el minijuego', porQuien ? 'Apostaste por ' + porQuien.pj.nombre + '.' : 'Mira la pantalla grande.');
    }
    if (MJ.fase === 'ruleta' || !MJ.def) return espera('¡Minijuego!', 'Girando la ruleta...');
    const i = MJ.jug.indexOf(juega);
    const listo = MJ.fase === 'intro' && MJ.datos && MJ.datos.listos && MJ.datos.listos[i];
    let sub = MJ.fase === 'intro' ? (listo ? '¡Listo! Sigue practicando mientras los demás terminan.' : 'Practica los controles y toca LISTO cuando quieras empezar.')
      : MJ.fase === 'resultados' ? 'Toca A para continuar.' : MJ.def.controles;
    if (MJ.def.ayudaMando && MJ.fase !== 'intro' && MJ.fase !== 'resultados') sub = MJ.def.ayudaMando(juega);
    return Object.assign({ vista: 'mando', texto: MJ.def.nombre, sub, fase: MJ.fase, control: MJ.fase === 'resultados' ? 'boton' : MJ.def.control,
      boton: MJ.fase === 'resultados' || !!MJ.def.boton || MJ.def.control === 'boton', listo: !!listo,
      inclinar: MJ.def.control === 'inclinar', agitar: MJ.def.control === 'agitar' }, base);
  }
  if (juego.fase === 'reto' && juego.reto && juego.reto.j.num === num) {
    return Object.assign({ vista: 'reto', texto: '¡Atrapa la estrella!', sub: 'Toca justo cuando la flecha esté en lo verde.', botones: [{ texto: '¡ATRAPAR!' }], acciones: [atrapar] }, base);
  }
  const actual = p.jugadores[p.turno];
  const botones = ponerMensaje.botones || [];
  if (actual && actual.num === num && botones.length) {
    return Object.assign({
      vista: 'botones', texto: $('texto-turno').textContent, sub: $('nota-turno').textContent,
      botones: botones.map((b) => ({ texto: b.texto, agitar: b.texto === 'Lanzar dado' })),
      acciones: botones.map((b) => b.accion)
    }, base);
  }
  const v = espera($('texto-turno').textContent, actual && actual.num === num ? 'Mira la pantalla.' : 'Turno de ' + (actual ? actual.pj.nombre : '...'));
  if (esLider(num) && !MJ.activo) v.pausa = true; // el líder ve un botón chico de Pausa en la esquina
  return v;
}

// Se manda a cada celular solo cuando su pantalla cambia
function actualizarMandos() {
  RED.mandos.forEach((conn, num) => {
    if (!conn || !conn.open) return;
    const v = vistaDe(num);
    RED.acciones[num] = v.acciones || [];
    delete v.acciones;
    const clave = JSON.stringify(v);
    if (clave === RED.vistas[num]) return;
    RED.vistas[num] = clave;
    RED.version[num]++;
    v.tipo = 'vista';
    v.v = RED.version[num];
    try { conn.send(v); } catch (e) { /* se reintenta en el siguiente ciclo */ }
  });
}

/* ---------- 4. LO QUE LLEGA DE LOS CELULARES ---------- */
const DIRECCIONES = { arriba: [0, -1], abajo: [0, 1], izq: [-1, 0], der: [1, 0] };

function datoDeMando(conn, d) {
  const num = conn.num;
  if (num === undefined || RED.mandos[num] !== conn || !d) return;
  if (d.tipo === 'boton') {
    if (MJ.activo) { apretar(num, d.boton, !!d.baja); return; }
    if (estado.pantalla === 'personajes' && d.baja) {
      const mov = DIRECCIONES[d.boton];
      if (mov) moverCursor(num, mov[0], mov[1]);
      else if (d.boton === 'accion') elegir(num);
    }
  } else if (d.tipo === 'opcion') {
    if (d.v !== RED.version[num]) return; // botón de una pantalla vieja
    const f = RED.acciones[num][d.i];
    if (f) f();
  } else if (d.tipo === 'stick') { // joystick (-1 a 1)
    if (!MJ.activo) return;
    const m = mando[num];
    m.stickX = Math.max(-1, Math.min(1, Number(d.x) || 0));
    m.stickY = Math.max(-1, Math.min(1, Number(d.y) || 0));
    m.usaStick = true;
  } else if (d.tipo === 'pausa') { // botón de pausa del líder
    if (esLider(num) && estado.pantalla === 'juego') abrirPausa();
  } else if (d.tipo === 'listo') { // botón LISTO de la práctica
    if (MJ.activo) marcarListo(num);
  } else if (d.tipo === 'inclinar') { // inclinación ya centrada en el celular (-1 a 1)
    if (!MJ.activo) return;
    const m = mando[num];
    m.inclX = Math.max(-1, Math.min(1, Number(d.x) || 0));
    m.inclY = Math.max(-1, Math.min(1, Number(d.y) || 0));
    m.usaInclinar = true;
  } else if (d.tipo === 'empuje') { // fuerza de las sacudidas (Carrera de cohetes)
    if (MJ.activo) mando[num].empuje += Math.min(400, Number(d.f) || 0) * 0.007;
  } else if (d.tipo === 'energia') {
    const p = estado.partida;
    if (p && p.jugadores[p.turno].num === num && juego.fase === 'esperando') dado.agite = Math.min(1, Number(d.e) || 0);
  }
}

// Botones de la pantalla de sala
// Sin celulares: hasta 4 personas con el teclado del PC
function jugarConTeclado() {
  cerrarSala();
  sonar('clic');
  estado.modo = 'local';
  estado.humanos = Math.max(2, Math.min(4, estado.humanos));
  prepararSeleccion();
  cambiarPantalla('personajes');
}

(function conectarSala() {
  $('btn-sala-empezar').addEventListener('click', empezarOnline);
  $('btn-sala-teclado').addEventListener('click', jugarConTeclado);
  $('btn-invitar').addEventListener('click', invitar);
})();

/* ---------- 5. MULTIJUGADOR A DISTANCIA (anfitrión) ----------
   Los invitados abren index.html?unirse=CODIGO. Su pantalla se conecta como
   "espejo": recibe el ESTADO del juego (no video) y lo dibuja con el mismo
   código del juego. Su control es control.html dentro de un recuadro.
   Aquí el anfitrión arma esas "fotos" del estado y se las manda. */
RED.espejos = [];
RED.ultimoDOM = new Map(); // lo último que se mandó de cada texto de pantalla

function urlInvitacion() {
  const u = new URL('index.html', location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('unirse', RED.codigo);
  const q = new URLSearchParams(location.search);
  ['peerhost', 'peerport'].forEach((k) => { if (q.get(k)) u.searchParams.set(k, q.get(k)); });
  return u.href;
}

async function invitar() {
  const url = urlInvitacion();
  sonar('clic');
  try {
    if (navigator.share) { await navigator.share({ title: 'Nebula Party', text: '¡Juega conmigo Nebula Party! Sala ' + RED.codigo, url }); return; }
  } catch (e) { /* si cancelan, se copia */ }
  try { await navigator.clipboard.writeText(url); mensajeSala('¡Enlace copiado! Pégalo en WhatsApp o donde quieras.'); }
  catch (e) { mensajeSala('Copia este enlace y envíalo: ' + url); }
}

function espejoNuevo(conn) {
  conn.on('open', () => {
    RED.espejos.push(conn);
    conn.domEnviado = new Map();
    conn.send({ tipo: 'bienvenida', sala: RED.codigo, version: 1 });
    aviso('Se conectó una pantalla a distancia');
  });
  const quitar = () => { RED.espejos = RED.espejos.filter((c) => c !== conn); };
  conn.on('close', quitar);
  conn.on('error', quitar);
}

// Copia "plana" de un objeto del juego (sin mallas 3D, imágenes ni funciones)
const SALTAR_EN_FOTO = new Set(['malla', 'ficha', 'nave', 'cohete', 'piloto', 'ref', 'pj', 'bot', 'userData', 'tex', 'resolver', 'alTerminar']);
const r3 = (n) => Math.round(n * 1000) / 1000;
function plano(v, prof) {
  if (v === null || v === undefined) return v;
  const t = typeof v;
  if (t === 'number') return Number.isFinite(v) ? r3(v) : 0;
  if (t === 'string' || t === 'boolean') return v;
  if (t !== 'object') return undefined;
  if (v.isObject3D) return { _p: [r3(v.position.x), r3(v.position.y), r3(v.position.z)], _v: v.visible };
  if (v.isMaterial || v.isTexture || v.isBufferGeometry || v instanceof Element || v.isVector3 || v.isQuaternion) return undefined;
  if (prof > 4) return undefined;
  if (Array.isArray(v)) return v.map((x) => plano(x, prof + 1));
  const o = {};
  for (const k in v) {
    if (SALTAR_EN_FOTO.has(k)) continue;
    const x = plano(v[k], prof + 1);
    if (x !== undefined) o[k] = x;
  }
  if (v.malla && v.malla.isObject3D) { o._my = r3(v.malla.position.y); o._mv = v.malla.visible; }
  return o;
}
const NO_COPIAR_DEF = new Set(['escena', 'cam', 'id', 'nombre', 'corto', 'tipo', 'frase', 'controles', 'inclinar', 'agitar', 'soloGrupo']);
function planoDef(def) {
  const o = {};
  Object.keys(def).forEach((k) => {
    if (NO_COPIAR_DEF.has(k) || /^[A-Z0-9_]+$/.test(k) || typeof def[k] === 'function') return;
    const x = plano(def[k], 0);
    if (x !== undefined) o[k] = x;
  });
  return o;
}

function fotoEstado() {
  const p = estado.partida;
  const f = {
    tipo: 'estado', pantalla: estado.pantalla, mundo: estado.mundo, rondas: estado.rondas, total: estado.total,
    reloj: r3(juego.reloj), agite: r3(dado.agite || 0),
    sala: { codigo: RED.codigo, puestos: RED.mandos.map(Boolean) }
  };
  if (p && estado.pantalla === 'juego') {
    f.partida = {
      ronda: p.ronda, turno: p.turno, estrella: p.estrella ? { casilla: p.estrella.casilla, cae: r3(p.estrella.cae) } : null,
      jugadores: p.jugadores.map((j) => ({ num: j.num, pj: j.pj.id, humano: j.humano, casilla: j.casilla, monedas: j.monedas, estrellas: j.estrellas }))
    };
    f.juego = { fase: juego.fase, pasos: juego.pasos, opciones: juego.opciones, eleccion: juego.eleccion, mov: juego.mov ? plano(juego.mov, 0) : null };
    f.tablero = { foco: tablero.foco, temblor: r3(tablero.temblor || 0), flotantes: plano(tablero.flotantes, 0) };
  }
  if (MJ.activo) {
    f.mj = {
      sesion: MJ.sesion, def: MJ.def ? MJ.def.id : null, fase: MJ.fase, t: r3(MJ.t), cartel: MJ.cartel, modo: MJ.modo,
      jug: MJ.jug.map((j) => Object.assign(plano(j, 0), { num: j.num, humano: j.humano })),
      estado: MJ.def && MJ.fase !== 'ruleta' ? planoDef(MJ.def) : null,
      ruleta: ruleta.lista ? { lista: ruleta.lista.map((m) => m.id), angulo: ruleta.giro ? r3(ruleta.giro.rotation.y) : 0 } : null
    };
  }
  if (typeof traga !== 'undefined' && traga.rodillos.length && !$('carta-3d').hidden) {
    f.traga = { rot: traga.rodillos.map((r) => r3(r.rotation.x)), frente: traga.frente || [] };
  }
  return f;
}

// Partes de la pantalla que se copian tal cual (textos, listas, ventanas)
const ESPEJO_DOM = [
  ['rejilla', 'html'], ['paneles', 'html'], ['paneles', 'class'], ['ayuda-controles', 't'],
  ['mensaje-turno', 'html'],
  ['carta', 'h'], ['carta', 'style'], ['carta-icono', 't'], ['carta-titulo', 't'], ['carta-texto', 't'], ['carta-3d', 'h'],
  ['reto', 'h'], ['reto-quien', 't'], ['reto-ayuda', 't'], ['reto-zona', 'style'], ['reto-flecha', 'style'],
  ['capa-podio', 'h'], ['podio-titulo', 't'], ['podio-lugares', 'html'], ['podio-lugares', 'class'], ['podio-resto', 'html'], ['podio-resto', 'h'],
  ['capa-pausa', 'h'],
  ['mj-ruleta', 'h'], ['mj-ruleta-titulo', 't'], ['ruleta-nombre', 't'],
  ['mj-intro', 'h'], ['mj-tipo', 't'], ['mj-titulo', 't'], ['mj-frase', 't'], ['mj-como', 't'], ['mj-controles', 'html'],
  ['mj-resultados', 'h'], ['mj-ganador', 't'], ['mj-lista-resultados', 'html']
];
function leerDOM(id, prop) {
  const el = $(id);
  if (!el) return null;
  if (prop === 'h') return el.hidden;
  if (prop === 't') return el.textContent;
  if (prop === 'html') return el.innerHTML;
  if (prop === 'class') return el.className;
  if (prop === 'style') return el.getAttribute('style') || '';
  return null;
}

function enviarEspejos() {
  if (!RED.espejos.length) return;
  const foto = fotoEstado();
  RED.espejos.forEach((conn) => {
    if (!conn.open) return;
    const dom = {};
    ESPEJO_DOM.forEach(([id, prop]) => {
      const clave = id + ':' + prop, valor = leerDOM(id, prop);
      if (conn.domEnviado.get(clave) !== valor) { dom[clave] = valor; conn.domEnviado.set(clave, valor); }
    });
    try { conn.send(Object.keys(dom).length ? Object.assign({ dom }, foto) : foto); } catch (e) { /* siguiente vuelta */ }
  });
}
setInterval(enviarEspejos, 100);

function aEspejos(dato) {
  RED.espejos.forEach((conn) => { if (conn.open) try { conn.send(dato); } catch (e) { /* nada */ } });
}

// Eventos que los invitados deben ver al instante: el dado y los sonidos
(function engancharEventos() {
  const mostrarOriginal = mostrarDado, animarOriginal = animarDado, ocultarOriginal = ocultarDado, sonarOriginal = sonar;
  mostrarDado = function (color, quien) { mostrarOriginal(color, quien); aEspejos({ tipo: 'dado', acc: 'mostrar', color, quien }); };
  animarDado = function (resultado, alTerminar) { animarOriginal(resultado, alTerminar); aEspejos({ tipo: 'dado', acc: 'lanzar', resultado }); };
  ocultarDado = function () { ocultarOriginal(); aEspejos({ tipo: 'dado', acc: 'ocultar' }); };
  const ultimoSonido = {};
  sonar = function (tipo) {
    sonarOriginal(tipo);
    const ahora = performance.now();
    if (RED.espejos.length && !(ultimoSonido[tipo] > ahora - 60)) { ultimoSonido[tipo] = ahora; aEspejos({ tipo: 'son', s: tipo }); }
  };
})();
