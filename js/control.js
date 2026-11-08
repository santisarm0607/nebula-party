/* =========================================================
   NEBULA PARTY - control.js  (el celular como control)
   Se conecta a la sala de la PC con PeerJS y muestra lo que
   la pantalla grande le pide: espera, cruceta, botones o reto.
   ========================================================= */
'use strict';

const $c = (id) => document.getElementById(id);
const PREFIJO = 'nebulaparty-';
const COLORES = ['#ff4d5e', '#3d8bff', '#2fbf62', '#ffb020', '#a06bff', '#ff5fd2', '#22d3ee', '#c6f03d'];
const C = { peer: null, conn: null, num: null, v: 0, ultimoEnvio: 0, vista: null, ultima: null, calibrado: false, empuje: 0, sel: 0 };
// Dentro de la pantalla de un invitado a distancia (recuadro): diseño compacto
if (new URLSearchParams(location.search).get('embebido')) document.body.classList.add('embebido');

function opcionesPeer() {
  const q = new URLSearchParams(location.search);
  const host = q.get('peerhost');
  return host ? { host, port: Number(q.get('peerport') || 9000), path: '/', secure: false } : {};
}

function enviar(dato) {
  if (C.conn && C.conn.open) C.conn.send(dato);
}

/* --- Unirse --- */
function mostrarConectar(texto) {
  Agitar.parar();
  $c('c-conectar').hidden = false;
  $c('c-juego').hidden = true;
  $c('c-estado').textContent = texto;
  $c('c-unirme').disabled = false;
  $c('c-jugador').textContent = 'Nebula Party';
  document.documentElement.style.setProperty('--c-color', '#a06bff');
}

function conectar(codigo) {
  codigo = (codigo || '').trim().toUpperCase();
  if (codigo.length !== 4) { mostrarConectar('El código tiene 4 letras. Míralo en la pantalla grande.'); return; }
  if (!window.Peer) { mostrarConectar('No se pudo cargar la conexión. Revisa tu internet.'); return; }
  $c('c-unirme').disabled = true;
  $c('c-estado').textContent = 'Conectando a la sala ' + codigo + '...';
  if (C.peer) C.peer.destroy();
  C.peer = new Peer(opcionesPeer());
  C.peer.on('open', () => {
    C.conn = C.peer.connect(PREFIJO + codigo, { reliable: true });
    C.conn.on('open', () => { $c('c-estado').textContent = '¡Conectado!'; pedirPantallaEncendida(); });
    C.conn.on('data', recibir);
    C.conn.on('close', () => mostrarConectar('Se perdió la conexión. Toca "Unirme" para volver a entrar.'));
  });
  C.peer.on('error', (err) => {
    mostrarConectar(err.type === 'peer-unavailable'
      ? 'No existe la sala ' + codigo + '. Revisa el código en la pantalla grande.'
      : 'No se pudo conectar (' + err.type + '). Revisa tu internet y vuelve a intentarlo.');
  });
}

// Que la pantalla del celular no se apague mientras juegas
async function pedirPantallaEncendida() {
  try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { /* no pasa nada */ }
}

/* --- Lo que llega de la PC --- */
function recibir(d) {
  if (!d || !d.tipo) return;
  if (d.tipo === 'hola') {
    C.num = d.num;
    $c('c-jugador').textContent = 'J' + (d.num + 1);
    document.documentElement.style.setProperty('--c-color', d.color || COLORES[d.num]);
    $c('c-conectar').hidden = true;
    $c('c-juego').hidden = false;
  } else if (d.tipo === 'lleno') {
    mostrarConectar(d.texto);
  } else if (d.tipo === 'vista') {
    mostrarVista(d);
  }
}

