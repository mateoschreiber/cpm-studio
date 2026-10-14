import { useCallback, useMemo } from "react";
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
  type Activity,
  type CPMResult,
  type EdgeVisual,
  type Project,
} from "../core/types";
import { edgeGeometry } from "../services/geometry";
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
};
type ActivityEdgeData = {
  activity: Activity;
  visual: EdgeVisual;
  sourceCenter: { x: number; y: number };
  targetCenter: { x: number; y: number };
  color: string;
  showResults: boolean;
  mt?: number;
  select: () => void;
};

function EventNode({ data, selected }: NodeProps<Node<EventNodeData>>) {
  return (
    <div
      className={`event-node ${selected ? "selected" : ""} ${data.critical ? "critical" : ""}`}
      style={data.critical ? { borderColor: data.color } : undefined}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <div className="event-number">{data.showLabels ? data.label : "•"}</div>
      {data.showDates && (
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
  const { getZoom } = useReactFlow();
  if (!data) return null;
  const { visual: v, activity: a, sourceCenter, targetCenter, color } = data;
  const geometry = edgeGeometry(sourceCenter, targetCenter, v);
  const text = a.dummy ? "f · 0" : `${a.name} · ${numberText(a.duration)}`;
  const labelWidth = Math.max(50, text.length * 7 + 16);
  function drag(
    e: React.PointerEvent,
    change: (next: EdgeVisual, dx: number, dy: number) => void,
  ) {
    data!.select();
    e.stopPropagation();
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY },
      zoom = getZoom();
    const original = structuredClone(v);
    const store = useProjectStore.getState();
    store.beginGesture();
    const move = (event: PointerEvent) =>
      store.edit((p) => {
        const next = structuredClone(original);
        change(
          next,
          (event.clientX - start.x) / zoom,
          (event.clientY - start.y) / zoom,
        );
        p.visual.edges[id] = next;
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
      {selected && v.kind !== "straight" && (
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
        </>
      )}
    </>
  );
}

const nodeTypes = { event: EventNode };
const edgeTypes = { activity: ActivityEdge };

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
}) {
  const { screenToFlowPosition } = useReactFlow();
  const edit = useProjectStore((s) => s.edit);
  const prefs = project.preferences;
  const nodes: Node<EventNodeData>[] = useMemo(
    () =>
      project.events.map((event) => ({
        id: event.id,
        type: "event",
        position: project.visual.nodes[event.id] ?? { x: 0, y: 0 },
        selected: selectedNodes.includes(event.id),
        data: {
          label: event.label,
          early: result?.events[event.id]?.early,
          late: result?.events[event.id]?.late,
          showLabels: prefs.showLabels,
          showDates: prefs.showDates,
          color: prefs.criticalColor,
          critical:
            !!result &&
            prefs.highlight &&
            Math.abs(
              result.events[event.id].early - result.events[event.id].late,
            ) < 1e-9,
        },
      })),
    [project, result, selectedNodes],
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
          const source = project.visual.nodes[a.source] ?? { x: 0, y: 0 },
            target = project.visual.nodes[a.target] ?? { x: 0, y: 0 };
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
              select: () => onSelection([], [a.id]),
              sourceCenter: { x: source.x + 30, y: source.y + 30 },
              targetCenter: { x: target.x + 30, y: target.y + 30 },
              color:
                prefs.highlight && result?.activities[a.id]?.critical
                  ? prefs.criticalColor
                  : v.color,
              showResults: !!result && prefs.showDates,
              mt: result?.activities[a.id]?.mt,
            },
          };
        }),
    [project, result, selectedEdges, onSelection],
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
        edit((p) => {
          for (const c of positions)
            if (c.type === "position" && c.position)
              p.visual.nodes[c.id] = c.position;
        });
    },
    [edit, onSelection, selectedNodes, selectedEdges],
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
        nodesDraggable={tool === "select"}
        nodesConnectable={true}
        edgesReconnectable={true}
        deleteKeyCode={null}
        minZoom={0.15}
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
