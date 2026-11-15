/* =========================================================
   NEBULA PARTY - red-config.js  (conexión en cualquier red)
   La conexión entre aparatos intenta ir directo. Si la red la bloquea
   (WiFi de universidades, algunos operadores), pasa por un servidor TURN
   que hace de puente.
   PARA QUE FUNCIONE SIEMPRE: crea una cuenta gratis en
   https://www.metered.ca/stun-turn  y copia aquí tu "app" y tu "API key".
   ========================================================= */
'use strict';

const CONFIG_RED = {
  meteredApp: '',     // ejemplo: 'nebulaparty'  (de nebulaparty.metered.live)
  meteredApiKey: ''   // la API key que te da Metered
};

// Servidores básicos (gratis). Los de Open Relay son públicos y pueden fallar a veces.
const ICE_BASE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
];

let iceGuardados = null;
async function servidoresICE() {
  if (iceGuardados) return iceGuardados;
  iceGuardados = ICE_BASE;
  if (CONFIG_RED.meteredApp && CONFIG_RED.meteredApiKey) {
    try {
      const r = await fetch('https://' + CONFIG_RED.meteredApp + '.metered.live/api/v1/turn/credentials?apiKey=' + CONFIG_RED.meteredApiKey);
      const lista = await r.json();
      if (Array.isArray(lista) && lista.length) iceGuardados = lista.concat(ICE_BASE.slice(0, 2));
    } catch (e) { /* se usan los básicos */ }
  }
  return iceGuardados;
}

// Opciones de PeerJS con los servidores de puente incluidos
async function opcionesConexion(base) {
  return Object.assign({}, base, { config: { iceServers: await servidoresICE() } });
}