function mostrarVista(d) {
  const anterior = C.vista;
  C.v = d.v;
  C.vista = d.vista;
  $c('c-conectar').hidden = true;
  $c('c-juego').hidden = false;
  $c('c-titulo').textContent = d.texto || '';
  $c('c-sub').textContent = d.sub || '';
  $c('c-sprite').className = 'sprite ' + (d.pj ? 'pj-' + d.pj : 'sin-pj');
  if (d.nombre) $c('c-jugador').textContent = 'J' + (C.num + 1) + ' ' + d.nombre;
  $c('c-mando').hidden = d.vista !== 'mando';
  document.body.classList.toggle('con-mando', d.vista === 'mando');
  document.body.classList.toggle('modo-reto', d.vista === 'reto');
  ponerControles(d);
  C.ultima = d;
  C.sel = 0;
  $c('c-pausa').hidden = !d.pausa;
  prepararSensores(d);

  // Botones (turno, decisiones, reto)
  const caja = $c('c-botones');
  caja.textContent = '';
  Agitar.parar();
  $c('c-agitar').hidden = true;
  $c('c-permiso').hidden = true;
  (d.botones || []).forEach((b, i) => {
    if (b.agitar && Agitar.disponible()) {
      $c('c-agitar').hidden = false;
      prepararAgitar(i);
    }
    const btn = document.createElement('button');
    btn.className = 'boton ' + (d.vista === 'reto' ? 'b-amarillo c-grande' : b.chico ? 'b-crema c-chico' : i === 0 ? 'b-amarillo' : 'b-crema');
    btn.textContent = b.agitar && Agitar.disponible() ? 'Lanzar sin agitar' : b.texto;
    btn.addEventListener('click', () => elegirOpcion(i));
    caja.appendChild(btn);
  });

  // Vibra cuando te toca hacer algo
  if ((d.vista === 'botones' || d.vista === 'reto') && anterior !== d.vista && navigator.vibrate) navigator.vibrate(150);
}

async function prepararAgitar(i) {
  const version = C.v;
  if (Agitar.necesitaPermiso()) {
    // Primero lo intenta solo (Android); si el teléfono exige un toque (iPhone), sale el botón
    const ok = await Agitar.pedirPermiso();
    if (version !== C.v) return;
    if (!ok) {
      $c('c-permiso').hidden = false;
      $c('c-permiso').onclick = () => Agitar.pedirPermiso().then((si) => { $c('c-permiso').hidden = true; if (si && version === C.v) prepararAgitar(i); });
      return;
    }
  }
  Agitar.empezar(() => elegirOpcion(i), (e) => {
    $c('c-energia').style.width = Math.round(e * 100) + '%';
    const ahora = performance.now();
    if (ahora - C.ultimoEnvio > 90) { C.ultimoEnvio = ahora; enviar({ tipo: 'energia', e }); }
  });
}

function elegirOpcion(i) {
  Agitar.parar();
  enviar({ tipo: 'opcion', i, v: C.v });
  $c('c-botones').querySelectorAll('button').forEach((b) => { b.disabled = true; });
  if (navigator.vibrate) navigator.vibrate(40);
}

/* --- Cruceta y botón A --- */
document.querySelectorAll('#c-mando [data-boton]').forEach((b) => {
  const boton = b.dataset.boton;
  const soltar = () => { if (b.classList.contains('apretado')) { b.classList.remove('apretado'); enviar({ tipo: 'boton', boton, baja: false }); } };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('apretado');
    enviar({ tipo: 'boton', boton, baja: true });
    if (navigator.vibrate) navigator.vibrate(15);
  });
  b.addEventListener('pointerup', soltar);
  b.addEventListener('pointercancel', soltar);
  b.addEventListener('pointerleave', soltar);
});

/* --- Arranque --- */
$c('c-unirme').addEventListener('click', () => { Agitar.pedirPermiso(); conectar($c('c-codigo').value); });
$c('c-codigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') $c('c-unirme').click(); });
const salaURL = new URLSearchParams(location.search).get('sala');
if (salaURL) { $c('c-codigo').value = salaURL; conectar(salaURL); }

/* --- Minijuegos con sensor ---
   INCLINAR: al tocar LISTO se guarda cómo tienes el celular en ese momento
   (ese es el "centro"). Desde ahí, inclinarlo a un lado mueve hacia ese lado.
   Así cada uno lo sostiene como le quede cómodo. Re-centrar lo vuelve a guardar.
   AGITAR: cada sacudida empuja tu cohete. */
