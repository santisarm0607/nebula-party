/* =========================================================
   NEBULA PARTY - espejo.js  (jugar a distancia: la pantalla del invitado)
   Se activa al abrir index.html?unirse=CODIGO.
   No recibe video: recibe el ESTADO del juego del anfitrión (~10 veces por
   segundo) y lo dibuja con las mismas funciones del juego, suavizando los
   movimientos entre una "foto" y la siguiente. El control del jugador es
   control.html dentro de un recuadro (el mismo de los celulares).
   1. Conexión   2. Aplicar el estado   3. Minijuegos   4. Teclado
   ========================================================= */
'use strict';

const ESPEJO = {
  activo: false, peer: null, conn: null, codigo: null,
  firmaPartida: '', sesionMJ: null, defMJ: null, listaRuleta: '',
  dom: new Map() // último valor recibido de cada texto de pantalla
};
const SUAVES = new Set(['x', 'y', 'z', 'h']); // valores que se mueven suave entre fotos

/* ---------- 1. CONEXIÓN ---------- */
function iniciarEspejo(codigo) {
  ESPEJO.activo = true;
  ESPEJO.codigo = codigo;
  document.body.classList.add('espejo');
  PANTALLAS.espejo = 'pantalla-espejo';
  cambiarPantalla('espejo');
  estadoEspejo('Conectando a la sala ' + codigo + '...');

  // Tu control (el mismo de los celulares) en un recuadro
  const u = new URL('control.html', location.href);
  u.search = '';
  u.searchParams.set('sala', codigo);
  u.searchParams.set('embebido', '1');
  const q = new URLSearchParams(location.search);
  ['peerhost', 'peerport'].forEach((k) => { if (q.get(k)) u.searchParams.set(k, q.get(k)); });
  $('espejo-control').src = u.href;
  $('espejo-caja').hidden = false;

  if (!window.Peer) { estadoEspejo('No se pudo cargar la conexión. Revisa tu internet y recarga la página.'); return; }
  ESPEJO.peer = new Peer(opcionesPeer());
  ESPEJO.peer.on('open', () => {
    const conn = ESPEJO.peer.connect(PREFIJO_SALA + codigo, { reliable: true, metadata: { espejo: true } });
    ESPEJO.conn = conn;
    conn.on('data', recibirEspejo);
    conn.on('close', () => { estadoEspejo('Se perdió la conexión con el anfitrión. Recarga la página para volver a entrar.'); cambiarPantalla('espejo'); });
  });
  ESPEJO.peer.on('error', (err) => {
    estadoEspejo(err.type === 'peer-unavailable'
      ? 'No existe la sala ' + codigo + '. Pídele al anfitrión un enlace nuevo.'
      : 'No se pudo conectar (' + err.type + '). Revisa tu internet y recarga.');
  });
}

function estadoEspejo(texto) { $('espejo-estado').textContent = texto; }

function recibirEspejo(d) {
  if (!d || !d.tipo) return;
  if (d.tipo === 'bienvenida') estadoEspejo('¡Conectado a la sala ' + d.sala + '! Espera a que el anfitrión empiece. Tu control está en el recuadro.');
  else if (d.tipo === 'son') sonar(d.s);
  else if (d.tipo === 'dado') {
    prepararDado();
    if (d.acc === 'mostrar') mostrarDado(d.color, d.quien);
    else if (d.acc === 'lanzar') animarDado(d.resultado, () => {});
    else ocultarDado();
  } else if (d.tipo === 'estado') aplicarEstado(d);
}

/* ---------- 2. APLICAR EL ESTADO ---------- */
function aplicarDOM(dom) {
  Object.entries(dom).forEach(([clave, valor]) => { ESPEJO.dom.set(clave, valor); ponerDOM(clave, valor); });
}
function reaplicarDOM() { ESPEJO.dom.forEach((valor, clave) => ponerDOM(clave, valor)); }
function ponerDOM(clave, valor) {
  const [id, prop] = clave.split(':');
  const el = $(id);
  if (!el || valor === null || valor === undefined) return;
  if (prop === 'h') el.hidden = valor;
  else if (prop === 't') el.textContent = valor;
  else if (prop === 'html') el.innerHTML = valor;
  else if (prop === 'class') el.className = valor;
  else if (prop === 'style') el.setAttribute('style', valor);
}

