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

GitHub Actions genera `dist/` y lo publica en GitHub Pages al actualizar la rama principal. Para activar Pages, el repositorio debe usar **GitHub Actions** como fuente. La Web y la PWA comprueban actualizaciones de la ubicación instalada al recuperar la conexión. En **Web / APKweb → Comprobar descarga sin conexión**, espera a que se complete la primera instalación antes de cerrar el juego. La partida se guarda por origen del navegador; para trasladarla del sitio anterior al nuevo, exporta e importa el archivo local o usa la copia privada.

## Copia privada y salas

Pages hospeda el juego estático. Para sincronizar partidas desde Pages, ejecuta el servidor Node en un servicio HTTPS, con `MU_BACKUP_DIR` apuntando a un volumen persistente y `MU_BACKUP_ORIGINS` con los orígenes autorizados, separados por comas. Pon la URL en **Web / APKweb**, crea una copia y guarda el código de recuperación. El cliente sincroniza solo la cuenta activa y cifra la cuenta, los personajes y su equipo antes de transmitirlos; GitHub recibe código y compilaciones. Para recuperar desde otro dispositivo, abre el panel, indica el mismo servidor y restaura con el código; luego puedes restablecer la contraseña mediante tus preguntas de recuperación.

En una LAN, abre el juego desde el mismo servidor y puerto en todos los dispositivos y comparte el código de sala. Bluetooth del navegador puede seleccionar periféricos GATT compatibles; las salas en tiempo real usan WebSocket por Wi-Fi. El modo de un jugador y el Oráculo de consejos funcionan en la PWA sin conexión una vez instalada.

## Contenido y ajustes

- `ADMIN/world-rules.json`: radio de detalles, velocidad base, ajustes de mapas y radio seguro de hasta 500 m. Las capitales bloquean el combate y la entrada de monstruos.
- `ADMIN/monsters.json`: `groups` permite elegir `map`, `monsterId`, `x`, `z`, `count`, `roamRadius`, `hp`, `damage`, `xp`, `zen`, `respawnSeconds` y los tipos de botín en `drops`. Las coordenadas de juego van de 0 a 3072. Los grupos no aparecen dentro de una capital.
- `ADMIN/npcs.json`: ubicación y rol del comerciante. Opcionalmente, `stock` es un objeto con identificadores del catálogo como claves y precios enteros en Zen como valores.
- `ADMIN/items.json` y `ADMIN/item-options.json`: multiplicador de precio y aspecto de mejoras, brillos y alas. Los 40 conjuntos artesanales comparten modelos de armadura existentes con acabados distintos y armas originales generadas por el juego.
- **Ajustes → Editar botones HUD**: selecciona la tarjeta de objetivo o el cuadro de daño para redimensionarlo. Puedes arrastrar ambos y mover la barra con su asa.

Edita los archivos ADMIN y vuelve a compilar para publicar cambios generales. La edición dentro de la aplicación guarda preferencias solo en ese navegador.

La [integración anterior](INTEGRACION-RECURSOS.md) se conserva como registro histórico. Los avisos de los recursos importados se conservan en `public/mugroup/licencias/`. Se mantuvieron recursos ya incluidos en el proyecto; el archivo externo de referencia no se incorporó en bloque.


<!-- /coderabbit-ai-generated:v1 -->