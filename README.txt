MIS DÉCIMOS — Lotería de Navidad (PWA iPhone)
================================================

Contenido:
- index.html: interfaz.
- app.js: lógica, IndexedDB, compras, propietarios, porcentajes, pagos y copias.
- manifest.json: configuración PWA.
- sw.js: caché offline.
- icon.svg: icono.

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
- Esta es una primera versión funcional; antes de confiarle datos definitivos conviene hacer pruebas de uso y restauración en el iPhone.

Regla de pagos:
- Por cada número, cada persona tiene un porcentaje y un importe pagado.
- El estado se calcula como Pendiente, Pago parcial o Pagado según el coste actual y el porcentaje.
- El coste debido se recalcula si añades o editas compras de ese número.
