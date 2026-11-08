# Nebula Party - Notas de versiones

## v0.1 - Interfaz (06/11/2026)
- Menú principal con 3 modos (Multijugador marcado como "Próximamente") y Opciones.
- Escoger personaje estilo Mario Party: cursores de color por jugador, paneles abajo, bots que eligen solos.
- Escoger mundo (4 mundos) y número de rondas (10, 15 o 20).
- Tablero base en Canvas con casillas (azul, roja, evento, estrella) y HUD de los 4 jugadores.
- Pausa (Esc o P) y opciones (volumen de efectos, reducir animaciones, pantalla completa) guardadas en LocalStorage.

Archivos: index.html, css/style.css, js/script.js, img/personajes/*.png (hojas de 6 cuadros de 32 px).
Pendiente: dado y reglas del tablero, minijuegos, conexión con celulares por QR, sonidos reales.

## v0.2 - Estilo pixel arcade (06/11/2026)
- Todo el juego pasa a estilo pixel: letra Press Start 2P, fondo índigo con cuadrícula y planetas, botones cuadrados con sombra dura.
- Título "NEBULA PARTY" con bordes cian y rosa y un pequeño glitch cada 4 s (se apaga con "Reducir animaciones").
- Menú nuevo: Jugar, Cómo jugar, Ajustes, Récords y Créditos. Se navega con flechas y Enter o con el ratón.
- Nueva pantalla "Escoge el modo" (Jugar → modos → personajes).
- Ventanas nuevas: Cómo jugar, Récords (victorias por personaje en LocalStorage) y Créditos.
- Se quitó el desfile de personajes del menú.

## v0.3 - Mundos grandes (06/11/2026)
- Pantalla "Elige el mundo" nueva: 4 tarjetas con mini mapa en pixel art, número de casillas, rombo con ícono y regla especial. Botones Atrás, Al azar y ¡Jugar aquí!. Rondas encima de los botones.
- Mundos nuevos: Glaciar Cristal (116 casillas), Jungla Alien (100), Volcán Magma (78) y Ciudad Neón (99). Reemplazan a los 4 anteriores.
- Los mapas se generan en script.js (construirMapa): anillo con la forma de la isla + atajos en rojo que crean bifurcaciones. Cada casilla guarda "sig" (a dónde se puede avanzar), listo para el dado.
- Casilla nueva "M" con la regla del mundo (las reglas se activan cuando hagamos el dado).
- Tablero con cámara: sigue al jugador del turno, se arrastra con ratón o dedo, rueda o +/- para zoom, botones Ver mapa (M) y Centrar (C).
- Adornos por mundo (cristales, árboles y hongos, volcancitos y lava, edificios con luces) y partículas (nieve, luciérnagas, chispas, destellos).

## v0.4 - Dado de 10 caras y turnos (07/11/2026)
- Dado d10 en 3D con Three.js (r128 desde cdnjs): forma real de trapezoedro pentagonal, 10 caras con números del 1 al 10 en letra pixel, del color del jugador. El 6 y el 9 llevan rayita.
- Animación: el dado gira mientras espera, al lanzarlo da vueltas rápidas, rebota y se acomoda con el resultado de frente. Con "Reducir animaciones" va directo al resultado.
- Se lanza con el botón, Espacio/Enter o tocando el dado. Los bots lanzan solos.
- El personaje avanza casilla por casilla saltando y la cámara lo sigue. En los atajos sale "¿Por dónde sigues?" (botones, flechas + Enter o tocar la flecha del mapa).
- Turnos de los 4 jugadores, sube la ronda y al final de las rondas aparece "¡Se acabaron las rondas!".
- Si Three.js no carga (sin internet), el dado muestra los números en 2D para que el juego siga funcionando.
- Pendiente: efectos de las casillas (monedas, estrellas, eventos), reglas de cada mundo y minijuegos.

## v0.5 - Casillas, estrella fugaz y podio (07/11/2026)
- Casilla azul +3 monedas, roja -3 (nunca menos de 0). Números flotantes sobre el personaje y el HUD da un saltito.
- Carta de evento (!) al azar: lluvia de meteoritos dorados (+5), cometa veloz (+3 casillas), agujero negro (casilla al azar), robo cósmico (quitas 3 a otro) e intercambio (cambias de lugar).
- Reglas de los mundos: hielo (+2 casillas), lianas (salto largo de 4), erupción (tiembla y los demás pierden 2) y casino (ruleta: +6 o -4).
- Estrella fugaz (mecánica propia): cae en una casilla al azar y salta a otro lugar cada ronda. Al caer o pasar por ella hay un reto de reflejos (presionar en la zona verde, un intento). Red grande por 10 monedas = zona doble.
- Observatorios (casillas amarillas, ícono de telescopio): muestran la estrella y por 8 monedas te teletransportan a 3 casillas de ella.
- Fin de partida: podio con los 4 personajes (gana quien tenga más estrellas; empate por monedas), se guarda la victoria en Récords. Botones Jugar otra vez y Volver al menú.
- Esperas con pausa (esperarSeg) para que todo se congele al pausar.

## v0.6 - Minijuegos y objetos 3D (07/11/2026)
- Archivo nuevo js/minijuegos.js (se carga después de script.js).
- Al final de cada ronda: ruleta 3D, pantalla de instrucciones con los controles de cada jugador, cuenta 3-2-1, minijuego, "¡FIN!" en cámara lenta y resultados. Premios: +10, +6, +3, 0.
- Controles: J1 W A S D + Espacio, J2 flechas + Enter, J3 I J K L + O, J4 numérico 8 4 5 6 + 0. Con bots, J1 también usa flechas + Enter. En celular: cruceta y botón A en pantalla.
- 5 minijuegos 2D con objetos 3D: Duelo de rayos (orbe 3D), Lluvia de meteoritos (rocas 3D), Cosecha de polvo estelar (cristales 3D), Rayo tractor (naves 3D, 2 contra 2) y Memoria de constelaciones (esferas 3D).
- 3 minijuegos 3D: Sumo planetario, Hexágonos que caen (3 pisos) y Túnel de asteroides. Los personajes son sprites pixel dentro del 3D.
- Tablero: estrella fugaz 3D, tragamonedas 3D en el casino de Ciudad Neón y copa 3D en el podio.
- Si Three.js no carga, los minijuegos 3D no salen en la ruleta y los objetos 3D se dibujan en 2D.
- Importante: para probar en la PC usa Live Server de VS Code (o GitHub Pages). Si abres index.html con doble clic, el navegador bloquea los personajes dentro del 3D.

## v0.6.1 - Personajes sobre su casilla (07/11/2026)
- posJugador (script.js): los pies de cada personaje quedan en el centro de su casilla. Si varios comparten casilla se reparten (GRUPOS) en vez de usar siempre 4 lugares fijos.
- El salto entre casillas termina justo donde el personaje se queda parado (ya no hay "brinco" al llegar).

## v0.7 - Agitar el celular y modo Multijugador (07/11/2026)
Archivos nuevos: js/agitar.js, js/red.js, control.html, js/control.js y css/control.css.
- Agitar (agitar.js): detecta la sacudida con el sensor de movimiento. Mientras agitas, el dado tiembla y gira más rápido; al agitar lo suficiente se lanza y el celular vibra. El botón "Lanzar dado" sigue como respaldo.
- Parte 1: si el juego corre en un celular o tablet, en tu turno lanzas agitándolo. En Ajustes: "Lanzar el dado agitando el celular" (encendido/apagado) y "Activar sensor (iPhone)".
- Parte 2 - Multijugador (red.js): la PC crea una sala con PeerJS y muestra un QR y un código de 4 letras. Cada celular abre control.html (cámara o escribiendo el código) y queda como J1 a J4; los puestos vacíos los juegan bots.
- El celular muestra lo que le toca: elegir personaje con cruceta y A, "¡Agita para lanzar!" en su turno, botones para elegir camino o decidir (Red grande, teletransporte), botón gigante ¡ATRAPAR! en el reto y cruceta + A en los minijuegos. Vibra cuando le toca.
- Si un celular se desconecta, un bot juega por él; si vuelve a escanear el QR, recupera su puesto.
- Librerías por CDN: PeerJS 1.5.4 y qrcode-generator 1.4.4 (jsDelivr).
- Importante: el modo Multijugador funciona publicado en GitHub Pages (HTTPS) con internet. En la vista previa de Claude no puede conectarse.
- Para pruebas con servidor propio: index.html?peerhost=127.0.0.1&peerport=9000.

## v0.8 - Más minijuegos, duelos y sensores (07/11/2026)
- Casilla de duelo (naranja, "VS"): eliges rival y juegan un minijuego 1 contra 1. El ganador le quita 5 monedas al otro. Los que miran pueden apostar desde su celular (+2 monedas si aciertan).
- Carta de evento "Minijuego relámpago": todos juegan en ese momento; el ganador gana 5 monedas.
- 4 minijuegos nuevos (ahora son 12): Carrera de cohetes (agitar el celular o presionar rápido), Equilibrio en el meteorito (3D, inclinar), Pinta el planeta (2D) y Cuenta los aliens (2D + naves 3D).
- Túnel de asteroides: se maneja inclinando el celular como un timón y los bots ya no son perfectos (ven tarde los anillos, apuntan con error, a veces se distraen o no esquivan).
- "Centro" de la inclinación (agitar.js → Inclinar): al tocar LISTO (celular) o ¡Empezar! (mismo aparato) se guarda cómo tienes el celular en ese momento; desde ahí, inclinarlo mueve hacia ese lado. Botón Re-centrar para volver a guardarlo.
- Hexágonos: los pisos que quedan encima de alguien se vuelven casi transparentes, la cámara baja al piso donde estás y cada personaje tiene una flecha de su color que se ve siempre (en todos los minijuegos 3D).

## v0.9 - Hasta 8 jugadores (07/11/2026)
- Total de jugadores 4 u 8 (selector "Total" al escoger personaje). Los puestos sin persona los juegan bots. Con 8, por defecto se juegan 6 rondas (se puede cambiar; nuevo botón de 6 rondas).
- Colores nuevos para J5 a J8: morado, rosa, cian y amarillo limón.
- Multijugador: sala de 8 puestos; si entran más de 4 celulares, la partida pasa sola a 8.
- Tablero: con 8, las tarjetas van en una barra arriba; hasta 8 personajes se acomodan en la misma casilla; los turnos de los bots son más rápidos.
- Los 12 minijuegos se adaptan a 2-8 jugadores (Rayo tractor: equipos impares contra pares). Premios con 8: +10, +8, +6, +4, +2.
- Podio con 8: los 3 primeros arriba y del 4.º al 8.º en una lista.
- Corrección: después de hacer clic en los botones de cantidad, Espacio y Enter vuelven a elegir personaje.

## v0.9.1 - Modos reorganizados (07/11/2026)
- "Todos en una pantalla" ahora abre la sala con QR: la PC o TV es la pantalla grande y los celulares son los controles (hasta 8). El QR ya lleva el código de la sala: con la cámara se entra solo, sin escribir nada ni pasar enlaces.
- En la sala hay un botón "Jugar con teclado (sin celulares)" para jugar hasta 4 en el mismo PC.
- "Multijugador" queda como "Próximamente: jugar a distancia".
- Sala con los 8 puestos en 2 columnas.

## v1.0 - Multijugador a distancia (07/11/2026)
Archivo nuevo: js/espejo.js (pantalla del invitado). Se agregó la sección 5 de red.js (lo que manda el anfitrión).
- Multijugador: el anfitrión entra a Multijugador (o a Todos en una pantalla) y toca "Invitar a distancia". El enlace (index.html?unirse=CODIGO) se comparte por WhatsApp o se copia.
- Sin video: el anfitrión corre el juego y ~10 veces por segundo manda el ESTADO (fichas, dado, monedas, textos y todo lo de cada minijuego). La pantalla del invitado lo dibuja con el mismo código, en su propia resolución, y suaviza los movimientos entre una foto y otra.
- El dado y los sonidos llegan al instante como eventos. Los textos y ventanas (mensajes, cartas, reto, instrucciones, resultados, podio) se copian tal cual.
- Cada invitado tiene su cámara propia en el tablero (Ver mapa, Centrar, zoom con M, C, + y -).
- El control del invitado es control.html en un recuadro: en PC se juega con W A S D / flechas + Espacio / Enter (los números eligen opciones); en celular se toca, se agita y se inclina igual que con el QR.
- Se puede mezclar: gente en la sala escaneando el QR y gente a distancia, hasta 8. Los puestos vacíos los juegan bots.
- Los minijuegos con objetos que aparecen (rocas, cristales, asteroides, naves) tienen mallaPara/firmaMalla para que el invitado reconstruya sus objetos 3D.

## v1.0.1 - Listo para GitHub Pages (07/11/2026)
- Three.js, PeerJS y el generador de QR van dentro de libs/ (ya no dependen de otros servidores). Licencias en libs/LEEME.txt.
- README.md con modos, controles, estructura y cómo publicar. Archivo .nojekyll para GitHub Pages. Ícono de la pestaña (🪐).
- Prueba final sin ayudas: anfitrión + celular por QR + invitado a distancia jugaron una ronda completa con minijuego hasta el podio, sin archivos faltantes ni errores.
