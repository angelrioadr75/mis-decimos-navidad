MIS DÉCIMOS — Lotería de Navidad (PWA iPhone)
================================================

Contenido:
- index.html: interfaz con pestañas Inicio, Personas, Resumen y Ajustes.
- app.js: lógica, IndexedDB, compras, propietarios, porcentajes, pagos, resumen por sorteo y copias.
- manifest.json: configuración PWA.
- sw.js: caché offline.
- icon.svg: icono.

Novedades v1.2:
- El botón de añadir número queda fuera de la tarjeta Mis números.
- En Ajustes puedes crear sorteos nuevos.
- Cada número tiene un selector de sorteo y queda vinculado al sorteo elegido.
- Al crear un sorteo, pasa a ser el seleccionado para registrar números nuevos.

Publicación en GitHub Pages:
1. Descomprime el ZIP en tu ordenador.
2. Entra en el repositorio GitHub que quieras usar.
3. Sube los archivos index.html, app.js, manifest.json, sw.js e icon.svg a la raíz del repositorio.
4. En Settings > Pages, configura Deploy from a branch, rama main y carpeta /(root).
5. Abre la URL HTTPS publicada desde Safari en el iPhone.
6. Pulsa Compartir > Añadir a pantalla de inicio.

Notas:
- La aplicación guarda datos en IndexedDB del navegador/dispositivo.
- Exporta una copia JSON regularmente desde Ajustes.
- Restaurar una copia sustituye los datos existentes tras confirmación.
- Para evitar perder datos, prueba primero con datos ficticios y comprueba exportación/restauración.
- Esta es una versión 1.4; antes de confiarle datos definitivos conviene hacer pruebas de uso y restauración en el iPhone.

Regla de pagos:
- Por cada número, cada persona tiene un porcentaje y un importe pagado.
- El estado se calcula como Pendiente, Pago parcial o Pagado según el coste actual y el porcentaje.
- El coste debido se recalcula si añades o editas compras de ese número.

Mejora v1.3: selector de sorteo visible en Inicio y Números. Cambiarlo actualiza el contenido de ambas pestañas sin entrar en Ajustes.
