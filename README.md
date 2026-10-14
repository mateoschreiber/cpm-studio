# CPM Studio

Editor local de redes de camino crítico, en español. Incluye edición manual AOA, tabla de precedencias sincronizada, cálculo CPM, rutas críticas, guardado JSON y exportación SVG/PNG. React, TypeScript, Vite, React Flow, ELK.js y Zustand; sin backend ni cuentas.

## Ejecutar

Se recomienda Node.js 24 y npm. Desde la carpeta del proyecto, en PowerShell, Bash o una terminal equivalente:

```sh
npm install
npm run dev
```

Abrir [CPM Studio local](http://127.0.0.1:5173). Si ese puerto está ocupado, Vite muestra otro en la terminal. La instalación inicial necesita acceso al registro de npm; después, la aplicación utiliza recursos locales y puede funcionar sin Internet mientras su servidor local permanezca activo.

Para construir y servir la aplicación compilada:

```sh
npm run build
npm run preview -- --port 4173 --strictPort
```

Abrir [la versión compilada](http://127.0.0.1:4173). `dist/` contiene los recursos estáticos y puede servirse desde otro servidor HTTP local. Abrir `index.html` mediante `file://` no es el modo de ejecución admitido.

## Uso

- Cargar el ejercicio guía o el ejemplo de catorce actividades para explorar resultados conocidos.
- Crear sucesos en el lienzo y unirlos con actividades reales o ficticias. Seleccionar elementos para editar nombres, conexiones, duración, recursos, colores y recorridos. Arrastrar etiquetas y controles de recorrido para ajustar el dibujo.
- Usar selección múltiple, deshacer/rehacer, cuadrícula, ajuste magnético, zoom, encuadre y distribución automática. Un arrastre completo se deshace como una operación.
- En la tabla, introducir predecesoras y confirmar la celda. Las entradas incompletas quedan como borrador; las modificaciones estructurales que eliminan o reconectan elementos requieren confirmación. Cancelar conserva la red vigente y el borrador pendiente.
- Consultar resultados por sucesos AOA o por precedencias. Los márgenes ML y MI pueden diferir por la ubicación de las ficticias. Las rutas críticas se enumeran por páginas, sin un límite oculto.
- Guardar JSON para una copia portable; importar JSON para continuar en otro navegador o equipo. Exportar SVG o PNG para compartir el dibujo con sus fechas, etiquetas y colores.

Las duraciones válidas son números finitos no negativos, incluidos cero y decimales. Los recursos son enteros no negativos; las ficticias tienen duración y recursos cero. Una red cíclica, desconectada o incompleta puede conservarse como borrador, pero no produce resultados definitivos. Se admiten múltiples comienzos y finales mediante fronteras virtuales de duración cero.

El guardado automático usa `localStorage` del navegador y del origen HTTP concreto: cambiar navegador, host o puerto puede mostrar otro proyecto guardado. Descargar JSON es la forma de transportarlo. Si la recuperación local falla, se informa el error y se evita sobrescribir los datos originales al abrir; una edición o la carga de otro proyecto habilita nuevamente el guardado. Los errores de cuota no descartan el proyecto abierto.

## Comprobar

```sh
npm test
npm run build
npx playwright install chromium firefox
npm run test:e2e
```

Playwright descarga los navegadores en la instalación inicial y sirve `dist/` en `127.0.0.1:4173`; construir antes de ejecutar sus pruebas. En Linux, si faltan bibliotecas del sistema, usar `npx playwright install --with-deps chromium firefox` con los permisos correspondientes. El entorno de desarrollo de esta entrega es Windows; estos comandos documentan también el procedimiento para Linux, sin afirmar que haya sido ejecutado allí.

Las pruebas unitarias cubren el ejercicio guía (duración 15 y ruta A → C → E), las catorce actividades (duración 21 y ruta A → G → D → E → L), casos numéricos y de validación, equivalencia de precedencias, persistencia y exportación. Las pruebas de navegador cubren interacciones y recuperación en Chromium y Firefox. Para verificar funcionamiento desconectado, mantener el servidor local activo, desconectar Internet y repetir carga, edición, recarga y exportación; las solicitudes de la aplicación deben permanecer en el origen local.

La entrega integra las fases 1–4. La verificación debe referirse al estado integrado actual; no se atribuyen ejecuciones históricas independientes a cada fase.

La [verificación de esta entrega](docs/verification.md) registra las pruebas ejecutadas y sus límites.

## Límites y mantenimiento

CPM utiliza duraciones deterministas. No incluye estimación probabilística PERT, resolución didáctica, calendario, Gantt, gráficos ni nivelación de recursos. La generación AOA conserva las precedencias, pero no promete el mínimo número de ficticias. Las redes con muchas rutas pueden requerir tiempo y memoria al recorrerlas todas. PNG limita su dimensión mayor a 8192 píxeles; SVG conserva el formato vectorial.

Consultar [arquitectura y decisiones](docs/architecture.md). El código de CPM Studio se distribuye bajo [MIT](LICENSE). Las dependencias conservan sus licencias: React Flow usa MIT y ELK.js EPL-2.0. `npm run build` genera e incluye `THIRD_PARTY_NOTICES.txt` en `dist/`; conservar ese archivo al redistribuir. `npm run licenses` actualiza los avisos sin compilar.
