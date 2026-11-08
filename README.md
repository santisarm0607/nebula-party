# 🪐 Nebula Party

Party game galáctico en pixel art para **2 a 8 jugadores**. Tablero con dado de 10 caras en 3D, cuatro mundos, una estrella fugaz que hay que atrapar y **12 minijuegos** (2D con objetos 3D y 3D). Los celulares son los controles: se agita para lanzar el dado y se inclina para manejar.

**Jugar:** https://santisarm0607.github.io/nebula-party/

Hecho por **David Santiago Sarmiento Salguero (SantiSarm)**, Ingeniería Multimedia, Universidad Simón Bolívar (Cúcuta).

## Modos de juego

| Modo | Cómo funciona |
|---|---|
| **Prueba con bots** | Tú contra 3 o 7 bots. |
| **Todos en una pantalla** | La PC o el TV muestra un QR. Cada uno lo escanea con la cámara y su celular queda como control (hasta 8). También hay un botón para jugar con el teclado del PC (hasta 4). |
| **Multijugador** | A distancia: el anfitrión toca *Invitar a distancia* y manda el enlace. Cada invitado ve el juego en su propia pantalla (no es video: su pantalla lo dibuja) y juega con su control. Se puede mezclar con gente que escaneó el QR. |

Los puestos vacíos los juegan bots. Se elige el total (4 u 8), el mundo y las rondas (6, 10, 15 o 20).

## Cómo se juega

- En tu turno **agitas el celular** (o tocas el botón / Espacio) y avanzas casilla por casilla. En los atajos rojos eliges el camino.
- Casillas: azul +3 monedas, roja −3, evento (!) con carta sorpresa, regla del mundo (rombo), observatorio (telescopio) y **duelo (VS)** 1 contra 1.
- La **estrella fugaz** cae en el mapa y salta cada ronda. Si la alcanzas, presiona justo en la zona verde para atraparla (la *Red grande* cuesta 10 monedas y duplica la zona).
- Al final de cada ronda una ruleta escoge un minijuego. También salen duelos y minijuegos relámpago.
- Gana quien tenga más estrellas; si empatan, más monedas.

### Mundos
Glaciar Cristal (hielo resbaloso), Jungla Alien (lianas), Volcán Magma (erupciones) y Ciudad Neón (casino).

### Minijuegos
Duelo de rayos, Lluvia de meteoritos, Cosecha de polvo estelar, Rayo tractor, Memoria de constelaciones, Carrera de cohetes, Pinta el planeta, Cuenta los aliens (2D + objetos 3D), Sumo planetario, Hexágonos que caen, Túnel de asteroides y Equilibrio en el meteorito (3D).

## Controles

| | Celular | Teclado del PC |
|---|---|---|
| Moverse | Cruceta (o inclinar en Túnel y Equilibrio) | J1 W A S D · J2 flechas · J3 I J K L · J4 numérico 8 4 5 6 |
| Acción / dado | Botón A / agitar | J1 Espacio · J2 Enter · J3 O · J4 0 |
| Cámara del tablero | — | M ver mapa · C centrar · + / − zoom · arrastrar con el ratón |
| Pausa | — | Esc o P |

**Inclinar:** antes del minijuego se toca LISTO con el celular como te quede cómodo; esa posición es el "centro". Desde ahí, inclinarlo mueve hacia ese lado. *Re-centrar* lo vuelve a guardar.

## Estructura

```
index.html          juego (pantalla grande / anfitrión / invitado a distancia)
control.html        control del celular
css/style.css       estilos del juego
css/control.css     estilos del control
js/script.js        menú, personajes, mundos, tablero, dado, turnos, casillas, podio
js/minijuegos.js    motor y los 12 minijuegos, objetos 3D del tablero
js/agitar.js        sensores: agitar e inclinar (con "centro")
js/red.js           sala con QR, mandos y envío del estado a los invitados a distancia
js/espejo.js        pantalla del invitado a distancia
js/control.js       lógica del control del celular
img/personajes/     8 personajes (hojas de 6 cuadros de 32 px)
libs/               Three.js, PeerJS y qrcode-generator (licencia MIT, ver libs/LEEME.txt)
NOTAS.md            historial de versiones
```

## Publicar o probar

- **GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` / `(root)` → Save. "Enforce HTTPS" marcado (los sensores del celular necesitan HTTPS).
- **Probar en la PC:** abre la carpeta con *Live Server* de VS Code. Si abres `index.html` con doble clic, el navegador bloquea las imágenes dentro del 3D.
- Los modos con celular necesitan internet: PeerJS usa su servidor gratuito solo para que los aparatos se encuentren y luego se conectan directo. Algunas redes muy cerradas pueden bloquearlo; en ese caso, usar datos móviles.
