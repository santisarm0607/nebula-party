/* =========================================================
   NEBULA PARTY — server.js
   Índice:
   1. Configuración (Express + Socket.io)
   2. Utilidades (código de sala, IP local, limpieza de datos)
   3. Eventos del anfitrión (crear sala, estado, bloquear)
   4. Eventos del jugador (unirse, inputs)
   5. Desconexiones
   6. Arranque
   ========================================================= */
'use strict';

// 1. Configuración -------------------------------------------------------
const path = require('path');
const http = require('http');
const os = require('os');
const express = require('express');
const { Server } = require('socket.io');

const PUERTO = Number(process.env.PORT) || 3000;
// En Render (internet) los mandos se abren desde GitHub Pages; en tu PC, desde tu WiFi.
const urlMandos = () => process.env.URL_MANDOS
  || (process.env.RENDER ? 'https://santisarm0607.github.io/nebula-party/public/controller.html' : `http://${ipLocal()}:${PUERTO}/controller.html`);
const MAX_JUGADORES = 8;
const EVENTOS_A_JUGADOR = new Set(['vibrar', 'info']); // eventos que el host puede mandar a un solo mando

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const servidor = http.createServer(app);
const io = new Server(servidor, { cors: { origin: '*' } }); // deja conectar a la página de GitHub Pages

/** salas: codigo -> { host: socketId, jugadores: Set<socketId>, bloqueada: boolean } */
const salas = new Map();

// 2. Utilidades ----------------------------------------------------------
function nuevoCodigo() {
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O para no confundir con 1 y 0
  let codigo;
  do {
    codigo = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
  } while (salas.has(codigo));
  return codigo;
}

function ipLocal() {
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const red of lista || []) {
      if (red.family === 'IPv4' && !red.internal) return red.address;
    }
  }
  return 'localhost';
}

const limpiarNombre = (n) => String(n || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 10) || 'JUGADOR';
const numero = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
const responder = (fn) => (typeof fn === 'function' ? fn : () => {});

