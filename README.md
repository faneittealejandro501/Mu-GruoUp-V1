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

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:00b33e463a30285f0710d68d68a238beb8a801b8bcdd600e06af8b90aee6a3f2 -->

Abre `http://localhost:3000/`. Crea una cuenta para guardar una partida en el dispositivo. La web no muestra la lista de cuentas locales; la APKweb instalada puede recordar el último ID sin guardar la contraseña en el formulario.

### Administración en el juego

Configura en el servidor Node `MU_ADMIN_PASSWORD` con una contraseña nueva de al menos 16 caracteres, guardada como secreto del entorno. Abre el acceso del juego con el ID **Adonyhdp** y ese secreto. La cuenta de administración se recupera rotando el secreto del servidor. El panel permite editar estadísticas y grupos de monstruos, posiciones y tiendas de NPC, e invasiones. Al publicar, los clientes conectados consultan los cambios cada 15 segundos; el mapa activo retira monstruos, NPC y botín del suelo por dos segundos y vuelve a cargarlos. Los grupos manuales se añaden a las patrullas distribuidas por el mapa. Los inventarios, personajes y registros de jefes derrotados se conservan.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ac186358d1bcf506cf03e46ff86d500c0e7509d7a9a64dc212db056236a6d282 -->

El panel publica al servidor y la web y el APK reciben la revisión automáticamente. Para guardar un cambio también en el código fuente, usa **Exportar configuración para Git**, guarda el archivo como `ADMIN/live-world.json` y revisa el diff antes de publicarlo. La descarga contiene la configuración del mundo.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

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

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f3499918a1cde39fc6899a291a654fdd508cf10815c640cab5300caa5a4f0e4a -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:8bb92cff5402417bba038be5132ace540885350a2b9236e5b124af65f15d3513 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:43495f7f9916aa1d04a15a5b0d9548197ac5708a21e14d83139b56342f5e2c89 -->

GitHub Pages publica la web, el APK y `server-connection.json`. Ambos clientes leen ese archivo para encontrar el mismo servidor de cuentas y ADMIN. El APK también guarda la URL de la compilación como respaldo si la consulta no responde.

Sin servidor de cuentas, Actions también genera el APK y la web. El ID, los personajes y sus objetos quedan en el dispositivo o navegador donde juegas. Allí puedes recuperar el acceso con las dos respuestas locales. Para cambiar de dispositivo sin servidor, exporta el respaldo en **Web / APKweb** e impórtalo en el otro antes de iniciar sesión. Una instalación nueva no puede recuperar por ID una partida que nunca se respaldó.

En Android, el juego comprueba las actualizaciones al abrirlo. Desde la versión 2.13.2 también solicita a Android una comprobación periódica con red sin medición y espacio disponible. El cliente web verificado se activa al abrir el juego o tras guardar el progreso; los cambios en el código nativo requieren actualizar el APK.

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:6fa46c870e3a0432a8e8c3cd44b33987122cebc9c0e75233c12dd4dfacfd3a0d -->

1. En un servidor con Node 24 y Bun 1.4.2, obtén esta revisión y ejecuta `bun install --frozen-lockfile`, `bun run build` y `bun run start`. Pon un proxy HTTPS delante del puerto 3000 (o usa el puerto de tu hospedaje con `PORT`).

   También puedes crear el servicio con el Blueprint de Render incluido en `render.yaml` (instancia con disco de pago). Configura los dos secretos indicados en el paso 2 y conserva el disco al actualizar. Si ya tienes cuentas en otro servidor, conserva sus archivos y su clave de recuperación al migrar. El servicio queda listo cuando `/api/account-service` responde con estado 200.


<!-- /coderabbit-ai-generated:v1 -->
2. Configura `MU_BACKUP_DIR` y `MU_WORLD_FILE` en un volumen persistente. Habilita `MU_BACKUP_ORIGINS` y `MU_WORLD_ORIGINS` con `https://faneittealejandro501.github.io,https://apk.mugroup.invalid`. Genera `MU_RECOVERY_KEY` con `openssl rand -hex 32` y guarda una copia privada junto a los respaldos. Para ADMIN, configura una contraseña nueva con `MU_ADMIN_PASSWORD`.
3. En GitHub → Settings → Secrets and variables → Actions → Variables, define `VITE_BACKUP_URL` con el origen HTTPS del servidor, sin ruta final. Ejecuta **Deploy GitHub Pages**. Puedes verificar la conexión consultando `/Mu-GruoUp-V1/server-connection.json` en Pages y `/api/ota/manifest` en el servidor.

Las cuentas se verifican y respaldan de forma privada. Abre una cuenta existente en el dispositivo donde se creó y espera que sincronice; después podrás iniciar sesión con ese ID o recuperarlo con una sola respuesta y una contraseña nueva. Las preguntas se habilitan al volver a sincronizar. Si el servidor está apagado, se puede seguir jugando con una cuenta ya guardada en ese dispositivo. Con conexión el servidor reserva un ID por cuenta; si dos dispositivos crean el mismo ID sin conexión, el primer respaldo reserva el nombre. La otra partida queda en su dispositivo y puede exportarse desde **Web / APKweb**. Conserva el mismo origen y el mismo volumen al migrar el servidor.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:6d4621f0ebbef0e38453a7cb79cbd42dc2ed234dd03512e69ecc790578e90799 -->

