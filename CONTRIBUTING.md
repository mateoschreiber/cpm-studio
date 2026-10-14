# Contribuir a CPM Studio

Usar Node.js 22 y ejecutar `npm ci`. Antes de abrir un cambio ejecutar `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` y las pruebas de navegador afectadas. La CI ejecuta Chromium, Firefox y WebKit en Linux.

Mantener el cálculo puro separado de coordenadas y estilos. Documentar fórmulas y unidades; agregar expectativas numéricas independientes para cambios matemáticos. No sustituir las pruebas de referencia por valores obtenidos del mismo algoritmo que se está comprobando.

Los proyectos personales, credenciales, dependencias instaladas, compilaciones y resultados de pruebas no se incorporan al repositorio. Los cambios de formato JSON necesitan migración y pruebas de compatibilidad. Preservar la tolerancia numérica documentada y los intervalos de recursos semiabiertos `[inicio, fin)`.

Las interacciones deben funcionar con teclado y movimiento reducido; las operaciones gráficas necesitan alternativa por formulario. Verificar pantalla pequeña, tema oscuro y exportación de cualquier nuevo símbolo.

No ejecutar publicación ni crear recursos Cloudflare como parte de una contribución. Los datos permanecen en el navegador. Referencias de ejecución y publicación: [docs/web.md](docs/web.md).
