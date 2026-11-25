<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f5bd1837fe274a15d10059730f94c8741693cf9ad5d899da7a6f94a87ea12f59 -->

# MuGro-up'

Juego 3D para navegador e instalación Web/APKweb (PWA). Importado desde el proyecto original en la revisión `936e05ca3f82f5458434d2dc05acd339f046bfeb`.

## Arrancar

Requiere Node 24 y Bun 1.4.2.

```sh
bun install --frozen-lockfile
bun run dev
```

Abre `http://localhost:3000/`. La cuenta de demostración local es `lorencia` / `123456`. Crea tu propia cuenta para guardar una partida personal.

```sh
bun run typecheck:app
bun run verify:flyff
bun run build
bun run test:release
bun run start
```

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:944843e23123a58d7c01f55925e143341d81c46622bcb97b371e59d726827459 -->

GitHub Actions comprueba el proyecto y genera un artefacto descargable llamado **mugroup-web**. Para publicar el juego, abre **Settings → Pages** en el repositorio y elige **GitHub Actions** como fuente. En GitHub Free, Pages requiere un repositorio público; para conservarlo privado se necesita un plan compatible. Cambiar la visibilidad publica el código y sus recursos: el propietario debe decidirlo. Si Pages no está configurado, la compilación se conserva y la publicación mostrará el paso pendiente.

La Web y la PWA comprueban actualizaciones de la ubicación instalada al recuperar la conexión. En **Web / APKweb → Comprobar descarga sin conexión**, espera a que se complete la primera instalación antes de cerrar el juego. La partida se guarda por origen del navegador; para trasladarla del sitio anterior al nuevo, exporta e importa el archivo local o usa la copia privada.

<!-- /coderabbit-ai-generated:v1 -->

## Copia privada y salas

Pages hospeda el juego estático. Para sincronizar partidas desde Pages, ejecuta el servidor Node en un servicio HTTPS, con `MU_BACKUP_DIR` apuntando a un volumen persistente y `MU_BACKUP_ORIGINS` con los orígenes autorizados, separados por comas. Pon la URL en **Web / APKweb**, crea una copia y guarda el código de recuperación. El cliente sincroniza solo la cuenta activa y cifra la cuenta, los personajes y su equipo antes de transmitirlos; GitHub recibe código y compilaciones. Para recuperar desde otro dispositivo, abre el panel, indica el mismo servidor y restaura con el código; luego puedes restablecer la contraseña mediante tus preguntas de recuperación.

En una LAN, abre el juego desde el mismo servidor y puerto en todos los dispositivos y comparte el código de sala. Bluetooth del navegador puede seleccionar periféricos GATT compatibles; las salas en tiempo real usan WebSocket por Wi-Fi. El modo de un jugador y el Oráculo de consejos funcionan en la PWA sin conexión una vez instalada.

## Contenido y ajustes

- `ADMIN/world-rules.json`: radio de detalles, velocidad base, ajustes de mapas y radio seguro de hasta 500 m. Las capitales bloquean el combate y la entrada de monstruos.
- `ADMIN/monsters.json`: `groups` permite elegir `map`, `monsterId`, `x`, `z`, `count`, `roamRadius`, `hp`, `damage`, `xp`, `zen`, `respawnSeconds` y los tipos de botín en `drops`. Las coordenadas de juego van de 0 a 3072. <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:57f43f7004c1726d944e22624258302cd11233e56d543e0ecf94c4ff791d49a2 -->

Los grupos no aparecen dentro de una capital. En `drops` puedes usar también identificadores de equipo, como `shop_sw_dragon`; la pieza recogida se guarda en la mochila. En `ADMIN/item-options.json`, `byItem` acepta esos mismos identificadores para ajustar daño, defensa, magia, precio, suerte y opción excelente de las nuevas piezas. Por ejemplo: `"byItem": {"shop_sw_dragon": {"luck": false, "excellentOpt": ""}}`.

<!-- /coderabbit-ai-generated:v1 -->
- `ADMIN/npcs.json`: ubicación y rol del comerciante. Opcionalmente, `stock` es un objeto con identificadores del catálogo como claves y precios enteros en Zen como valores.
- `ADMIN/items.json` y `ADMIN/item-options.json`: multiplicador de precio y aspecto de mejoras, brillos y alas. Los 40 conjuntos artesanales comparten modelos de armadura existentes con acabados distintos y armas originales generadas por el juego.
- **Ajustes → Editar botones HUD**: selecciona la tarjeta de objetivo o el cuadro de daño para redimensionarlo. Puedes arrastrar ambos y mover la barra con su asa.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4dc51e6d720b2ec4a53a588044e5c337dc018ac91489ef11513a5d9cae616cd6 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:e1d6e24c87f4b275534c371071376868cab3b523b572817aabc5998c831a3e99 -->

ADMIN se edita únicamente en el repositorio. Publica una nueva compilación para distribuir los cambios. En el juego, Hellpe activa el ataque automático y Combo elige la secuencia. En APKweb, espera a que finalice la descarga antes de desconectarte.

Cada región incluye 4.000 campamentos de diez monstruos y los grupos adicionales configurados en ADMIN. Las posiciones se generan por mapa y solo se cargan modelos cerca del jugador. En `world-rules.json`, `stripManmadeStructures` permite ocultar construcciones si se prefiere.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c4607456c9863d5858b43456bef0531d68dd533569528d7c7ead524e1b583273 -->

La dirección prevista de la nueva instalación es [Mu-GruoUp-V1](https://faneittealejandro501.github.io/Mu-GruoUp-V1/). Antes de retirar la PWA anterior, abre **Web / APKweb → Exportar Respaldo (.json)** allí. En la nueva instalación, usa **Importar Respaldo (.json)** y comprueba tus personajes e inventario.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

La [integración anterior](INTEGRACION-RECURSOS.md) se conserva como registro histórico. Los avisos de los recursos importados se conservan en `public/mugroup/licencias/`. Se mantuvieron recursos ya incluidos en el proyecto; el archivo externo de referencia no se incorporó en bloque.


<!-- /coderabbit-ai-generated:v1 -->