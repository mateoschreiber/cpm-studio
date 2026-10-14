# Verificación de la entrega

Estado integrado del MVP comprobado el 13 de octubre de 2026 en Windows, con Node.js 24.18.0 y npm 11.16.0.

| Comprobación | Resultado |
| --- | --- |
| `npm run build` | TypeScript y compilación de producción correctos |
| `npm test` | 25 pruebas unitarias correctas en 3 archivos |
| `npm run test:e2e` | 28 pruebas correctas: 14 escenarios en Chromium y Firefox |
| `npm audit` | 0 vulnerabilidades reportadas |

## Evidencia funcional

- Red manual guía: duración 15, fechas de todos los sucesos, márgenes conocidos y ruta A → C → E.
- Ejercicio de catorce actividades: duración 21, resultados numéricos esperados y ruta A → G → D → E → L.
- Construcción del ejercicio guía completo desde celdas de tabla y desde el mouse; generación y edición posterior de redes.
- Comparaciones de equivalencia sobre 80 DAG y regeneraciones con conservación de identificadores y numeraciones sobre otros 40 casos.
- Selección múltiple, movimiento conjunto, duplicación, eliminación, deshacer/rehacer, cambios de conexiones, curvas, segmentos y etiquetas.
- Precedencias pendientes conservadas entre vistas y frente a otras ediciones; duración y recursos actualizados incluso con un borrador estructural inválido.
- Retirada de resultados definitivos al invalidar la red; recuperación mediante deshacer.
- Enumeración paginada de 16 rutas críticas, incluyendo avance y regreso.
- Guardado y recuperación local, importación JSON, rechazo de archivos dañados y conservación de una recuperación fallida antes de una edición explícita.
- Descargas SVG/PNG en ambos navegadores; geometría y escape XML comprobados con pruebas unitarias.
- Pantalla de 390 píxeles sin desbordamiento horizontal de la página. Las tablas mantienen desplazamiento horizontal interno.
- Ejecución con recursos externos bloqueados; las solicitudes de la aplicación permanecen en el servidor local.

La revisión de código identificó problemas de cancelación de campos, borradores, selección y agrupación de gestos. Se corrigieron y se añadieron escenarios de regresión; la revisión posterior no encontró problemas sustantivos en esos cambios.

## Límites de la evidencia

Linux tiene instrucciones de ejecución, pero no se ejecutó la suite en Linux. Tampoco se atribuyen verificaciones históricas separadas a cada fase: esta evidencia corresponde a la entrega integrada.

Vite informa que el paquete de ELK es grande (aproximadamente 1,43 MB minificado); se carga por separado y solo al solicitar distribución o generar la primera red desde tabla. La aplicación no promete rendimiento ilimitado para redes grandes ni una cantidad mínima de ficticias. La enumeración de todas las rutas puede crecer exponencialmente.

No forman parte de esta entrega la fase 5, PERT probabilístico ni la nivelación de recursos. La ausencia de hallazgos de `npm audit` describe el registro consultado y no equivale a una auditoría de seguridad completa.
