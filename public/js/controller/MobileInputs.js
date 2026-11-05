/* =========================================================
   NEBULA PARTY — MobileInputs.js (Mando del celular)
   Índice:
   1. Conexión y estado del mando
   2. Utilidades (pantallas, vibración, pantalla completa)
   3. Unirse a la sala
   4. Estados que manda el host
   5. Interfaz táctil: D-Pad y botones A / B
   ========================================================= */
'use strict';

(() => {
  // 1. Conexión y estado --------------------------------------------------------
  const $ = (s) => document.querySelector(s);
  const socket = io();
  const mando = { unido: false, yo: null, dir: { x: 0, y: 0 }, dirs: new Set(), ultimo: null };
  const PANTALLAS = ['unirse', 'espera', 'tablero', 'minijuego', 'podio'];
  /** Dibuja el sprite del personaje (el mismo pixel art del PC, js/Sprites.js). */
  function pintarFicha(pid, color) {
    document.body.style.setProperty('--color', color);
    const c = $('#ficha');
    const g = c.getContext('2d');
    g.clearRect(0, 0, 32, 32);
    if (typeof SpritesPixel !== 'undefined' && pid) g.drawImage(SpritesPixel.obtener(pid, 'idle', 0), 0, 0);
  }

  // 2. Utilidades -------------------------------------------------------------------
  function mostrar(nombre) {
    PANTALLAS.forEach((p) => $('#pantalla-' + p).classList.toggle('activo', p === nombre));
    document.body.dataset.pantalla = nombre;
  }

  function vibrar(patron = 50) {
    if (navigator.vibrate) navigator.vibrate(patron);
  }

  function avisar(txt) { $('#aviso').textContent = txt; }

  function pantallaCompleta() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen()
      .then(() => (screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null))
      .catch(() => {});
  }

  function reiniciar(mensaje) {
    soltarTodo();
    mando.unido = false;
    mando.yo = null;
    $('#info-yo').textContent = '';
    $('#btn-unirse').disabled = false;
    mostrar('unirse');
    avisar(mensaje || '');
  }

  $('#btn-pantalla').addEventListener('click', () => { vibrar(); pantallaCompleta(); });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // 3. Unirse ------------------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  if (params.get('sala')) $('#codigo').value = params.get('sala').toUpperCase().slice(0, 4);
  try { $('#nombre').value = localStorage.getItem('nebula.nombre') || ''; } catch (e) { /* sin almacenamiento */ }

  // ficha para volver a entrar si se cae la conexión
  let token = '';
  try { token = localStorage.getItem('nebula.token') || ''; } catch (e) { /* sin almacenamiento */ }
  if (!token) {
    token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem('nebula.token', token); } catch (e) { /* sin almacenamiento */ }
  }

  function unirse(reintento) {
    if (!reintento) vibrar();
    const codigo = reintento ? mando.sala : $('#codigo').value.trim().toUpperCase();
    const nombre = reintento ? mando.nombre : $('#nombre').value.trim();
    if (codigo.length !== 4) { avisar('EL CÓDIGO TIENE 4 LETRAS'); return; }
    if (!socket.connected) { avisar('SIN CONEXIÓN CON EL SERVIDOR'); return; }
    $('#btn-unirse').disabled = true;
    avisar('CONECTANDO...');
    socket.emit('jugador:unirse', { codigo, nombre, token }, (r) => {
      $('#btn-unirse').disabled = false;
      if (!r || !r.ok) {
        if (reintento) { reiniciar(((r && r.error) || 'No se pudo volver').toUpperCase()); return; }
        avisar(((r && r.error) || 'No se pudo entrar').toUpperCase());
        return;
      }
      mando.sala = codigo;
      mando.nombre = nombre;
      mando.reconectando = false;
      try { localStorage.setItem('nebula.nombre', nombre); } catch (e) { /* sin almacenamiento */ }
      mando.unido = true;
      mando.yo = r;
      avisar('');
      $('#txt-personaje').textContent = r.personaje;
      $('#txt-espera').textContent = 'ESPERANDO AL ANFITRIÓN...';
      $('#info-yo').textContent = `${r.nombre.toUpperCase()} · ${r.personaje}`;
      mostrar('espera');
      pantallaCompleta();
    });
  }
  $('#btn-unirse').addEventListener('click', () => unirse(false));
  ['#codigo', '#nombre'].forEach((s) => $(s).addEventListener('keydown', (e) => { if (e.key === 'Enter') unirse(); }));

  // 4. Estados que manda el host -----------------------------------------------------------------
  socket.on('juego:estado', ({ estado, datos = {} } = {}) => {
    if (!mando.unido) return;
    const yo = socket.id;
    const jugadores = datos.jugadores || [];
    const mio = jugadores.find((j) => j.id === yo);
    if (!mio && estado !== 0) { reiniciar('SALISTE DE LA PARTIDA'); return; }
    const nombreDe = (id) => (jugadores.find((j) => j.id === id) || {}).nombre || '...';
    if (mio) {
      const obj = mio.objetos && mio.objetos.length ? ` · ${mio.objetos.join(', ')}` : '';
      $('#info-yo').textContent = `${mio.nombre} · ${mio.personaje} · ★ ${mio.estrellas || 0} · ${mio.monedas} MONEDAS${obj}`;
    }
    $('#pausa').hidden = !datos.pausa;
    if (mando.ultimo !== estado) soltarTodo();
    mando.ultimo = estado;

    switch (estado) {
      case 1:
        if (datos.faseLobby === 'mundo') {                  // paso 2: el líder elige el mundo
          mostrar('espera');
          const lider = datos.lider === yo;
          document.body.dataset.eligiendo = lider ? 'si' : 'no';
          $('#txt-personaje').textContent = `MUNDO: ${datos.mundo}`;
          const b = $('#btn-listo');
          b.hidden = !lider;
          b.dataset.btn = 'A';
          b.textContent = '¡JUGAR AQUÍ!';
          $('#txt-espera').textContent = lider ? 'ERES EL LÍDER: ELIGE EL MUNDO CON ◄ ►' : 'EL LÍDER ESTÁ ELIGIENDO EL MUNDO...';
          break;
        }
      // falls through
      case 0: {
        mostrar('espera');
        const eligiendo = estado === 1 && mio;
        document.body.dataset.eligiendo = eligiendo && !mio.listo ? 'si' : 'no';
        if (mio) { $('#txt-personaje').textContent = mio.personaje; pintarFicha(mio.pid, mio.color); }
        const b = $('#btn-listo');
        b.hidden = !eligiendo;
        if (eligiendo) {
          b.dataset.btn = mio.listo ? 'B' : 'A';
          b.textContent = mio.listo ? 'CAMBIAR' : '¡LO QUIERO!';
        }
        $('#txt-espera').textContent = estado === 0
          ? 'EL ANFITRIÓN ESTÁ EN EL MENÚ'
          : mio && mio.listo ? '¡LISTO! ESPERANDO A LOS DEMÁS...' : 'ELIGE CON ◄ ► Y PULSA ¡LO QUIERO!';
        break;
      }
      case 2: {
        mostrar('tablero');
        const a = $('#btn-dado'), b = $('#btn-b');
        if (datos.fase === 'tutorial') {                     // tutorial del tablero: todos confirman
          const listo = (datos.listos || []).includes(yo);
          a.disabled = listo;
          a.textContent = listo ? '¡LISTO!' : '¡ENTENDIDO!';
          b.hidden = true;
          document.body.dataset.flechas = 'no';
          $('#txt-turno').textContent = 'CÓMO JUGAR: MIRA LA PANTALLA';
          $('#txt-opcion').textContent = 'A: LANZAR DADO · B: OBJETOS · ◄ ►: ELEGIR';
          break;
        }
        const miTurno = datos.turnoDe === yo;
        a.disabled = !(miTurno && datos.etiquetaA);
        a.textContent = datos.etiquetaA || 'ESPERA...';
        b.hidden = !(miTurno && datos.etiquetaB);
        b.textContent = datos.etiquetaB || '';
        document.body.dataset.flechas = miTurno && datos.flechas ? 'si' : 'no';
        $('#txt-opcion').textContent = miTurno && datos.opcion ? `◄ ${datos.opcion} ►` : `RONDA ${datos.ronda || 1} · ${datos.mundo || ''}`;
        $('#txt-turno').textContent = miTurno
          ? (datos.fase === 'espera' ? '¡TU TURNO!' : datos.etiquetaA ? '¡DECIDE!' : 'AVANZANDO...')
          : `TURNO DE ${nombreDe(datos.turnoDe)}`;
        const clave = `${datos.turnoDe}:${datos.ronda}`;
        if (miTurno && datos.fase === 'espera' && mando.turnoVibrado !== clave) { mando.turnoVibrado = clave; vibrar([60, 40, 60]); }
        break;
      }
      case 3: {
        mostrar('minijuego');
        const pos = datos.ranking ? datos.ranking.indexOf(yo) + 1 : 0;
        const listoMini = (datos.listos || []).includes(yo);
        let txt = `${datos.minijuego || ''}${datos.instrucciones ? ` — ${datos.instrucciones}` : ''}${datos.controles ? ` (${datos.controles})` : ''}`;
        if (datos.fase === 'tutorial') txt += listoMini ? ' · ¡LISTO! ESPERANDO A LOS DEMÁS' : ' · PRUEBA LOS BOTONES Y PULSA A CUANDO ESTÉS LISTO';
        $('#txt-mini').textContent = pos ? `QUEDASTE #${pos}` : txt;
        break;
      }
      case 4: {
        mostrar('podio');
        const pos = datos.ranking ? datos.ranking.indexOf(yo) + 1 : 0;
        $('#txt-podio').textContent = pos === 1 ? '¡GANASTE!' : pos ? `PUESTO #${pos}` : 'PODIO';
        $('#txt-podio-sub').textContent = datos.lider === yo ? 'PULSA EN LA PANTALLA DEL PC O ESPERA AL ANFITRIÓN' : 'MIRA LA PANTALLA DEL PC';
        if (pos === 1) vibrar([100, 50, 100, 50, 200]);
        break;
      }
      default: break;
    }
  });

  socket.on('vibrar', (p) => vibrar(Array.isArray(p) ? p.slice(0, 10) : 200));
  socket.on('sala:cerrada', () => reiniciar('EL ANFITRIÓN CERRÓ LA SALA'));
  // reconexión: si se cae la señal, al volver entra solo con su ficha
  socket.on('disconnect', () => {
    if (!mando.unido) return;
    soltarTodo();
    mando.unido = false;
    mando.reconectando = true;
    mostrar('espera');
    $('#txt-espera').textContent = 'SE CAYÓ LA CONEXIÓN... RECONECTANDO';
    $('#btn-listo').hidden = true;
  });
  socket.on('connect', () => { if (mando.reconectando && mando.sala) unirse(true); });

  // emotes: aparecen sobre tu personaje en la pantalla del PC
  document.querySelectorAll('[data-emote]').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!mando.unido) return;
    vibrar(30);
    socket.emit('jugador:input', { t: 'emote', e: Number(b.dataset.emote) });
  }));

  // 5. Interfaz táctil ---------------------------------------------------------------------
  function enviarDir() {
    const d = mando.dirs;
    const x = (d.has('der') ? 1 : 0) - (d.has('izq') ? 1 : 0);
    const y = (d.has('abajo') ? 1 : 0) - (d.has('arriba') ? 1 : 0);
    if (x === mando.dir.x && y === mando.dir.y) return;
    mando.dir = { x, y };
    socket.emit('jugador:input', { t: 'dir', x, y });
  }

  function soltarTodo() {
    document.querySelectorAll('.pulsado').forEach((b) => {
      b.classList.remove('pulsado');
      if (b.dataset.btn) socket.emit('jugador:input', { t: 'btn', b: b.enviado || b.dataset.btn, d: false });
    });
    mando.dirs.clear();
    enviarDir();
  }

  const SOLTAR = ['pointerup', 'pointercancel', 'pointerleave'];

  // D-Pad: varios dedos a la vez (por ejemplo arriba + derecha = diagonal)
  document.querySelectorAll('[data-dir]').forEach((b) => {
    const dir = b.dataset.dir;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      mando.dirs.add(dir);
      b.classList.add('pulsado');
      vibrar(50);
      enviarDir();
    });
    SOLTAR.forEach((ev) => b.addEventListener(ev, () => {
      if (!mando.dirs.delete(dir)) return;
      b.classList.remove('pulsado');
      enviarDir();
    }));
  });

  // Botones A / B (también el de "lanzar dado" y "empezar", que son un botón A)
  document.querySelectorAll('[data-btn]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (b.disabled || !mando.unido) return;
      b.enviado = b.dataset.btn;                 // se lee al tocar: el botón LISTO cambia entre A y B
      b.classList.add('pulsado');
      vibrar(50);
      socket.emit('jugador:input', { t: 'btn', b: b.enviado, d: true });
    });
    SOLTAR.forEach((ev) => b.addEventListener(ev, () => {
      if (!b.classList.contains('pulsado')) return;
      b.classList.remove('pulsado');
      socket.emit('jugador:input', { t: 'btn', b: b.enviado, d: false });
    }));
  });
})();