function aplicarEstado(f) {
  const destino = { personajes: 'personajes', mundos: 'mundos', juego: 'juego' }[f.pantalla] || 'espejo';
  if (destino === 'juego' && !prepararPartida(f)) return;
  if (destino !== 'juego') ESPEJO.firmaPartida = '';
  if (destino === 'mundos' && estado.mundo !== f.mundo) seleccionarMundo(f.mundo, false);
  estado.rondas = f.rondas;
  document.querySelectorAll('[data-rondas]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.rondas) === f.rondas)));
  if (estado.pantalla !== destino) { cambiarPantalla(destino); reaplicarDOM(); }
  if (f.dom) aplicarDOM(f.dom);
  if (destino === 'espejo') dibujarPuestos(f.sala);
  if (destino === 'juego') aplicarPartida(f);
  aplicarMJ(f.mj);
  aplicarTraga(f.traga);
}

function dibujarPuestos(sala) {
  if (!sala) return;
  const lista = $('espejo-puestos');
  const clave = sala.puestos.join();
  if (lista.dataset.clave === clave) return;
  lista.dataset.clave = clave;
  lista.textContent = '';
  sala.puestos.forEach((ocupado, i) => {
    const li = document.createElement('li');
    li.className = 'sala-puesto' + (ocupado ? ' conectado' : '');
    const color = document.createElement('span');
    color.className = 'mj-color color-j' + (i + 1);
    color.textContent = 'J' + (i + 1);
    const texto = document.createElement('span');
    texto.textContent = ocupado ? '¡Conectado!' : 'Libre (bot)';
    li.append(color, texto);
    lista.appendChild(li);
  });
}

// Arma la partida en esta pantalla la primera vez (mapa, HUD, dado)
function prepararPartida(f) {
  const p = f.partida;
  if (!p) return false;
  const firma = f.mundo + '|' + p.jugadores.map((j) => j.pj + (j.humano ? 'h' : 'b')).join(',');
  if (firma === ESPEJO.firmaPartida) return true;
  ESPEJO.firmaPartida = firma;
  estado.mundo = f.mundo;
  estado.partida = {
    ronda: p.ronda, turno: p.turno, estrella: p.estrella,
    jugadores: p.jugadores.map((j) => ({ num: j.num, pj: PERSONAJES.find((x) => x.id === j.pj), humano: j.humano, casilla: j.casilla, monedas: j.monedas, estrellas: j.estrellas }))
  };
  tablero.imagen = pintarMapa(MUNDOS[f.mundo], tablero.escalaImagen, true);
  tablero.sigue = true; tablero.verTodo = false; tablero.flotantes = [];
  prepararDado();
  construirHud();
  const k = MUNDOS[f.mundo].mapa.casillas[p.jugadores[p.turno].casilla];
  tablero.cam.x = k.x; tablero.cam.y = k.y;
  return true;
}

function aplicarPartida(f) {
  const p = estado.partida, s = f.partida;
  p.ronda = s.ronda; p.turno = s.turno; p.estrella = s.estrella;
  s.jugadores.forEach((sj, i) => {
    const j = p.jugadores[i];
    const cambio = j.monedas !== sj.monedas || j.estrellas !== sj.estrellas;
    j.casilla = sj.casilla; j.monedas = sj.monedas; j.estrellas = sj.estrellas; j.humano = sj.humano;
    if (cambio) actualizarHudJugador(j);
  });
  actualizarTurnoHud();
  const g = f.juego;
  juego.fase = g.fase; juego.pasos = g.pasos; juego.opciones = g.opciones; juego.eleccion = g.eleccion;
  if (g.mov) {
    if (!juego.mov || juego.mov.desde !== g.mov.desde || juego.mov.hacia !== g.mov.hacia) juego.mov = Object.assign({}, g.mov);
    else { if (Math.abs(juego.mov.t - g.mov.t) > 0.35) juego.mov.t = g.mov.t; juego.mov.dur = g.mov.dur; juego.mov.salto = g.mov.salto; }
  } else juego.mov = null;
  if (Math.abs(juego.reloj - f.reloj) > 0.3) juego.reloj = f.reloj;
  tablero.foco = f.tablero.foco;
  tablero.temblor = f.tablero.temblor;
  tablero.flotantes = f.tablero.flotantes || [];
  dado.agite = f.agite;
}

// Lo llama actualizarJuego (script.js) en vez de la lógica del juego
function avanzarEspejo(dt) {
  juego.reloj += dt;
  if (MJ.activo) { MJ.t += dt; suavizarMJ(dt); return; }
  actualizarDado(dt);
  if (juego.fase === 'moviendo' && juego.mov) juego.mov.t = Math.min(1, juego.mov.t + dt / (DURACION_PASO * (juego.mov.dur || 1)));
}

function aplicarTraga(t) {
  if (!t || !prepararTraga()) return;
  t.rot.forEach((r, i) => { traga.rodillos[i].rotation.x = r; });
  t.frente.forEach((s, i) => { traga.rodillos[i].material[4] = materialSimbolo(s); });
  traga.r.render(traga.escena, traga.cam);
}

/* ---------- 3. MINIJUEGOS ---------- */
function aplicarMJ(m) {
  if (!m) {
    if (MJ.activo) { cerrarMinijuego(); ESPEJO.sesionMJ = null; ESPEJO.defMJ = null; }
    return;
  }
  if (!estado.partida) return;
  if (!MJ.activo || ESPEJO.sesionMJ !== m.sesion) {
    ESPEJO.sesionMJ = m.sesion;
    ESPEJO.defMJ = null;
    abrirCapaMJ(estado.partida, m.jug.map((x) => estado.partida.jugadores[x.num]), m.modo);
    reaplicarDOM();
  }
  MJ.fase = m.fase;
  MJ.cartel = m.cartel;
  if (Math.abs(MJ.t - m.t) > 0.3) MJ.t = m.t;
  if (m.def && ESPEJO.defMJ !== m.def) {
    const def = MINIJUEGOS.find((x) => x.id === m.def);
    if (!def || (def.tipo === '3D' && !hay3D())) return;
    ESPEJO.defMJ = m.def;
    MJ.def = def;
    MJ.jug.forEach((j) => { j.puntos = 0; j.vivo = true; });
    def.iniciar(MJ);
  }
  m.jug.forEach((sj) => { const j = MJ.jug.find((x) => x.num === sj.num); if (j) aplicarCampos(j, sj, MJ.def); });
  if (MJ.def && m.estado && ESPEJO.defMJ) aplicarCampos(MJ.def, m.estado, MJ.def);
  if (m.fase === 'ruleta' && m.ruleta && hay3D()) {
    const lista = m.ruleta.lista.join(',');
    if (ESPEJO.listaRuleta !== lista || !ruleta.escena) {
      ESPEJO.listaRuleta = lista;
      ruleta.lista = m.ruleta.lista.map((id) => MINIJUEGOS.find((x) => x.id === id));
      prepararRuleta(ruleta.lista);
    }
    ruleta.giro.rotation.y = m.ruleta.angulo;
    ruleta.r.render(ruleta.escena, ruleta.cam);
  }
}

// Copia los datos recibidos sobre los objetos de esta pantalla (sin romper sus mallas 3D)
function aplicarCampos(obj, datos, def) {
  for (const k in datos) {
    const v = datos[k], actual = obj[k];
    if (v === null || typeof v !== 'object') { ponerValor(obj, k, v); continue; }
    if (!Array.isArray(v) && v._p) {
      if (actual && actual.isObject3D) { actual.position.set(v._p[0], v._p[1], v._p[2]); actual.visible = v._v; }
      continue;
    }
    if (Array.isArray(v)) {
      if (!v.some((x) => x && typeof x === 'object')) { obj[k] = v.slice(); continue; }
      if (!Array.isArray(actual)) obj[k] = [];
      reconciliar(def, k, obj[k], v);
      continue;
    }
    if (actual && typeof actual === 'object' && !actual.isObject3D) aplicarCampos(actual, v, def);
    else obj[k] = JSON.parse(JSON.stringify(v));
  }
}

// Si el valor se mueve poco, se guarda como "objetivo" y se llega suave; si salta, se pone directo
function ponerValor(obj, k, v) {
  if (SUAVES.has(k) && typeof v === 'number' && typeof obj[k] === 'number' && Math.abs(v - obj[k]) < 150) obj['_o' + k] = v;
  else { obj[k] = v; delete obj['_o' + k]; }
}

// Listas con objetos (rocas, cristales, asteroides...): crea o quita mallas para que coincidan
function reconciliar(def, clave, locales, remotos) {
  const escena = def && def.escena;
  while (locales.length > remotos.length) {
    const e = locales.pop();
    if (e && e.malla && escena) escena.remove(e.malla);
  }
  remotos.forEach((r, i) => {
    if (r === null || r === undefined) return;
    let e = locales[i];
    if (e && e.isObject3D) { if (r._p) { e.position.set(r._p[0], r._p[1], r._p[2]); e.visible = r._v; } return; }
    const firma = def && def.firmaMalla ? def.firmaMalla(clave, r) : null;
    if (!e || (firma !== null && e._firma !== firma)) {
      if (e && e.malla && escena) escena.remove(e.malla);
      e = {};
      if (firma !== null && escena && hay3D()) {
        const m = def.mallaPara(clave, r);
        if (m) { e.malla = m; escena.add(m); }
      }
      e._firma = firma;
      locales[i] = e;
    }
    for (const kk in r) {
      if (kk === '_my') { if (e.malla) e.malla.position.y = r._my; }
      else if (kk === '_mv') { if (e.malla) e.malla.visible = r._mv; }
      else if (r[kk] && typeof r[kk] === 'object') e[kk] = JSON.parse(JSON.stringify(r[kk]));
      else ponerValor(e, kk, r[kk]);
    }
  });
}

function suavizar(obj, f) {
  SUAVES.forEach((k) => { const o = obj['_o' + k]; if (o !== undefined && typeof obj[k] === 'number') obj[k] += (o - obj[k]) * f; });
}
function suavizarMJ(dt) {
  const f = Math.min(1, dt * 14);
  MJ.jug.forEach((j) => suavizar(j, f));
  if (!MJ.def) return;
  Object.keys(MJ.def).forEach((k) => {
    const v = MJ.def[k];
    if (Array.isArray(v)) v.forEach((e) => { if (e && typeof e === 'object' && !e.isObject3D) suavizar(e, f); });
  });
}

/* ---------- 4. TECLADO (invitado en PC) ----------
   W A S D / flechas, Espacio / Enter y los números van al control del recuadro.
   M, C, + y - mueven la cámara de esta pantalla. */
const TECLAS_ESPEJO = {
  KeyW: 'arriba', ArrowUp: 'arriba', KeyS: 'abajo', ArrowDown: 'abajo',
  KeyA: 'izq', ArrowLeft: 'izq', KeyD: 'der', ArrowRight: 'der',
  Space: 'accion', Enter: 'accion', NumpadEnter: 'accion'
};
function aControl(dato) {
  const marco = $('espejo-control');
  if (marco && marco.contentWindow) marco.contentWindow.postMessage(Object.assign({ nebula: 'tecla' }, dato), location.origin);
}
function teclaEspejo(e, baja) {
  const boton = TECLAS_ESPEJO[e.code];
  if (boton) { e.preventDefault(); if (!e.repeat || !baja) aControl({ boton, baja }); return; }
  if (!baja) return;
  if (/^Digit[1-9]$/.test(e.code)) { aControl({ boton: 'accion', baja: true, opcion: Number(e.code.slice(5)) - 1 }); return; }
  if (estado.pantalla === 'juego' && !MJ.activo) {
    const t = e.key.toLowerCase();
    if (t === 'm') verMapa(); else if (t === 'c') centrarCamara();
    else if (t === '+' || t === '=') acercar(1.15); else if (t === '-') acercar(1 / 1.15);
  }
}
document.addEventListener('keyup', (e) => { if (ESPEJO.activo) teclaEspejo(e, false); });

(function conectarEspejo() {
  $('espejo-plegar').addEventListener('click', () => {
    const caja = $('espejo-caja');
    caja.classList.toggle('plegado');
    $('espejo-plegar').textContent = caja.classList.contains('plegado') ? 'Mostrar control ▲' : 'Ocultar control ▼';
  });
  $('btn-espejo-salir').addEventListener('click', () => { location.href = location.pathname; });
  const codigo = new URLSearchParams(location.search).get('unirse');
  if (codigo) iniciarEspejo(codigo.trim().toUpperCase());
})();
