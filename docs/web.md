# Ejecución web, offline y publicación

CPM Studio no requiere servidor de cálculo, cuentas ni API remota. El navegador ejecuta CPM, generación AOA, disposición ELK, exportaciones y almacenamiento IndexedDB. El servidor solo entrega archivos estáticos.

## Desarrollo y verificación

Se requiere Node.js 22 y npm. En Windows (PowerShell) y Linux:

```sh
npm ci
npm run dev
```

La PWA se comprueba sobre la compilación de producción, porque el servicio de desarrollo no registra un service worker:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
npm run preview
```

En Linux, instalar los navegadores con `npx playwright install --with-deps chromium firefox webkit`. WebKit en Windows depende de los binarios disponibles para la versión instalada; la matriz de referencia de tres motores se ejecuta en GitHub Actions sobre Ubuntu. Los comandos son instrucciones de reproducción, no evidencia de que se hayan ejecutado en una plataforma determinada.

## Uso offline y actualizaciones

Abrir la compilación mediante HTTPS o localhost, esperar el aviso de disponibilidad offline y después desconectar la red. El precache incluye los módulos diferidos, workers, iconos y avisos de licencias: una vista no visitada también debe abrirse offline. No es suficiente que la primera pantalla haya cargado.

Las actualizaciones permanecen en espera hasta aceptar explícitamente el aviso. La aplicación no debe recargarse automáticamente al detectar una versión nueva. Guardar o exportar el proyecto antes de actualizar. IndexedDB conserva datos por origen: localhost y el dominio público son bibliotecas diferentes; usar JSON para trasladar proyectos. El navegador puede borrar sus datos locales: JSON es también una copia de seguridad independiente.

No se precachean proyectos personales. La primera descarga necesita conexión. El modo privado, las cuotas y la eliminación de almacenamiento pueden impedir conservar el proyecto o la caché; la interfaz debe comunicar el error.

## Cloudflare, preparado para una operación posterior

`wrangler.jsonc` sirve `dist/` mediante Static Assets y utiliza fallback SPA. No contiene rutas, dominio, credenciales ni lógica remota. No se ha creado un Worker como parte de la preparación.

Cuando exista el Worker y se decida publicar, comprobar su nombre contra `name` en Wrangler. Configurar el entorno GitHub `production` y los secretos `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN`. El token debe limitarse a la cuenta y permisos de Workers necesarios. Se recomienda exigir revisión del entorno `production`. Ejecutar manualmente **Publicación manual en Cloudflare** desde Actions. No hay despliegue por push ni pull request. Ejecutar el workflow sí publica y puede crear el Worker si todavía no existe; no ejecutarlo durante la preparación.

## Medición reproducible

Con `npm run preview` abierto, ejecutar `npm run benchmark`. Se importan redes conectadas de 100 y 500 actividades, se mide respuesta a importación y arrastre con muestras de frames del navegador y se registra un JSON en `test-results/benchmark.json`. Se guardan mediana/p95 de separación entre frames y duración del gesto; son medidas del equipo y navegador utilizados, no promesas universales. La herramienta no utiliza servicios de medición externos.

## Referencias oficiales

- [Vite PWA: actualización mediante aviso](https://vite-pwa-org.netlify.app/guide/prompt-for-update): callbacks `onNeedRefresh`/`onOfflineReady` y aplicación explícita mediante `updateSW()`.
- [Vite PWA: precache de assets](https://vite-pwa-org.netlify.app/guide/static-assets): incluir recursos locales en el manifiesto de precache.
- [Cloudflare: SPA con Static Assets](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/): `assets.directory` y `not_found_handling`.
- [Playwright: integración continua](https://playwright.dev/docs/ci): instalación de navegadores y dependencias para Linux.
