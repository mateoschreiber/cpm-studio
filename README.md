# CPM Studio

Herramienta académica de camino crítico, en español, ejecutada íntegramente en el navegador. Incluye editor AOA, resolución CPM determinista paso a paso, diagramas calendario/Gantt y perfiles de recursos. React, TypeScript, Vite, React Flow, ELK.js y Zustand; sin backend, cuentas ni servicios externos de cálculo.

## Ejecutar

Usar Node.js 22 o superior y npm. En Windows (PowerShell) o Linux:

```sh
npm ci
npm run dev
```

Abrir [CPM Studio local](http://127.0.0.1:5173). Si el puerto está ocupado, Vite indica otro. Para la versión compilada y la PWA:

```sh
npm run build
npm run preview -- --port 4173 --strictPort
```

Abrir [la versión compilada](http://127.0.0.1:4173). `dist/` contiene los archivos estáticos. Se requiere HTTP localhost o HTTPS; `file://` no está admitido. La instalación inicial necesita Internet.

## Flujo académico

- **Red:** construcción manual o desde tabla; sucesos, actividades, ficticias, reconexión, selección múltiple y recorridos/etiquetas editables. Cuadrícula, encuadre e historial de 100 operaciones.
- **Red resuelta:** rombos Ft/FT y triángulos ufc/pff calculados automáticamente, con distribución y anotaciones independientes de la red lógica.
- **Resolución:** validación, ida, vuelta, fechas de actividad, márgenes y criticidad; fórmulas, sustituciones, alternativas y empates, con reproducción y navegación.
- **Calendario y Gantt:** programaciones temprana/tardía con duración a escala y distinción entre ejecución, espera y holgura.
- **Recursos:** carga simultánea por intervalos y consumo acumulado temprano/tardío. No nivela recursos.
- **Informe:** redes, fechas, ambos tipos de márgenes, desarrollo y diagramas; HTML imprimible mediante el navegador.

Los ejemplos tienen duraciones 15 y 21. ML y MI por sucesos AOA pueden diferir de los márgenes por precedencias; ambas familias se identifican. Consultar [teoría](docs/theory.md).

Las entradas incompletas de tabla permanecen como borradores; cambios estructurales destructivos requieren confirmación. Cancelar conserva la red vigente. Las redes inválidas pueden guardarse, pero no presentan resultados definitivos. Duraciones finitas no negativas y recursos enteros no negativos; ficticias con duración/recursos cero.

## Proyectos, exportación y offline

La biblioteca IndexedDB permite crear, abrir, renombrar, duplicar y eliminar proyectos. El autoguardado conserva V2, preferencias, distribuciones, anotaciones y borradores. Selección e historial permanecen en memoria. JSON V1 se valida y migra sin modificar el original; el registro antiguo de localStorage se conserva como respaldo.

JSON es la copia portable entre equipos, navegadores y orígenes: localhost y un dominio público tienen bibliotecas distintas. Los errores de cuota se muestran sin descartar el trabajo. Esperar la indicación de guardado y conservar copias JSON independientes.

Redes/gráficos se exportan SVG/PNG; tablas, CSV; informe, HTML imprimible a PDF. PNG limita el lado mayor a 8192 píxeles. Todo se genera localmente.

El informe presenta hasta diez rutas críticas y avisa cuando existen más; la aplicación permite recorrer todas mediante paginación incremental.

En producción, esperar el aviso offline: se precachean también módulos diferidos y workers de vistas todavía no visitadas. Las actualizaciones requieren aceptación explícita después del guardado. Desarrollo no registra PWA.

## Verificación y publicación

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

En Linux usar `npx playwright install --with-deps chromium firefox webkit`. CI verifica los tres motores en Ubuntu. Con preview abierto, `npm run benchmark` mide 100/500 actividades y escribe `test-results/benchmark.json`.

La [verificación](docs/verification.md) distingue evidencia y criterios pendientes. La [guía web](docs/web.md) explica ejecución, offline y Cloudflare. Wrangler y el workflow manual están preparados; crear Worker, vincular dominio y publicar son operaciones posteriores. No hay despliegue por push.

## Límites y mantenimiento

No incluye PERT probabilístico, calendarios laborales, retardos, restricciones de capacidad ni optimización de recursos. Los recursos son constantes por actividad. La generación AOA preserva precedencias, pero no promete el mínimo número de ficticias. Enumerar todas las rutas críticas puede requerir tiempo/memoria exponenciales. Cancelar workers evita continuar generación/disposición; no elimina el costo de renderizar redes grandes.

Consultar [arquitectura](docs/architecture.md), [contribución](CONTRIBUTING.md) e [historial](CHANGELOG.md). Código bajo [MIT](LICENSE). Dependencias con licencias propias; ELK.js utiliza EPL-2.0. Build genera `THIRD_PARTY_NOTICES.txt`: conservarlo al redistribuir `dist/`.