// 3 a 5. Conexiones --------------------------------------------------------
io.on('connection', (socket) => {
  socket.data = {};

  // 3. Anfitrión: crea una sala nueva
  socket.on('host:crear', (cb) => {
    if (socket.data.rol) return responder(cb)({ error: 'Este socket ya tiene rol' });
    const codigo = nuevoCodigo();
    salas.set(codigo, { host: socket.id, jugadores: new Set(), bloqueada: false });
    socket.data = { rol: 'host', sala: codigo };
    socket.join(codigo);
    responder(cb)({ codigo, url: `${urlMandos()}?sala=${codigo}` });
    console.log(`[sala ${codigo}] creada`);
  });

  // 3. Anfitrión: manda el estado del juego a todos los mandos de su sala
  socket.on('host:estado', (paquete) => {
    if (socket.data.rol !== 'host') return;
    socket.to(socket.data.sala).emit('juego:estado', paquete);
  });

  // 3. Anfitrión: manda un evento a un solo jugador (por ejemplo vibrar)
  socket.on('host:aJugador', ({ id, evento, datos } = {}) => {
    if (socket.data.rol !== 'host' || !EVENTOS_A_JUGADOR.has(evento)) return;
    const sala = salas.get(socket.data.sala);
    if (sala && sala.jugadores.has(id)) io.to(id).emit(evento, datos);
  });

  // 3. Anfitrión: cierra o abre la entrada de jugadores
  socket.on('host:bloquear', (valor) => {
    if (socket.data.rol !== 'host') return;
    const sala = salas.get(socket.data.sala);
    if (sala) sala.bloqueada = !!valor;
  });

  // 4. Jugador: pide entrar a una sala. El host decide el puesto y el personaje.
  socket.on('jugador:unirse', async (datos = {}, cb) => {
    const r = responder(cb);
    const codigo = String(datos.codigo || '').toUpperCase().trim();
    const sala = salas.get(codigo);
    if (socket.data.rol) return r({ ok: false, error: 'Ya estás en una sala' });
    if (!sala) return r({ ok: false, error: 'Esa sala no existe' });
    // si la partida ya empezó, solo puede entrar quien se desconectó (el host revisa su ficha)
    const token = String(datos.token || '').slice(0, 40);
    if (sala.bloqueada && !token) return r({ ok: false, error: 'La partida ya empezó' });
    if (sala.jugadores.size >= MAX_JUGADORES) return r({ ok: false, error: 'La sala está llena' });

    const host = io.sockets.sockets.get(sala.host);
    if (!host) return r({ ok: false, error: 'El anfitrión no está conectado' });
    try {
      const nombre = limpiarNombre(datos.nombre);
      const resp = await host.timeout(3000).emitWithAck('jugador:solicitud', { id: socket.id, nombre, token, reconectar: sala.bloqueada });
      if (!resp || !resp.ok) return r({ ok: false, error: (resp && resp.error) || 'No se pudo entrar' });
      if (!socket.connected) { host.emit('jugador:salio', { id: socket.id }); return; }
      sala.jugadores.add(socket.id);
      socket.data = { rol: 'jugador', sala: codigo };
      socket.join(codigo);
      r({ ok: true, id: socket.id, slot: resp.slot, personaje: resp.personaje, pid: resp.pid, color: resp.color, nombre: resp.nombre || nombre, reconectado: !!resp.reconectado });
      host.emit('jugador:entro', { id: socket.id }); // ya está en la sala: el host puede difundir el estado
      console.log(`[sala ${codigo}] entró ${nombre} (${resp.personaje})`);
    } catch {
      r({ ok: false, error: 'El anfitrión no responde' });
    }
  });

  // 4. Jugador: inputs del mando (dirección y botones). Se limpian y se reenvían al host.
  socket.on('jugador:input', (d = {}) => {
    if (socket.data.rol !== 'jugador') return;
    const sala = salas.get(socket.data.sala);
    if (!sala) return;
    if (d.t === 'dir') {
      io.to(sala.host).emit('jugador:input', { id: socket.id, t: 'dir', x: numero(d.x), y: numero(d.y) });
    } else if (d.t === 'btn' && (d.b === 'A' || d.b === 'B')) {
      io.to(sala.host).emit('jugador:input', { id: socket.id, t: 'btn', b: d.b, d: !!d.d });
    } else if (d.t === 'emote') {
      const ahora = Date.now();
      if (ahora - (socket.data.ultimoEmote || 0) < 800) return;      // evita spam de emotes
      socket.data.ultimoEmote = ahora;
      io.to(sala.host).emit('jugador:input', { id: socket.id, t: 'emote', e: Math.max(0, Math.min(4, Number(d.e) || 0)) });
    }
  });

  // 5. Desconexiones
  socket.on('disconnect', () => {
    const { rol, sala: codigo } = socket.data;
    const sala = salas.get(codigo);
    if (!sala) return;
    if (rol === 'host') {
      socket.to(codigo).emit('sala:cerrada');
      for (const id of sala.jugadores) {
        const s = io.sockets.sockets.get(id);
        if (s) { s.leave(codigo); s.data = {}; }
      }
      salas.delete(codigo);
      console.log(`[sala ${codigo}] cerrada`);
    } else if (rol === 'jugador') {
      sala.jugadores.delete(socket.id);
      io.to(sala.host).emit('jugador:salio', { id: socket.id });
    }
  });
});

// 6. Arranque --------------------------------------------------------------
servidor.listen(PUERTO, () => {
  console.log('\n  NEBULA PARTY listo');
  console.log(`  Anfitrión (PC):   http://localhost:${PUERTO}`);
  console.log(`  Mandos (celular): http://${ipLocal()}:${PUERTO}/controller.html`);
  console.log('  (El PC y los celulares deben estar en la misma red WiFi)\n');
});
