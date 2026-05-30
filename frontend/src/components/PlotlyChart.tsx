import { Component } from "react";
import type { PlotlyData, PlotlyChart as PlotlyChartType } from "../types";
import Plotly from "plotly.js-dist-min";

// Patch purge to be safe when the DOM node was already removed
const origPurge = Plotly.purge;
Plotly.purge = function safePurge(...args: any[]) {
  try { return origPurge.apply(this, args); } catch { /* DOM already removed */ }
};

import * as factory from "react-plotly.js/factory";

const createPlotComponent: (p: any) => any =
  (factory as any).default?.default ?? (factory as any).default ?? factory;
const Plot = createPlotComponent(Plotly);

interface Props {
  chart: PlotlyChartType | null;
  className?: string;
  onHover?: (data: any) => void;
  onUnhover?: () => void;
}

const layoutDefaults = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: { family: "Barlow, sans-serif", color: "#fff" },
  margin: { t: 10, r: 10, b: 40, l: 60 },
  xaxis: { gridcolor: "rgba(255,255,255,0.06)", zeroline: false, color: "rgba(255,255,255,0.4)" },
  yaxis: { gridcolor: "rgba(255,255,255,0.06)", zeroline: false, color: "rgba(255,255,255,0.4)" },
  hovermode: "closest",
};

class PlotlyErrorBoundary extends Component<{ children: React.ReactNode }> {
  componentDidCatch() {
    // Suppress Plotly unmount errors (clean/purge after DOM removed)
  }
  render() {
    return this.props.children;
  }
}

let _chartId = 0;

export default function PlotlyChart({ chart, className = "", onHover, onUnhover }: Props) {
  if (!chart || !chart.data || chart.data.length === 0) return null;

  const id = ++_chartId;

  return (
    <div className={`w-full ${className}`}>
      <PlotlyErrorBoundary>
        <Plot
          key={id}
          data={chart.data as unknown as Plotly.Data[]}
          layout={{ ...layoutDefaults, ...chart.layout } as Partial<Plotly.Layout>}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
          onHover={onHover}
          onUnhover={onUnhover}
        />
      </PlotlyErrorBoundary>
    </div>
  );
}
