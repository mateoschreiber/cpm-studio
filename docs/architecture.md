# Arquitectura y decisiones de CPM Studio

Estado: decisiones aplicadas al MVP de fases 1–4. Fecha: 13 de octubre de 2026.

## Proyecto canónico y separación de responsabilidades

`Project` contiene sucesos, actividades, presentación y preferencias. Sus identificadores internos estables no dependen del nombre editable. Las actividades guardan extremos AOA, duración, recursos y condición de ficticia; las posiciones, recorridos, etiquetas, colores y grosores viven en `visual`. El cálculo ignora esa presentación y no persiste resultados derivados.

El motor TypeScript expone funciones puras: `validateGraph`, `validateTable`, `solveCPM`, `extractPrecedences`, `criticalPaths` y `generateAOA`. La interfaz valida y calcula a partir del proyecto vigente; una modificación lógica vuelve a resolverlo y una red inválida retira los resultados. Mover un nodo o una etiqueta no altera la matemática.

La tabla es una vista derivada de la red. Para cada actividad real, `extractPrecedences` recorre hacia atrás caminos formados por ficticias hasta encontrar la primera frontera de actividades reales. Las ediciones pendientes de tabla son un borrador separado: no se presentan como red aplicada. Los resultados visibles se identifican como resultados de la red vigente cuando existe un borrador pendiente.

Zustand conserva el proyecto y las pilas de historial. Cada modificación trabaja sobre una copia; los gestos agrupan las actualizaciones intermedias en una entrada de deshacer. El historial permanece en memoria y no forma parte del JSON portable. Se eligió un almacén central para que lienzo, inspector y tabla compartan una sola red. La API utilizada sigue la [referencia oficial de `create`](https://zustand.docs.pmnd.rs/reference/apis/create.html).

## Cálculo y equivalencia de redes

Se resuelve un DAG mediante orden topológico. Todos los comienzos tienen frontera temprana cero y todos los finales comparten la duración máxima del proyecto como frontera tardía: equivale a agregar inicio y fin virtuales con actividades de duración cero. La red manual debe ser conexa si se ignora el sentido de las flechas; los componentes desconectados se consideran incompletos.

Para una actividad AOA de duración `d`, entre sucesos `i` y `j`:

```text
Ft(j) = máximo de Ft(i) + d entre sus entradas
FT(i) = mínimo de FT(j) - d entre sus salidas
MT = FT(j) - Ft(i) - d
ML = Ft(j) - Ft(i) - d
MI = máximo(0, Ft(j) - FT(i) - d)
```

La familia por precedencias calcula ES/EF hacia adelante y LS/LF hacia atrás. Define `MT = LS - ES`, `ML = mínimo ES de sucesoras - EF` y `MI = máximo(0, mínimo ES de sucesoras - máximo LF de predecesoras - d)`. Sin sucesoras, el mínimo es la duración global; sin predecesoras, el máximo es cero. Por ello ML y MI pueden cambiar entre representaciones AOA equivalentes; la interfaz conserva ambas familias para hacer visible esa diferencia.

La tolerancia absoluta es `EPSILON = 1e-9`, aplicada a residuos cercanos a cero y condición crítica; no se redondean las duraciones antes del cálculo. La presentación usa hasta seis decimales. Los valores muy grandes o diferencias por debajo de esa tolerancia requieren interpretar el resultado con esta precisión numérica.

`criticalPaths` es un generador de rutas críticas: omite ficticias en sus nombres y evita duplicados de rutas reales. La interfaz consume diez rutas por página y una de anticipación. No se calcula ni se trunca silenciosamente un listado completo inicial; al recorrer todas las páginas se retienen las rutas emitidas para navegación y deduplicación.

La generación AOA empieza con extremos propios de cada actividad, inicio/fin comunes y ficticias de precedencia. Elimina ficticias redundantes y contrae sucesos únicamente cuando se mantiene el DAG y coincide el cierre transitivo de precedencias reales. Comparar cierres permite aceptar precedencias explícitas transitivamente redundantes. Si una simplificación falla la comprobación, se conserva la construcción correcta. Se prioriza equivalencia sobre minimalidad.

Si el cierre de una tabla editada coincide con el de la red anterior y conserva sus actividades, se reutiliza la red; así no se destruye un dibujo por una precedencia redundante. En cambios estructurales se reutilizan identificadores y posiciones cuando es posible, y se confirma cualquier eliminación o reconexión antes de reemplazar el proyecto.

## Lienzo, distribución y exportación

React Flow proporciona interacción y viewport; nodos y flechas personalizados representan sucesos y actividades. Una función geométrica compartida calcula recorridos rectos, cuadráticos o segmentados, recorte en círculos de radio 30 y posición de etiqueta. Compartir esa geometría evita que la exportación use una ruta diferente del editor. Las [flechas personalizadas](https://reactflow.dev/learn/customization/custom-edges) y los eventos de edición siguen la [API oficial de React Flow](https://reactflow.dev/api-reference/react-flow).

ELK.js se incluye en el paquete local y aplica distribución por capas de izquierda a derecha. Devuelve una copia con nuevas posiciones, sin modificar actividades ni estilos. Se usa al generar inicialmente y al pedir reorganización; no se vuelve a distribuir todo el dibujo tras cada edición. La integración sigue el [ejemplo oficial React Flow con ELK](https://reactflow.dev/examples/layout/elkjs) y la [API de ELK.js](https://github.com/kieler/elkjs).

SVG se construye sin medios remotos y escapa los textos del usuario. Incluye ficticias discontinuas, actividad y duración, MT cuando se muestran resultados, fechas, numeración opcional y color crítico. PNG rasteriza ese mismo SVG mediante canvas; limita el lado mayor a 8192 píxeles para contener el tamaño de memoria. Las selecciones y los controles de edición no forman parte de la exportación.

## Persistencia, compatibilidad y verificación

JSON usa `version: 1`, con `name`, `events`, `activities`, `visual` y `preferences`. No hay migración implícita de versiones desconocidas. `parseProject` valida estructura, identificadores únicos, extremos existentes, números finitos, recursos enteros no negativos, estilos y preferencias; rechaza claves peligrosas y colores que puedan referenciar recursos externos. Permite borradores matemáticamente inválidos, como ciclos o sucesos aislados con presentación válida. Importar primero valida y después ofrece reemplazar el proyecto; un archivo rechazado no cambia la red abierta.

El guardado automático escribe bajo `cpm-studio.project.v1` en `localStorage`. La recuperación captura errores sin borrar datos. Si falla al arrancar, la aplicación suspende la escritura automática inicial hasta que se edite o cargue otro proyecto; evita reemplazar el original con el proyecto vacío de recuperación. La descarga JSON permite copia y traslado entre orígenes. Posiciones, recorridos y preferencias se restauran; selección, zoom, historial y borradores de tabla no se guardan.

Vitest verifica fechas y márgenes independientes, validaciones, DAG generados, equivalencia de cierres y márgenes totales, persistencia, geometría, exportación y estado. Playwright utiliza la compilación estática en Chromium y Firefox para verificar edición y recuperación. Los comandos reproducibles están en el README; la evidencia final corresponde a la integración de las cuatro fases. Linux requiere ejecutar ese procedimiento antes de afirmar compatibilidad verificada.

No existe API HTTP de aplicación, servidor de datos, autenticación ni envío de proyectos a servicios externos. Las dependencias se instalan antes de trabajar sin Internet. Al distribuir el paquete deben mantenerse sus avisos y licencias, incluida EPL-2.0 de ELK.js.
