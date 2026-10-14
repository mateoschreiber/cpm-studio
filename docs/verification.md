# Verificación de la evolución académica y web

Integración del 13 de octubre de 2026. Implementación, comprobaciones dirigidas y aceptación integrada se registran por separado; resultados del MVP anterior no prueban automáticamente V2.

## Registro integrado

Ejecución integrada local de producción terminada el 14 de octubre de 2026 UTC (13 de octubre en Paraguay). Las mediciones corresponden a este equipo; la ejecución remota Linux se consulta por separado.

| Comprobación | Evidencia V2 |
| --- | --- |
| TypeScript y lint completos | Sin errores ni advertencias, ejecución local V2 |
| Suite unitaria completa | 52/52 en 8 archivos; incluye las 25 originales |
| Build, workers y precache PWA | Compilación de producción correcta; 26 recursos, 2,17 MiB de precache |
| Chromium/Firefox/WebKit | 72/72 en Windows: 24 escenarios en cada motor |
| Offline con vistas no visitadas | Chromium, Firefox y WebKit: recarga desconectada, ELK/worker y módulos no abiertos previamente |
| Rendimiento 100/500 actividades | Medición local reproducible descrita debajo |
| Cloudflare | Preparado, no publicado |
| CI Linux remota | Configurada; resultados en [GitHub Actions](https://github.com/mateoschreiber/cpm-studio/actions/workflows/ci.yml) |

La auditoría de dependencias de producción (`npm audit --omit=dev --audit-level=high`) informó cero vulnerabilidades conocidas en esta ejecución; no equivale a una garantía general de seguridad.

## Rendimiento local

Medición del 14 de octubre de 2026 UTC, Windows, Intel Core Ultra 7 265K, Chromium 156.0.8078.4, producción, sin limitación artificial de CPU. Gesto real de 30 movimientos, nodo central visible, encuadre estabilizado; se comprueba que cambió su posición. El tiempo de importación incluye la interacción automatizada; no es exclusivamente tiempo de CPU.

| Actividades | Importación | Mediana entre frames | p95 entre frames | Frames >50 ms |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 164 ms | 16,7 ms | 16,7 ms | 0 |
| 500 | 456 ms | 16,7 ms | 33,4 ms | 0 |

Se corrigió la construcción de opciones ocultas de predecesoras (250.000 opciones con 500 filas), se estabilizaron las props de tabla/resultados y se reutilizan modelos de React Flow. Antes de estas optimizaciones, importación aproximada de 3 segundos y p95 de arrastre real de 100 ms. El resultado no promete 60 FPS constantes ni latencias equivalentes en todos los dispositivos. JSON detallado generado por `npm run benchmark` en `test-results/benchmark.json`.

## Criterios de aceptación

- Guía: duración 15, ruta A→C→E; sucesos 0/0, 8/8, 8/10, 13/13, 15/15; triángulos B 6→4, D 10→11. Catorce actividades: duración 21 y ruta A→G→D→E→L, con expectativas independientes.
- Último paso consistente con resolución directa; empates visibles; cambios visuales conservan matemática y cambios lógicos invalidan lo anterior.
- Calendario/Gantt/recursos usan iguales intervalos; guía total89 y pico9 en ambas programaciones. Decimales, duración cero y ficticias cubiertos.
- Generación equivalente en precedencias, fechas y MT; múltiples rutas/fronteras, ciclos y borradores contemplados.
- Migración V1→V2, biblioteca, restauración, cuotas, borradores y operaciones de proyecto sin sobrescribir recuperaciones fallidas.
- SVG/PNG consistentes con símbolos/tamaño; CSV e informe con escape y resultados completos.
- Tres motores, anchuras390/768/1440, teclado, temas y movimiento reducido.
- PWA offline completa, vistas no visitadas y actualización explícita.
- Generación/disposición cancelables y respuestas antiguas descartadas. Importación/arrastre100/500 medidos, con equipo, navegador y percentiles.

## Reproducción y límites

Comandos en [web.md](web.md). Benchmark requiere preview en4173 y escribe JSON ignorado por Git. Registrar resúmenes después de medir; no es garantía universal de latencia.

CI está configurada en Ubuntu; su evidencia es cada ejecución enlazada en GitHub Actions. Las instrucciones Linux por sí solas no prueban ejecución real. Las pruebas de navegador no sustituyen una auditoría completa de accesibilidad. El informe ofrece una vista previa explícita de hasta diez rutas; todas las rutas están disponibles mediante paginación en la aplicación.

ELK se carga diferido en worker, pero la preparación offline debe descargarlo. PWA necesita HTTPS/localhost y caché disponible. IndexedDB/caché pueden borrarse por políticas del navegador; JSON ofrece respaldo independiente. No se promete nivelación, PERT probabilístico ni ausencia general de vulnerabilidades.
