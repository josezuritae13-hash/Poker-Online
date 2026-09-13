# Poker Online — Texas Hold'em

Proyecto de póker privado entre amigos usando solamente fichas ficticias.

## Diseño de datos y privacidad

- No hay cuentas de usuario.
- No existe wallet, balance, banco, inventario permanente, estadísticas, ranking ni historial económico.
- El identificador y el nombre temporal se guardan solo en `sessionStorage` para mantener la sesión de esa pestaña.
- Firebase contiene únicamente el estado temporal de la sala/partida mientras está activa.
- Al terminar la partida, el cliente elimina la sala completa después de mostrar el resultado durante unos segundos.
- Las salas abandonadas tienen una expiración de 6 horas y se limpian cuando otro cliente las comprueba.

## Configuración del host

Antes de empezar, el host puede configurar:

- Máximo de jugadores (2–6).
- Small Blind.
- Big Blind.
- Valor de cada tipo de ficha.
- Cantidad total disponible de cada tipo de ficha.
- Cantidad de cada tipo que recibe cada jugador.

La pila inicial por jugador se calcula automáticamente a partir de los valores y cantidades por jugador.

## Importante sobre seguridad

Este proyecto no usa Firebase Authentication porque el objetivo es entrar sin cuentas. Por eso las reglas no pueden demostrar criptográficamente qué navegador es el host. La interfaz restringe las funciones de host y valida el estado, pero esta arquitectura no ofrece protección anti-trampas de nivel servidor.

Además, para el prototipo actual las cartas privadas viven dentro del estado temporal de Firebase para permitir resolver el showdown con un único estado compartido. La interfaz solo muestra las cartas del jugador actual, pero un jugador con acceso técnico a la base de datos podría inspeccionar ese estado. Una versión anti-trampas real necesita una autoridad de servidor y separación de datos privados.

## Ejecución

No hace falta npm. Usa Live Server, un servidor estático local o Netlify.

1. Comprueba `js/firebase/config.js`.
2. Publica `FIREBASE_RULES.txt` en Realtime Database.
3. Abre `index.html` desde un servidor (no `file://`).
4. Crea una sala y comparte el código.

## Estructura

```text
poker-online/
├── index.html
├── pages/
│   ├── lobby.html
│   └── game.html
├── css/
│   └── style.css
├── js/
│   ├── index.js
│   ├── lobby.js
│   ├── game.js
│   ├── firebase/
│   ├── poker/
│   └── utils/
├── assets/
│   ├── cards/
│   ├── chips/
│   ├── board/
│   ├── icons/
│   ├── sounds/
│   ├── backgrounds/
│   └── ui/
├── firebase.rules.json
├── FIREBASE_RULES.txt
├── netlify.toml
└── README.md
```