function prepararSensores(d) {
  Inclinar.alCambiar = null;
  Agitar.pararContinuo();
  const panel = $c('c-sensor');
  const conSensor = Agitar.disponible();
  const enJuego = ['cuenta', 'jugando', 'final'].includes(d.fase);
  $c('c-mando').classList.remove('solo-a');
  if (d.vista !== 'mando' || !conSensor || (!d.inclinar && !d.agitar)) {
    panel.hidden = true;
    if (d.vista !== 'mando') C.calibrado = false;
    return;
  }
  panel.hidden = false;
  const dibujo = $c('c-sensor-dibujo');
  dibujo.className = 'c-telefono ' + (d.inclinar ? 'c-inclinando' : '');
  $c('c-sensor-barra').hidden = !d.agitar;
  if (d.agitar) {
    $c('c-sensor-texto').textContent = '¡Agita el celular para acelerar! (también puedes tocar A muchas veces)';
    $c('c-listo').hidden = true;
    $c('c-recentrar').hidden = true;
    if (enJuego || d.fase === 'intro') Agitar.empezarContinuo((f) => {
      C.empuje += f;
      $c('c-empuje').style.width = Math.min(100, f * 3) + '%';
      const ahora = performance.now();
      if (ahora - C.ultimoEnvio > 100) { C.ultimoEnvio = ahora; enviar({ tipo: 'empuje', f: C.empuje }); C.empuje = 0; }
    });
    return;
  }
  // Inclinar
  if (d.fase === 'intro' && !d.listo) {
    if (!C.calibrado) { Inclinar.centrar(); C.calibrado = true; } // para practicar desde ya
    $c('c-sensor-texto').textContent = 'Practica inclinando. Cuando estés listo, sostén el celular como te quede cómodo y toca LISTO: esa posición será el "centro".';
    $c('c-listo').hidden = false;
    $c('c-recentrar').hidden = true;
    Inclinar.alCambiar = (x, y) => {
      const ahora = performance.now();
      if (ahora - C.ultimoEnvio > 50) { C.ultimoEnvio = ahora; enviar({ tipo: 'inclinar', x, y }); }
    };
  } else if (!C.calibrado) {
    $c('c-sensor-texto').textContent = 'Sostén el celular como te quede cómodo y toca LISTO. Esa posición será el "centro": desde ahí, inclínalo hacia donde quieras moverte.';
    $c('c-listo').hidden = false;
    $c('c-recentrar').hidden = true;
  } else {
    $c('c-sensor-texto').textContent = '¡Centro guardado! Inclina el celular para moverte. Si te acomodas, toca Re-centrar.';
    $c('c-listo').hidden = true;
    $c('c-recentrar').hidden = false;
    if (enJuego) $c('c-mando').classList.add('solo-a'); // se juega inclinando: se esconden los controles
    Inclinar.alCambiar = (x, y) => {
      const ahora = performance.now();
      if (ahora - C.ultimoEnvio > 50) { C.ultimoEnvio = ahora; enviar({ tipo: 'inclinar', x, y }); }
    };
  }
}

$c('c-listo').addEventListener('click', async () => {
  await Agitar.pedirPermiso();
  Inclinar.centrar();
  C.calibrado = true;
  if (navigator.vibrate) navigator.vibrate(60);
  // LISTO también cuenta como "estoy listo" para terminar la práctica
  enviar({ tipo: 'listo' });
  if (C.ultima) prepararSensores(C.ultima);
});
$c('c-recentrar').addEventListener('click', () => {
  Inclinar.centrar();
  if (navigator.vibrate) navigator.vibrate(40);
  $c('c-sensor-texto').textContent = '¡Centro guardado otra vez!';
});

