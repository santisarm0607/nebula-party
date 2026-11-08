/* =========================================================
   NEBULA PARTY - agitar.js
   Detecta cuando alguien agita el celular (sensor de movimiento).
   Lo usan la pantalla del juego (index.html) y el control (control.html).
   ========================================================= */
'use strict';

const Agitar = {
  activo: false,
  energia: 0,          // 0 a 1: qué tan fuerte se está agitando
  ultimo: null,        // última lectura del sensor
  alAgitar: null,      // función que se llama cuando la sacudida es suficiente
  alCambiar: null,     // función que recibe la energía mientras se agita
  permitido: false,
  bloqueadoHasta: 0,
  continuo: null,      // modo "agitar seguido" (Carrera de cohetes): recibe la fuerza de cada sacudida

  // ¿Este aparato tiene sensor de movimiento? (celulares y tablets)
  disponible() {
    return 'DeviceMotionEvent' in window && window.matchMedia('(pointer: coarse)').matches;
  },

  // Solo el iPhone/iPad pide permiso (y hay que pedirlo desde un toque del usuario).
  // Android entrega el sensor sin preguntar.
  esIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },
  necesitaPermiso() {
    return this.esIOS() && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function' && !this.permitido;
  },

  async pedirPermiso() {
    if (!this.necesitaPermiso()) { this.permitido = true; return true; }
    try {
      this.permitido = (await DeviceMotionEvent.requestPermission()) === 'granted';
      // En iPhone la inclinación es otro permiso; se pide en el mismo toque
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        await DeviceOrientationEvent.requestPermission();
      }
    } catch (e) {
      this.permitido = false;
    }
    return this.permitido;
  },

  empezarContinuo(alEmpujar) { this.continuo = alEmpujar; this.ultimo = null; },
  pararContinuo() { this.continuo = null; },

  empezar(alAgitar, alCambiar) {
    this.alAgitar = alAgitar;
    this.alCambiar = alCambiar || null;
    this.energia = 0;
    this.ultimo = null;
    this.activo = true;
  },

  parar() {
    this.activo = false;
    this.energia = 0;
    if (this.alCambiar) this.alCambiar(0);
  },

  // Cada lectura compara la aceleración con la anterior: cambios bruscos = sacudida
  leer(e) {
    if (!this.activo && !this.continuo) return;
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x === null) return;
    const ahora = performance.now();
    if (this.ultimo) {
      const cambio = Math.abs(a.x - this.ultimo.x) + Math.abs(a.y - this.ultimo.y) + Math.abs(a.z - this.ultimo.z);
      const dt = Math.min(0.1, (ahora - this.ultimo.t) / 1000) || 0.016;
      if (this.continuo) this.continuo(Math.max(0, cambio - 14));
      if (!this.activo) { this.ultimo = { x: a.x, y: a.y, z: a.z, t: ahora }; return; }
      // Solo cuentan los movimientos fuertes; la energía baja sola si dejas de agitar
      this.energia = Math.max(0, this.energia - dt * 0.9) + Math.max(0, cambio - 14) * 0.0025;
      this.energia = Math.min(1, this.energia);
      if (this.alCambiar) this.alCambiar(this.energia);
      if (this.energia >= 1 && ahora > this.bloqueadoHasta) {
        this.bloqueadoHasta = ahora + 1500;
        this.activo = false;
        if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
        const f = this.alAgitar;
        this.energia = 0;
        if (this.alCambiar) this.alCambiar(0);
        if (f) f();
      }
    }
    this.ultimo = { x: a.x, y: a.y, z: a.z, t: ahora };
  }
};

window.addEventListener('devicemotion', (e) => Agitar.leer(e));

/* ---------- Inclinación del celular (Túnel y Equilibrio) ----------
   "Centrar" guarda cómo tienes el celular en ese momento: desde ahí,
   inclinarlo a la derecha da x positivo y hacia adelante da y positivo.
   Así cada uno lo sostiene como le quede cómodo. */
const Inclinar = {
  base: null, ultimo: null, pendiente: false, x: 0, y: 0, alCambiar: null,
  GRADOS: 25, // cuántos grados de inclinación equivalen a "todo a un lado"

  centrar() {
    if (this.ultimo) { this.base = { b: this.ultimo.b, g: this.ultimo.g }; this.pendiente = false; }
    else this.pendiente = true; // se centra con la primera lectura que llegue
    this.x = 0; this.y = 0;
  },

  leer(e) {
    if (e.beta === null || e.beta === undefined) return;
    this.ultimo = { b: e.beta, g: e.gamma };
    if (this.pendiente) this.centrar();
    if (!this.base) return;
    const limitar = (v) => Math.max(-1, Math.min(1, v));
    this.x = limitar((e.gamma - this.base.g) / this.GRADOS);
    this.y = limitar((this.base.b - e.beta) / this.GRADOS);
    if (this.alCambiar) this.alCambiar(this.x, this.y);
  }
};
window.addEventListener('deviceorientation', (e) => Inclinar.leer(e));
