# Nebula Party

Party game multijugador: el navegador del PC es el anfitrión y los celulares son los mandos.

## Cómo correrlo
1. Instala Node.js 18 o superior.
2. En la carpeta del proyecto (terminal de VS Code): `npm install` y luego `npm start`.
3. En el PC abre `http://localhost:3000`.
4. En el celular (misma WiFi) escanea el QR del lobby o abre la dirección que sale en la terminal.

Si Windows pregunta por el firewall, dale **Permitir** a Node.js.

## Cómo se juega
- Elige modo (Prueba con bots, Multijugador o Todos en una pantalla), personaje y mundo (4 islas grandes con formas distintas).
- Lanza el dado de 10 caras, junta monedas y **compra estrellas (20 monedas)**. Gana quien tenga más estrellas.
- Tiendas con objetos (dado doble, dado +3, escudo, ladrón, teletransporte), cruces con atajos y eventos sorpresa.
- Después de cada ronda, la ruleta elige uno de 6 minijuegos.
- Al final hay premios bonus, podio, estadísticas y récords.

## Teclado
- **1 jugador:** FLECHAS para moverte · ESPACIO = botón A · B = botón B · E = emote.
- **2 jugadores:** J1 = WASD + ESPACIO (A) + Q (B) · J2 = FLECHAS + ENTER (A) + SHIFT DERECHO (B).
- **P** = pausa. Antes de cada minijuego hay un tutorial para probar las teclas.

## Estructura
- `server.js`: salas, inputs, emotes y reconexión.
- `public/js/Sprites.js`: pixel art de los personajes (PC y celular).
- `public/js/host/Engine.js`: motor, audio, estados, tablero, tienda, estrellas y podio.
- `public/js/host/Minigame.js`: ruleta y los 6 minijuegos.
- `public/js/controller/MobileInputs.js`: mando táctil.
