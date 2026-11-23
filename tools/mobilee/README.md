<!-- coderabbit-ai-generated:v1 -->

# Colección Mobilee

En **Crear Personaje → Apariencia** se puede elegir cualquiera de los seis diseños, en femenino o masculino. Cada diseño usa el combate y el inventario de la clase indicada. La apariencia se guarda con el personaje. El modelo conserva su traje propio; el arma, el escudo y las alas pueden cambiar al equiparlos. La armadura conserva sus estadísticas.

Los GLB se sirven desde `public/mugroup/personajes/mobilee` y se incluyen en la caché de APKweb. Cada GLB pesa menos de 2 MiB e incluye materiales y sus animaciones sin depender de peticiones externas. Los archivos de las partidas anteriores no necesitan migración.

## Fuentes y reconstrucción

La fuente es [Personajes.zip en Mobilee](https://github.com/angelicamarin313555/Mobilee/blob/982b6e7ff1e0eb18a75b6e0b7c586bed2968f3c5/Personajes.zip). Los seis números del ZIP corresponden al orden de `src/data/heroAppearances.json`. Se conserva la autoría de las fuentes. El ZIP no incluye documentación de licencia.

La chaqueta de la hechicera es el único objeto de su archivo Blender. La variante se completó con un sombrero y detalles nuevos sobre el modelo de Mago. La Guardiana conserva su malla y sus pesos originales adaptados; los materiales se reconstruyeron porque el ZIP no trae los TIFF que pide el modelo.

Para reconstruir los GLB desde el directorio raíz con Blender bpy 5.0.1, NumPy y Pillow: `python tools/mobilee/build.py /ruta/Personajes`. El importador abre los archivos Blender con scripts desactivados. Para regenerar las imágenes, renderiza los GLB y escala los retratos de la interfaz a 144 × 196.