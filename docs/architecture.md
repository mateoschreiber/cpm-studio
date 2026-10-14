# Arquitectura de CPM Studio

Decisiones de la evolución académica y web, 13 de octubre de 2026. Evidencia de ejecución en [verification.md](verification.md).

## Proyecto y cálculo

El proyecto canónico separa sucesos/actividades de presentación. Los IDs son independientes de etiquetas editables. La tabla deriva precedencias reales recorriendo ficticias hasta la frontera de actividades reales; sus cambios pendientes son borradores, no una segunda red aplicada.

V2 añade identidad y presentación: vista, tema, movimiento, tamaño, escala temporal, orden/desplazamiento de filas, borradores y distribución independiente de red resuelta. Red lógica conserva visual; resuelta tiene su modelo con respaldo en posiciones vigentes para elementos nuevos. displayProject, eventCenter y academicSymbols proyectan la representación compartida por lienzo/exportación. Los resultados no se persisten como fuente de verdad.

El núcleo puro valida, resuelve CPM, extrae precedencias, genera AOA y enumera rutas. buildSolutionTrace explica el resultado; buildSchedule produce ejecución temprana/tardía; buildResourceProfile calcula carga/acumulación por intervalos. Fórmulas en [theory.md](theory.md).

Se usan orden topológico e índices de adyacencia, fronteras virtuales y tolerancia 1e-9. La red manual debe ser conexa sin considerar orientación. Generación simplifica ficticias solo conservando DAG y cierre transitivo: equivalencia tiene prioridad sobre minimalidad.

## Estado, historial y trabajos

Zustand/Immer producen parches directos/inversos. Máximo 100 comandos, un gesto por entrada y conservación estructural de ramas intactas. La revisión lógica cambia al modificar la red; la documental también sigue presentación. Mover anotaciones no recalcula CPM ni reinicia explicación. Un cambio lógico inválido retira resultados anteriores.

generateInWorker y layoutInWorker comparten un único Web Worker activo. Comenzar otro trabajo o cancelJobs termina el anterior y rechaza con AbortError. IDs de solicitud impiden aceptar respuestas antiguas; completar/fallar termina el worker. ELK se importa dentro del worker cuando hace falta. La generación inicial dispone la red vacía; actualizaciones conservan posiciones reutilizables.

CPM sigue síncrono en el navegador. Gráficos/informe se cargan por módulos. No hay endpoints, backend ni colas remotas.

El editor se encapsula en EditorWorkspace; cálculo, biblioteca, trabajos, resolución, diagramas e informe tienen módulos independientes. Tabla/resultados reciben una proyección estable de la lógica: mover un nodo no vuelve a renderizar sus filas. Las opciones de predecesoras se construyen al abrir el selector, evitando cientos de miles de controles ocultos en redes de 500 actividades.

El desplazamiento automático durante arrastres está desactivado para mantener el encuadre bajo control del usuario; el lienzo conserva desplazamiento manual con botón central/derecho, zoom y encuadre. Las actualizaciones de posiciones idénticas se omiten. Las pruebas centran el nodo antes de arrastrar y mantienen la liberación dentro de la ventana, incluyendo ventanas de 720 píxeles de altura.

## Presentación y exportación

React Flow mantiene viewport y edición. Geometría compartida recorta círculos/rombos según radio 23/30/40; el rombo tiene semiancho 1,2 radios. Los triángulos toman valores del resultado y offsets visuales independientes.

Calendario distingue ejecución de espera; Gantt muestra ejecución/holgura, y duración cero es un instante. Vistas temporales y recursos comparten render SVG con exportación e informe. Mover filas/escala no altera fechas.

exportSVG conserva vista activa, ficticias, fechas y anotaciones; escapa texto e incluye símbolos desplazados en límites. PNG rasteriza ese SVG con máximo 8192 píxeles. CSV escapa campos y el informe HTML escapa textos; selección/controles no se exportan. Temas y movimiento son preferencias; la interfaz respeta movimiento reducido.

## Persistencia y web

IndexedDB guarda proyectos completos; operaciones serializadas y autoguardado agrupado a 300 ms. Abrir otro proyecto intenta guardar el actual. Errores conservan trabajo en memoria. Transacciones al ocultar/cerrar no garantizan escritura: se recomiendan copias JSON.

parseProject valida estructura, IDs, extremos, números, recursos y presentación; admite borradores matemáticamente inválidos estructuralmente válidos. Rechaza claves peligrosas y estilos remotos. migrateProject realiza V1→V2 explícito sin mutar original. La migración localStorage conserva origen y marca traslado después del commit IndexedDB.

Selección, viewport e historial son temporales; vistas, anotaciones, distribuciones y borradores son documentales. Bibliotecas son propias del origen; JSON permite trasladarlas.

PWA precachea módulos, workers, iconos, fuentes locales y licencias. Actualiza mediante aviso sin activación automática forzada. Primera carga incompleta no garantiza offline. Cloudflare sirve dist con fallback SPA; workflow exclusivamente manual. CI ejecuta tipos, lint, pruebas, build y Playwright Ubuntu; mediciones locales se registran aparte.

Referencias: [React Flow](https://reactflow.dev/learn/advanced-use/performance), [Zustand](https://zustand.docs.pmnd.rs/reference/apis/create.html), [ELK.js](https://github.com/kieler/elkjs), [Vite PWA](https://vite-pwa-org.netlify.app/guide/prompt-for-update), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). Procedimientos en [web.md](web.md).
