const FLAME = "rgb(255 46 46 / 0.5)";
const BLAZE = "rgb(255 106 61 / 0.65)";

interface NodeSpec {
  x: number;
  y: number;
  w: number;
  tag: string;
  name: string;
  sub: string;
  hot?: boolean;
}

function GraphNode({ x, y, w, tag, name, sub, hot = false }: NodeSpec) {
  const h = 78;
  const led = hot ? "#ff6a3d" : "#ff2e2e";
  const tick = "rgb(255 46 46 / 0.55)";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#0d0d11"
        stroke="rgb(255 46 46 / 0.35)"
      />
      {/* title-bar strip */}
      <rect x={x} y={y} width={w} height={2} fill="rgb(255 46 46 / 0.4)" />
      <rect x={x} y={y} width={44} height={2} fill={led} />
      {/* machined corner ticks */}
      <path d={`M ${x + 5} ${y + 16} V ${y + 5} H ${x + 16}`} fill="none" stroke={tick} />
      <path d={`M ${x + w - 16} ${y + 5} H ${x + w - 5} V ${y + 16}`} fill="none" stroke={tick} />
      <path d={`M ${x + 5} ${y + h - 16} V ${y + h - 5} H ${x + 16}`} fill="none" stroke={tick} />
      <path d={`M ${x + w - 16} ${y + h - 5} H ${x + w - 5} V ${y + h - 16}`} fill="none" stroke={tick} />
      {/* led */}
      <rect x={x + 12} y={y + 13} width={12} height={12} fill={led} opacity={0.18} />
      <rect x={x + 15} y={y + 16} width={6} height={6} fill={led} />
      <text
        x={x + 32}
        y={y + 23}
        className="font-mono"
        fontSize={8.5}
        letterSpacing={2.2}
        fill="#8b8b95"
      >
        {tag}
      </text>
      <text
        x={x + 13}
        y={y + 47}
        className="font-mono"
        fontSize={15}
        fontWeight={600}
        letterSpacing={1.2}
        fill="#ece9e2"
      >
        {name}
      </text>
      <text
        x={x + 13}
        y={y + 65}
        className="font-mono"
        fontSize={9.5}
        letterSpacing={1}
        fill="#8b8b95"
      >
        {sub}
      </text>
    </g>
  );
}

interface EdgeSpec {
  d: string;
  label: string;
  lx: number;
  ly: number;
  warm?: boolean;
}

function Edge({ d, label, lx, ly, warm = false }: EdgeSpec) {
  const dash = warm ? "3 5" : "6 4";
  const chipW = label.length * 7.4 + 18;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={warm ? BLAZE : FLAME}
        strokeWidth={1.5}
        strokeDasharray={dash}
        markerEnd={warm ? "url(#arch-arrow-blaze)" : "url(#arch-arrow)"}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={warm ? "-24" : "-20"}
          dur={warm ? "1.6s" : "1.4s"}
          repeatCount="indefinite"
        />
      </path>
      <rect
        x={lx - chipW / 2}
        y={ly - 9}
        width={chipW}
        height={18}
        fill="#060607"
        stroke="rgb(255 46 46 / 0.25)"
      />
      <text
        x={lx}
        y={ly + 3.5}
        textAnchor="middle"
        className="font-mono"
        fontSize={9.5}
        letterSpacing={1.2}
        fill={warm ? "#ff6a3d" : "#8b8b95"}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

function ColumnTag({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <text
        x={x}
        y={20}
        textAnchor="middle"
        className="font-mono"
        fontSize={9}
        letterSpacing={3.5}
        fill="rgb(139 139 149 / 0.55)"
      >
        {label}
      </text>
      <path
        d={`M ${x - 58} 27 H ${x + 58}`}
        stroke="rgb(255 46 46 / 0.2)"
        strokeDasharray="2 4"
      />
    </g>
  );
}

/**
 * End-to-end dispatch DAG — voice in on the left, wheels out on the
 * right, operator verdict looping back into the API core.
 */
export function ArchGraph() {
  return (
    <svg
      viewBox="0 0 1160 640"
      className="h-auto w-full"
      role="img"
      aria-label="Siren system architecture graph"
    >
      <defs>
        <marker
          id="arch-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(255 46 46 / 0.75)" />
        </marker>
        <marker
          id="arch-arrow-blaze"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(255 106 61 / 0.8)" />
        </marker>
      </defs>

      <ColumnTag x={250} label="INGRESS" />
      <ColumnTag x={660} label="CORE // DISPATCH" />
      <ColumnTag x={1045} label="CONTROL" />

      {/* edges — drawn under nodes' caption chips */}
      <Edge d="M 190 79 H 260" label="voice" lx={225} ly={79} />
      <Edge d="M 370 118 V 220" label="server events" lx={370} ly={169} />
      <Edge d="M 480 259 H 550" label="ingest" lx={515} ly={259} />
      <Edge d="M 660 298 V 420" label="upsert incidents/calls" lx={660} ly={359} />
      <Edge d="M 890 518 V 538 H 745 V 498" label="writes" lx={817} ly={538} />
      <Edge d="M 770 430 H 885 V 259 H 950" label="REST poll" lx={885} ly={344} />
      <Edge d="M 1045 298 V 540" label="proposals" lx={1045} ly={419} />
      <Edge
        d="M 950 579 H 529 Q 515 579 515 565 V 273 Q 515 259 529 259 H 550"
        label="approve / reject"
        lx={732}
        ly={579}
        warm
      />

      {/* nodes */}
      <GraphNode x={20} y={40} w={170} tag="SRC-01" name="CALLER" sub="911 line" />
      <GraphNode
        x={260}
        y={40}
        w={220}
        tag="AI-AGENT"
        name="VAPI VOICE AGENT"
        sub="intake + triage LLM"
        hot
      />
      <GraphNode
        x={260}
        y={220}
        w={220}
        tag="ENDPOINT"
        name="WEBHOOK"
        sub="POST /api/vapi/webhook"
      />
      <GraphNode
        x={550}
        y={220}
        w={220}
        tag="CORE"
        name="FASTAPI"
        sub="routers // app.py"
        hot
      />
      <GraphNode x={550} y={420} w={220} tag="STORE" name="SQLITE" sub="siren.db" />
      <GraphNode
        x={790}
        y={440}
        w={200}
        tag="SIM"
        name="TELEMETRY SIM"
        sub="asyncio 4s tick"
      />
      <GraphNode
        x={950}
        y={220}
        w={190}
        tag="UI"
        name="NEXT.JS CONSOLE"
        sub="poll /api/* 4s"
        hot
      />
      <GraphNode
        x={950}
        y={540}
        w={190}
        tag="HUMAN"
        name="OPERATOR"
        sub="human in the loop"
      />
    </svg>
  );
}
