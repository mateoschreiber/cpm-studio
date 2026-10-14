import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type NodeChange,
  type Connection,
} from "@xyflow/react";
import {
  defaultEdgeVisual,
  nodeRadius,
  type Activity,
  type CPMResult,
  type EdgeVisual,
  type Project,
} from "../core/types";
import { edgeGeometry } from "../services/geometry";
import { academicSymbols, isResolved, eventCenter } from '../services/presentation';
import { numberText, useProjectStore } from "../store";

export type Tool = "select" | "event" | "activity" | "dummy";
type EventNodeData = {
  label: string;
  early?: number;
  late?: number;
  showLabels: boolean;
  showDates: boolean;
  critical: boolean;
  color: string;
  resolved:boolean;
  radius:number;
};
type ActivityEdgeData = {
  activity: Activity;
  visual: EdgeVisual;
  sourceCenter: { x: number; y: number };
  targetCenter: { x: number; y: number };
  color: string;
  showResults: boolean;
  mt?: number;
  onSelection: (nodes?: string[], edges?: string[]) => void;
  radius:number;
  resolved:boolean;
  symbols: ReturnType<typeof academicSymbols>;
  readOnly:boolean;
};

function EventNode({ data, selected }: NodeProps<Node<EventNodeData>>) {
  return (
    <div
      className={`event-node ${data.resolved?'resolved-event':''} ${selected ? "selected" : ""} ${data.critical ? "critical" : ""}`}
      style={{width:data.radius*(data.resolved?2.4:2),height:data.radius*2,...(data.critical?{borderColor:data.color}:{})}}
    >
      <Handle type="target" position={Position.Left} id="in" />
      {data.resolved ? <svg className="event-diamond" width={data.radius*2.4} height={data.radius*2} overflow="visible" aria-label={`Suceso ${data.label}, Ft ${data.early??'sin calcular'}, FT ${data.late??'sin calcular'}`}>
        <polygon points={`0,${data.radius} ${data.radius*1.2},0 ${data.radius*2.4},${data.radius} ${data.radius*1.2},${data.radius*2}`} fill="var(--diamond-fill)" stroke={data.critical?data.color:'var(--diamond-border)'} strokeWidth="2"/>
        <path d={`M ${data.radius*1.2} 0 V ${data.radius*2}`} stroke="var(--diamond-border)" strokeWidth="2"/>
        {data.showLabels&&<text x={data.radius*1.2} y="-10" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="700">{data.label}</text>}
        {data.showDates&&<><text x={data.radius*.66} y={data.radius+5} textAnchor="middle" fill="white" fontSize="13">{data.early===undefined?'—':numberText(data.early)}</text><text x={data.radius*1.74} y={data.radius+5} textAnchor="middle" fill="white" fontSize="13">{data.late===undefined?'—':numberText(data.late)}</text></>}
      </svg> : <div className="event-number">{data.showLabels ? data.label : "•"}</div>}
      {!data.resolved && data.showDates && (
        <div className="event-dates">
          <span title="Fecha temprana">
            {data.early === undefined ? "—" : numberText(data.early)}
          </span>
          <span title="Fecha tardía">
            {data.late === undefined ? "—" : numberText(data.late)}
          </span>
        </div>
      )}
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

function ActivityEdge({
  id,
  data,
  selected,
}: EdgeProps<Edge<ActivityEdgeData>>) {
  const { getZoom, screenToFlowPosition } = useReactFlow();
  if (!data) return null;
  const { visual: v, activity: a, sourceCenter, targetCenter, color } = data;
  const geometry = edgeGeometry(sourceCenter, targetCenter, v,{radius:data.radius,shape:data.resolved?'diamond':'circle'});
  const text = a.dummy ? "f · 0" : `${a.name} · ${numberText(a.duration)}`;
  const labelWidth = Math.max(50, text.length * 7 + 16);
  function drag(
    e: React.PointerEvent,
    change: (next: EdgeVisual, dx: number, dy: number) => void,
  ) {
    data!.onSelection([], [id]);
    e.stopPropagation();
    e.preventDefault();
    if(data!.readOnly)return;
    const start = { x: e.clientX, y: e.clientY },
      zoom = getZoom();
    const original = structuredClone(v);
    const store = useProjectStore.getState();
    store.beginGesture();
    const move = (event: PointerEvent) =>
      store.editVisual((visual) => {
        const next = structuredClone(original);
        change(
          next,
          (event.clientX - start.x) / zoom,
          (event.clientY - start.y) / zoom,
        );
        visual.edges[id] = next;
      });
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      store.endGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  function insertPoint(e: React.MouseEvent) {
    e.stopPropagation();
    if (data!.readOnly) return;
    const clicked = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const points = v.kind === "segments" ? v.points?.length ? v.points : [geometry.control] : v.kind === "curve" ? [geometry.control] : [];
    const route = [sourceCenter, ...points, targetCenter];
    let insertAt = 0, nearestDistance = Infinity, projected = clicked;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1], dx = b.x - a.x, dy = b.y - a.y;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, ((clicked.x - a.x) * dx + (clicked.y - a.y) * dy) / length)) : 0;
      const point = { x: a.x + t * dx, y: a.y + t * dy };
      const distance = Math.hypot(clicked.x - point.x, clicked.y - point.y);
      if (distance < nearestDistance) { nearestDistance = distance; insertAt = i; projected = point; }
    }
    data!.onSelection([], [id]);
    useProjectStore.getState().editVisual(visual => {
      const edge = visual.edges[id];
      edge.kind = "segments";
      edge.points = [...points.slice(0, insertAt), projected, ...points.slice(insertAt)];
    });
  }
  return (
    <>
      <defs>
        <marker
          id={`arrow-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <g onDoubleClick={insertPoint}>
      <BaseEdge
        id={id}
        path={geometry.path}
        markerEnd={`url(#arrow-${id})`}
        interactionWidth={22}
        style={{
          stroke: color,
          strokeWidth: selected ? v.width + 1 : v.width,
          strokeDasharray: a.dummy ? "7 5" : undefined,
        }}
      />
      </g>
      <g
        className="edge-label"
        transform={`translate(${geometry.label.x},${geometry.label.y})`}
        onPointerDown={(e) =>
          drag(e, (next, dx, dy) => {
            next.labelX += dx;
            next.labelY += dy;
          })
        }
      >
        <rect
          x={-labelWidth / 2}
          y="-13"
          width={labelWidth}
          height={data.showResults ? 39 : 26}
          rx="5"
          fill="var(--canvas)"
          stroke={selected ? "var(--primary)" : "none"}
        />
        <text textAnchor="middle" dominantBaseline="central" fill={color}>
          {text}
        </text>
        {data.showResults && (
          <text y="19" textAnchor="middle" className="edge-margin">
            MT {numberText(data.mt ?? 0)}
          </text>
        )}
      </g>
      {data.resolved && data.symbols.map(symbol=><g key={symbol.kind} className="academic-symbol" data-testid={`${symbol.kind}-${a.name}`} transform={`translate(${symbol.x},${symbol.y})`} onPointerDown={e=>drag(e,(next,dx,dy)=>{const key=symbol.kind==='ufc'?'startLabel':'endLabel';next[key]={x:(v[key]?.x??0)+dx,y:(v[key]?.y??0)+dy};})}>
        <title>{symbol.kind==='ufc'?'Última fecha de comienzo':'Primera fecha de finalización'}: {numberText(symbol.value)}</title>
        <polygon points="-16,-16 19,0 -16,16" transform={`rotate(${symbol.angle})`} fill="var(--canvas)" stroke="var(--text)" strokeWidth="1.5"/>
        <text textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontWeight="650" fontSize="12">{numberText(symbol.value)}</text>
      </g>)}
      {selected && !data.readOnly && v.kind !== "straight" && (
        <>
          {(v.kind === "segments" && v.points?.length
            ? v.points
            : [geometry.control]
          ).map((point, i) => (
            <circle
              key={i}
              className="route-control"
              cx={point.x}
              cy={point.y}
              r="6"
              onDoubleClick={e=>{e.stopPropagation();if(v.kind!=="segments")return;useProjectStore.getState().editVisual(visual=>{const edge=visual.edges[id];edge.points=(v.points?.length?v.points:[geometry.control]).filter((_,index)=>index!==i);if(!edge.points.length){edge.kind="straight";edge.bend=0;}});}}
              onPointerDown={(e) =>
                drag(e, (next, dx, dy) => {
                  if (next.kind === "segments") {
                    next.points = structuredClone(
                      v.points?.length ? v.points : [geometry.control],
                    );
                    next.points[i] = { x: point.x + dx, y: point.y + dy };
                  } else {
                    const sx = targetCenter.x - sourceCenter.x,
                      sy = targetCenter.y - sourceCenter.y,
                      length = Math.hypot(sx, sy) || 1;
                    next.bend = v.bend + (-sy * dx + sx * dy) / length;
                  }
                })
              }
            />
          ))}
          {v.kind === "segments" && (v.points ?? []).slice(0, -1).map((point, i) => {
            const end = v.points![i + 1];
            return <rect key={`segment-${i}`} className="route-control route-segment-control" aria-label={`Mover tramo ${i + 1}`} x={(point.x + end.x) / 2 - 4} y={(point.y + end.y) / 2 - 4} width="8" height="8" style={{ cursor: "move" }} onPointerDown={e => drag(e, (next, dx, dy) => {
              next.points = structuredClone(v.points!);
              next.points[i] = { x: point.x + dx, y: point.y + dy };
              next.points[i + 1] = { x: end.x + dx, y: end.y + dy };
            })}><title>Arrastra para mover este tramo sin desconectar sus extremos</title></rect>;
          })}
        </>
      )}
    </>
  );
}

const sameEventData=(a:EventNodeData,b:EventNodeData)=>(Object.keys(a) as (keyof EventNodeData)[]).every(key=>a[key]===b[key]);
const sameActivityData=(x:ActivityEdgeData,y:ActivityEdgeData)=>{
  return x.activity === y.activity && x.visual === y.visual && x.onSelection === y.onSelection &&
    x.sourceCenter.x === y.sourceCenter.x && x.sourceCenter.y === y.sourceCenter.y &&
    x.targetCenter.x === y.targetCenter.x && x.targetCenter.y === y.targetCenter.y &&
    x.radius === y.radius && x.resolved === y.resolved && x.readOnly === y.readOnly &&
    x.color === y.color && x.showResults === y.showResults && x.mt === y.mt &&
    x.symbols.length === y.symbols.length && x.symbols.every((symbol, i) => {
      const next = y.symbols[i];
      return symbol.kind === next.kind && symbol.value === next.value && symbol.x === next.x && symbol.y === next.y && symbol.angle === next.angle;
    });
};
const nodeTypes = { event: memo(EventNode, (a, b) => a.selected === b.selected && sameEventData(a.data,b.data)) };
const edgeTypes = { activity: memo(ActivityEdge, (a, b) => a.id===b.id&&a.selected===b.selected&&!!a.data&&!!b.data&&sameActivityData(a.data,b.data)) };

export function NetworkCanvas({
  project,
  result,
  tool,
  selectedNodes,
  selectedEdges,
  onSelection,
  onAddEvent,
  onConnect,
  onEventClick,
  readOnly=false,
  reveal,
}: {
  project: Project;
  result?: CPMResult;
  tool: Tool;
  selectedNodes: string[];
  selectedEdges: string[];
  onSelection: (nodes?: string[], edges?: string[]) => void;
  onAddEvent: (point: { x: number; y: number }) => void;
  onConnect: (connection: Connection) => void;
  onEventClick: (id: string) => void;
  readOnly?:boolean;
  reveal?:{early:Set<string>;late:Set<string>;activities:boolean;margins:boolean;critical:boolean};
}) {
  const { screenToFlowPosition } = useReactFlow();
  const edit = useProjectStore((s) => s.edit);
  const editVisual = useProjectStore((s) => s.editVisual);
  const prefs = project.preferences;
  const radius = nodeRadius(project),resolved=isResolved(project);
  // Reuse unchanged models as well as renderers; React Flow subscribes to model identity.
  const nodeModels=useRef(new Map<string,Node<EventNodeData>>());
  const edgeModels=useRef(new Map<string,Edge<ActivityEdgeData>>());
  useEffect(()=>{const ids=new Set(project.events.map(e=>e.id));for(const id of nodeModels.current.keys())if(!ids.has(id))nodeModels.current.delete(id);},[project.events]);
  useEffect(()=>{const ids=new Set(project.activities.map(a=>a.id));for(const id of edgeModels.current.keys())if(!ids.has(id))edgeModels.current.delete(id);},[project.activities]);
  const nodes: Node<EventNodeData>[] = useMemo(
    () =>
      project.events.map((event) => ({
        id: event.id,
        type: "event",
        position: project.visual.nodes[event.id] ?? { x: 0, y: 0 },
        selected: selectedNodes.includes(event.id),
        style:{width:radius*(resolved?2.4:2),height:radius*2},
        data: {
          resolved,radius,
          label: event.label,
          early: !reveal||reveal.early.has(event.id)?result?.events[event.id]?.early:undefined,
          late: !reveal||reveal.late.has(event.id)?result?.events[event.id]?.late:undefined,
          showLabels: prefs.showLabels,
          showDates: prefs.showDates,
          color: prefs.criticalColor,
          critical:
            !!result &&
            prefs.highlight && (!reveal||reveal.critical) &&
            Math.abs(
              result.events[event.id].early - result.events[event.id].late,
            ) < 1e-9,
        },
      })).map(node=>{const old=nodeModels.current.get(node.id);if(old&&old.position===node.position&&old.selected===node.selected&&sameEventData(old.data,node.data))return old;nodeModels.current.set(node.id,node);return node;}),
    [project.events, project.visual.nodes, result, selectedNodes, reveal, radius, resolved, prefs.showLabels, prefs.showDates, prefs.criticalColor, prefs.highlight],
  );
  const edges: Edge<ActivityEdgeData>[] = useMemo(
    () =>
      project.activities
        .filter(
          (a) =>
            project.events.some((e) => e.id === a.source) &&
            project.events.some((e) => e.id === a.target),
        )
        .map((a) => {
          const v = project.visual.edges[a.id] ?? defaultEdgeVisual();
          return {
            id: a.id,
            source: a.source,
            target: a.target,
            sourceHandle: "out",
            targetHandle: "in",
            type: "activity",
            selected: selectedEdges.includes(a.id),
            data: {
              activity: a,
              visual: v,
              onSelection,
              sourceCenter: eventCenter(project,a.source),
              targetCenter: eventCenter(project,a.target),
              radius,resolved,readOnly,symbols:resolved&&result&&prefs.showDates&&(!reveal||reveal.activities)?academicSymbols(project,a,result):[],
              color:
                prefs.highlight && (!reveal||reveal.critical) && result?.activities[a.id]?.critical
                  ? prefs.criticalColor
                  : v.color,
              showResults: !!result && prefs.showDates && (!reveal||reveal.margins),
              mt: result?.activities[a.id]?.mt,
            },
          };
        }).map(edge=>{const old=edgeModels.current.get(edge.id);if(old&&old.selected===edge.selected&&old.data&&sameActivityData(old.data,edge.data))return old;edgeModels.current.set(edge.id,edge);return edge;}),
    [project, result, selectedEdges, onSelection, reveal, readOnly, radius, resolved, prefs.showDates, prefs.highlight, prefs.criticalColor],
  );
  const changeNodes = useCallback(
    (changes: NodeChange[]) => {
      const selections = changes.filter((c) => c.type === "select");
      if (selections.length) {
        const set = new Set(selectedNodes);
        for (const c of selections)
          if (c.type === "select") {
            if (c.selected) set.add(c.id);
            else set.delete(c.id);
          }
        onSelection([...set], undefined);
      }
      const positions = changes.filter(
        (c) => c.type === "position" && c.position,
      );
      if (positions.length)
        editVisual((visual) => {
          for (const c of positions)
            if (c.type === "position" && c.position) {
              const previous=visual.nodes[c.id];
              if(previous?.x!==c.position.x||previous?.y!==c.position.y)visual.nodes[c.id] = c.position;
            }
        });
    },
    [editVisual, onSelection, selectedNodes],
  );
  return (
    <div className={`network-canvas tool-${tool}`} data-testid="network-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={changeNodes}
        onEdgesChange={(changes) => {
          const set = new Set(selectedEdges);
          for (const c of changes)
            if (c.type === "select") {
              if (c.selected) set.add(c.id);
              else set.delete(c.id);
            }
          onSelection(undefined, [...set]);
        }}
        onNodeDragStart={() => useProjectStore.getState().beginGesture()}
        onNodeDragStop={() => useProjectStore.getState().endGesture()}
        onSelectionDragStart={() => useProjectStore.getState().beginGesture()}
        onSelectionDragStop={() => useProjectStore.getState().endGesture()}
        onNodeClick={(_, node) => onEventClick(node.id)}
        onConnect={onConnect}
        onReconnect={(edge, connection) =>
          edit((p) => {
            const a = p.activities.find((a) => a.id === edge.id)!;
            a.source = connection.source;
            a.target = connection.target;
          })
        }
        onPaneClick={(event) => {
          if (tool === "event")
            onAddEvent(
              screenToFlowPosition(
                { x: event.clientX, y: event.clientY },
                { snapToGrid: prefs.snap },
              ),
            );
          else onSelection([], []);
        }}
        snapToGrid={prefs.snap}
        snapGrid={[20, 20]}
        selectionOnDrag={tool === "select"}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        panOnDrag={[1, 2]}
        // Keep viewport movement explicit. An asynchronous auto-pan frame can
        // outlive drag-end in Firefox and continue moving the selected nodes.
        autoPanOnNodeDrag={false}
        autoPanOnSelection={false}
        nodesDraggable={!readOnly&&tool === "select"}
        nodesConnectable={!readOnly}
        edgesReconnectable={!readOnly}
        deleteKeyCode={null}
        minZoom={0.03}
        maxZoom={3}
        ariaLabelConfig={{
          "node.a11yDescription.default":
            "Pulsa Enter para seleccionar un suceso. Usa las flechas para moverlo y Escape para salir.",
          "node.a11yDescription.keyboardDisabled":
            "Pulsa Enter para seleccionar un suceso o Escape para salir.",
          "node.a11yDescription.ariaLiveMessage": ({ x, y }) =>
            `Suceso desplazado a X ${x}, Y ${y}.`,
          "edge.a11yDescription.default":
            "Pulsa Enter para seleccionar la actividad o Escape para salir.",
          "controls.ariaLabel": "Controles del lienzo",
          "controls.zoomIn.ariaLabel": "Acercar",
          "controls.zoomOut.ariaLabel": "Alejar",
          "controls.fitView.ariaLabel": "Ajustar diagrama a pantalla",
          "controls.interactive.ariaLabel": "Alternar interacción",
          "minimap.ariaLabel": "Vista general de la red",
          "handle.ariaLabel": "Conector de actividad",
        }}
      >
        {prefs.grid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.2}
            color="#cfd9d5"
          />
        )}
        <Controls showInteractive={false} />
        {!!nodes.length && (
          <MiniMap
            style={{ width: 110, height: 65 }}
            pannable
            zoomable
            nodeColor="#dceae4"
            nodeStrokeColor="#618578"
            maskColor="#f5f7f3bd"
          />
        )}
      </ReactFlow>
      {!project.events.length && (
        <div className="canvas-empty">
          <div className="empty-network">○ ──→ ○</div>
          <h2>Tu próxima ruta empieza aquí</h2>
          <p>
            Elige «Suceso» y haz clic en el lienzo,
            <br />o carga un ejercicio desde la barra superior.
          </p>
          <span>También puedes comenzar desde la tabla de actividades.</span>
        </div>
      )}
      <div className="canvas-caption">
        <span className="caption-dot" /> Red de actividades en flechas{" "}
        <span>AOA</span>
      </div>
      <div className="canvas-hint">
        {tool === "event"
          ? "Haz clic para crear un suceso"
          : tool === "activity" || tool === "dummy"
            ? "Haz clic en el suceso de origen y luego en el destino"
            : "Arrastra para seleccionar · Mayús para selección múltiple · Botón central para desplazar"}
      </div>
    </div>
  );
}
