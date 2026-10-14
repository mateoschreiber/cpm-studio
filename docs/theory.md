# Modelo matemático y notación académica

CPM Studio utiliza duraciones conocidas y dependencias fin–comienzo, sin retardos ni restricciones de capacidad. La red debe ser acíclica. Ficticias expresan dependencias con duración cero y sin recursos. Puede haber varias rutas críticas. Las hipótesis y recorridos ida/vuelta se explican en [Carnegie Mellon, secciones 10.2–10.4](https://www.cmu.edu/cee/projects/PMbook/10_Fundamental_Scheduling_Procedures.html).

Las fórmulas documentan las convenciones del motor, incluida la definición de margen independiente por precedencias.

## Sucesos y fechas de actividades

Para una actividad de duración d entre sucesos i y j:

```text
Ft(j) = max [Ft(i) + d] en entradas a j
FT(i) = min [FT(j) − d] en salidas de i

pfc = Ft(i)          pff = Ft(i) + d
ufc = FT(j) − d      uff = FT(j)

MT = FT(j) − Ft(i) − d
ML = Ft(j) − Ft(i) − d
MI = max(0, Ft(j) − FT(i) − d)
```

Comienzos parten de cero; todos los finales tienen frontera tardía igual a la duración global, máximo Ft final. Equivale a añadir inicio/fin virtuales de duración cero.

El rombo muestra Ft/FT del suceso. Triángulos muestran **ufc al comienzo** y **pff al final de la actividad**, según la lámina. Son valores derivados; moverlos no los modifica.

| Actividad | d | pfc | ufc | pff | uff |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 8 | 0 | 0 | 8 | 8 |
| B | 4 | 0 | 6 | 4 | 10 |
| C | 5 | 8 | 8 | 13 | 13 |
| D | 3 | 8 | 10 | 11 | 13 |
| E | 2 | 13 | 13 | 15 | 15 |

B termina tempranamente en 4, aunque Ft del suceso de llegada es 8: espera también la ficticia desde A. Fechas de actividad y suceso no son intercambiables.

## Familia por precedencias

Trabaja sobre actividades reales y predecesoras/sucesoras extraídas a través de ficticias:

```text
ES(a) = max EF(predecesoras), o 0 sin predecesoras
EF(a) = ES(a) + d(a)
LF(a) = min LS(sucesoras), o duración global sin sucesoras
LS(a) = LF(a) − d(a)

MT(a) = LS(a) − ES(a)
ML(a) = min ES(sucesoras) − EF(a)
MI(a) = max(0, min ES(sucesoras) − max LF(predecesoras) − d(a))
```

En ML/MI, mínimo sin sucesoras es duración global y máximo sin predecesoras es cero. Representaciones equivalentes conservan fechas de ejecución y MT; ML/MI pueden cambiar por esperas de sucesos compartidos. En la red manual de la guía, ambas familias coinciden: B tiene MT=6, ML=4 y MI=4; D tiene MT=2, ML=2 y MI=0. Una representación generada con otros sucesos y ficticias puede producir diferencias en ML/MI, que se muestran identificadas sin alterar las precedencias.

## Diagramas y recursos

Programación temprana ejecuta en [pfc,pff); tardía, [ufc,uff). La red lógica tiene distribución libre, no escala temporal. Calendario separa ejecución de espera; Gantt presenta filas con duración a escala. Duración cero es un instante sin intervalo de consumo.

Cada recurso es una cantidad constante durante la actividad. Carga en t suma actividades con inicio ≤ t < fin. Se aplican simultáneamente altas/bajas en cada frontera, sin contar dos veces intervalos adyacentes. Acumulado integra carga × duración y utiliza **recursos·tiempo**.

En la guía: 8×5 + 4×4 + 5×3 + 3×2 + 2×6 = **89 recursos·tiempo**. Ambas programaciones conservan ese total y tienen pico **9**. No se afirma que sea óptimo ni se impone capacidad. La distinción entre programación temporal y recursos se expone en [Carnegie Mellon, secciones 10.10–10.11](https://www.cmu.edu/cee/projects/PMbook/10_Fundamental_Scheduling_Procedures.html).

## Precisión y límites

Coma flotante sin redondear duraciones; tolerancia absoluta EPSILON=1e-9 para residuos/criticidad. Recursos une fronteras únicamente por error de representación de máquina, sin discretizar a días. La visualización utiliza hasta seis decimales.

Ficticias se omiten de nombres de rutas y consumo. Enumeración incremental sin truncamiento oculto; todas las rutas pueden requerir tiempo/memoria exponenciales. Generación compara cierres transitivos y no promete mínimo de ficticias.