/* --- Teclado del invitado en PC (llega desde la pantalla de juego) ---
   En cruceta se manda tal cual; con botones, las flechas eligen y Espacio/Enter confirma. */
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || e.data.nebula !== 'tecla') return;
  const d = e.data;
  if (d.listo) { // tecla L del invitado en PC
    const b = !$c('c-listo-mj').hidden ? $c('c-listo-mj') : !$c('c-listo').hidden && !$c('c-sensor').hidden ? $c('c-listo') : null;
    if (b) b.click();
    return;
  }
  if (C.vista === 'mando' && d.opcion === undefined) { enviar({ tipo: 'boton', boton: d.boton, baja: d.baja }); return; }
  if (!d.baja) return;
  const botones = [...$c('c-botones').querySelectorAll('button:not([disabled])')];
  if (!botones.length) return;
  if (d.opcion !== undefined) { if (botones[d.opcion]) botones[d.opcion].click(); return; }
  if (d.boton === 'accion') { (botones[C.sel] || botones[0]).click(); return; }
  C.sel = (C.sel + (d.boton === 'arriba' || d.boton === 'izq' ? -1 : 1) + botones.length) % botones.length;
  botones.forEach((b, i) => b.classList.toggle('elegido', i === C.sel));
});

/* --- Controles según el minijuego ---
   cruz: cruceta + A (elegir personaje, Memoria, Cuenta los aliens)
   stick: joystick (Polvo, Pinta, Sumo, Hexágonos, Meteoritos)
   boton: solo el botón A (Duelo, Rayo tractor)
   inclinar / agitar: se juega con el sensor (si no hay sensor, joystick o A) */
function ponerControles(d) {
  const conSensor = Agitar.disponible();
  let control = d.control || 'cruz';
  if (control === 'inclinar' && !conSensor) control = 'stick';
  const verCruz = control === 'cruz';
  const verStick = control === 'stick' || control === 'inclinar';
  const verA = control === 'cruz' || control === 'boton' || d.boton || (control === 'agitar');
  $c('c-cruz').hidden = !verCruz;
  $c('c-stick').hidden = !verStick;
  $c('c-a').hidden = !verA;
  $c('c-mando').classList.toggle('solo-boton', !verCruz && !verStick);
  // Botón LISTO de la práctica (los de inclinar lo tienen en su panel)
  const enPractica = d.vista === 'mando' && d.fase === 'intro';
  $c('c-listo-mj').hidden = !enPractica || d.listo || (d.control === 'inclinar' && conSensor);
  if (!verStick) soltarStick();
}

$c('c-listo-mj').addEventListener('click', () => {
  enviar({ tipo: 'listo' });
  $c('c-listo-mj').hidden = true;
  if (navigator.vibrate) navigator.vibrate(60);
});

/* --- Joystick: se arrastra la bola; manda x, y entre -1 y 1 --- */
const S = { id: null, cx: 0, cy: 0, radio: 1, ultimo: 0 };
function moverStick(e) {
  let dx = e.clientX - S.cx, dy = e.clientY - S.cy;
  const d = Math.hypot(dx, dy);
  if (d > S.radio) { dx *= S.radio / d; dy *= S.radio / d; }
  $c('c-stick-bola').style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
  const ahora = performance.now();
  if (ahora - S.ultimo > 40) { S.ultimo = ahora; enviar({ tipo: 'stick', x: Math.round(dx / S.radio * 100) / 100, y: Math.round(dy / S.radio * 100) / 100 }); }
}
function soltarStick() {
  if (S.id === null) return;
  S.id = null;
  $c('c-stick-bola').style.transform = '';
  enviar({ tipo: 'stick', x: 0, y: 0 });
}
$c('c-stick').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  S.id = e.pointerId;
  $c('c-stick').setPointerCapture(e.pointerId);
  const r = $c('c-stick').getBoundingClientRect();
  S.cx = r.left + r.width / 2; S.cy = r.top + r.height / 2; S.radio = r.width * 0.36;
  moverStick(e);
});
$c('c-stick').addEventListener('pointermove', (e) => { if (e.pointerId === S.id) moverStick(e); });
['pointerup', 'pointercancel'].forEach((ev) => $c('c-stick').addEventListener(ev, (e) => { if (e.pointerId === S.id) soltarStick(); }));

$c('c-pausa').addEventListener('click', () => enviar({ tipo: 'pausa' }));