## APK Android: cliente completo y multijugador local

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:e9b67157c3a6579bf4eb37ac6ac1124bd7b4f22c636e8be7c94ff39fad388160 -->

Pulsa **Descargar APK** para solicitar el instalador completo. **Instalar PWA** comprueba que todos los recursos estén guardados antes de ofrecer la instalación. El APK incluye el juego para el primer arranque sin internet y usa el mismo servidor de cuentas que la web.

<!-- /coderabbit-ai-generated:v1 -->

- **Wi-Fi local:** abre el APK en los dos dispositivos y conéctalos a la misma red o al punto de acceso del anfitrión. El anfitrión crea la sala y comparte la dirección IP que muestra el juego y el código. El invitado introduce ambos en **Salas locales → Wi-Fi local**. Usa IPv4 y el puerto TCP 32183; una red que aísla a sus clientes puede impedir la conexión.
- **Bluetooth directo:** empareja primero los dispositivos en **Ajustes de Android → Bluetooth**. En el APK, permite el acceso a dispositivos cercanos. El anfitrión crea una sala Bluetooth, y el invitado usa el código y selecciona el equipo anfitrión de la lista de dispositivos emparejados. No hace falta activar el Wi-Fi ni tener acceso a internet.
- **Web y PWA:** el modo de un jugador y el Oráculo de consejos funcionan sin conexión después de instalar la PWA y guardar el cliente. Para las salas en red local, abre el juego desde el mismo servidor Node y puerto en todos los dispositivos. Las salas del APK y las salas WebSocket no se mezclan.

### Compilar y publicar el APK

Instala JDK 21, Android SDK Platform 35, Build Tools 35.0.0 y el comando `zip`. Configura `ANDROID_HOME` y ejecuta:

```sh
bun run build
bun run build:android dist/MuGro-up-Android.apk
```

Sirve `dist/` para ofrecer la descarga desde la web. El comando genera el APK y su índice `dist/android-download.json`. Si ejecutas `bun run build:android` sin indicar el destino, deja el instalador en `build/android/` para pruebas locales.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:8a4b0ae9ea0c096d1ffd9c637e98d30dfbf457a2d7d1420352cf6a22e3d83cbd -->

GitHub Actions publica el APK junto al sitio. Sin firma permanente genera un paquete de prueba separado. El cliente Android consulta los metadatos HTTPS del sitio publicado, verifica el SHA-256 de la descarga y monta únicamente sus recursos web al reiniciar. Los cambios nativos requieren instalar un nuevo APK firmado.

<!-- /coderabbit-ai-generated:v1 -->

Para que Android pueda instalar las futuras actualizaciones sobre la aplicación existente, configura en Actions los secretos `MU_ANDROID_KEYSTORE_B64`, `MU_ANDROID_KEY_ALIAS`, `MU_ANDROID_STORE_PASSWORD` y `MU_ANDROID_KEY_PASSWORD`. Conserva la misma clave e incrementa la versión de `public/ota-manifest.json` en cada actualización.

<!-- /coderabbit-ai-generated:v1 -->

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

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:66a2f574b6d506abeb0095c31f15fcc6653c50ea9b6a75c9346da2f0288b25ca -->

Las reglas base de ADMIN viajan en cada compilación. El panel publica cambios de monstruos, NPC e invasiones cuando hay un servidor configurado. En el juego, Hellpe activa el ataque automático y Combo elige la secuencia. En APKweb, espera a que se complete la descarga antes de desconectarte.

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:2b75c09f88a0c7c163a860fc7cdd0d366d816efb168de085069e918e27455ff2 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c1ca9399acc3671599261b7eb6667b0738ec8400866bbf479d8fa9aebe63915f -->

Madrigal es un terreno común de 9,44 km² con cuatro regiones y cuatro portales interactivos en cada capital. Se puede caminar de una región a otra sin cargar un mapa nuevo. Los campamentos de diez se distribuyen una sola vez y mantienen la separación al aparecer. La tienda muestra el retrato disponible, precio y estadísticas de la pieza.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c4607456c9863d5858b43456bef0531d68dd533569528d7c7ead524e1b583273 -->

La dirección prevista de la nueva instalación es [Mu-GruoUp-V1](https://faneittealejandro501.github.io/Mu-GruoUp-V1/). Antes de retirar la PWA anterior, abre **Web / APKweb → Exportar Respaldo (.json)** allí. En la nueva instalación, usa **Importar Respaldo (.json)** y comprueba tus personajes e inventario.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

La [integración anterior](INTEGRACION-RECURSOS.md) se conserva como registro histórico. Los avisos de los recursos importados se conservan en `public/mugroup/licencias/`. Se mantuvieron recursos ya incluidos en el proyecto; el archivo externo de referencia no se incorporó en bloque.


<!-- /coderabbit-ai-generated:v1 -->