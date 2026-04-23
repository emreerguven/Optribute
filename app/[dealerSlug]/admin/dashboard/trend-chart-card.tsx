"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/src/lib/currency";
import type { DashboardTrendPoint } from "@/src/server/domain/dashboard/service";

type Props = {
  title: string;
  series: DashboardTrendPoint[];
  mode: "orders" | "revenue";
};

type Tick = {
  value: number;
  y: number;
};

const WIDTH = 560;
const HEIGHT = 220;
const PADDING_TOP = 18;
const PADDING_RIGHT = 16;
const PADDING_BOTTOM = 24;
const PADDING_LEFT = 52;

function formatPrimaryValue(point: DashboardTrendPoint, mode: Props["mode"]) {
  return mode === "orders" ? `${point.ordersCount} sipariş` : formatCurrency(point.revenueCents);
}

function formatYAxisValue(value: number, mode: Props["mode"]) {
  if (mode === "orders") {
    return `${Math.round(value)}`;
  }

  return formatCurrency(value);
}

function getValue(point: DashboardTrendPoint, mode: Props["mode"]) {
  return mode === "orders" ? point.ordersCount : point.revenueCents;
}

function getNiceMax(rawMax: number, mode: Props["mode"]) {
  if (rawMax <= 0) {
    return mode === "orders" ? 4 : 1000;
  }

  if (mode === "orders") {
    return Math.max(4, Math.ceil(rawMax / 2) * 2);
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  const normalized = rawMax / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }

  if (normalized <= 2) {
    return 2 * magnitude;
  }

  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}

function buildTicks(maxValue: number, mode: Props["mode"]): Tick[] {
  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const tickCount = 4;
  const ticks: Tick[] = [];

  for (let index = 0; index < tickCount; index += 1) {
    const ratio = index / (tickCount - 1);
    const value = maxValue * (1 - ratio);
    const y = PADDING_TOP + chartHeight * ratio;

    ticks.push({
      value: mode === "orders" ? Math.round(value) : value,
      y
    });
  }

  return ticks;
}

function buildXLabelIndices(length: number) {
  if (length <= 1) {
    return [0];
  }

  const desiredTickCount = Math.min(6, length);
  const indices = new Set<number>([0, length - 1]);

  for (let index = 1; index < desiredTickCount - 1; index += 1) {
    indices.add(Math.round((index * (length - 1)) / (desiredTickCount - 1)));
  }

  return [...indices].sort((left, right) => left - right);
}

function getPointX(index: number, length: number) {
  const chartWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;

  if (length <= 1) {
    return PADDING_LEFT + chartWidth / 2;
  }

  return PADDING_LEFT + (chartWidth * index) / (length - 1);
}

function getPointY(value: number, maxValue: number) {
  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const ratio = maxValue > 0 ? value / maxValue : 0;

  return PADDING_TOP + chartHeight - ratio * chartHeight;
}

function getTrendPath(values: number[], maxValue: number) {
  return values
    .map((value, index) => {
      const x = getPointX(index, values.length);
      const y = getPointY(value, maxValue);

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function getAreaPath(values: number[], maxValue: number) {
  const linePath = getTrendPath(values, maxValue);
  const startX = getPointX(0, values.length);
  const endX = getPointX(values.length - 1, values.length);
  const baseY = HEIGHT - PADDING_BOTTOM;

  return `${linePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
}

function getTooltipStyle(index: number, length: number) {
  const x = getPointX(index, length);
  const percentage = (x / WIDTH) * 100;

  return {
    left: `clamp(5.5rem, ${percentage}%, calc(100% - 5.5rem))`
  };
}

export function TrendChartCard({ title, series, mode }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const values = useMemo(() => series.map((point) => getValue(point, mode)), [mode, series]);
  const maxValue = useMemo(() => getNiceMax(Math.max(...values, 0), mode), [mode, values]);
  const yTicks = useMemo(() => buildTicks(maxValue, mode), [maxValue, mode]);
  const xLabelIndices = useMemo(() => buildXLabelIndices(series.length), [series.length]);
  const linePath = useMemo(() => getTrendPath(values, maxValue), [maxValue, values]);
  const areaPath = useMemo(() => getAreaPath(values, maxValue), [maxValue, values]);
  const highestPoint = useMemo(
    () =>
      series.reduce((best, point) => (getValue(point, mode) > getValue(best, mode) ? point : best), series[0]!),
    [mode, series]
  );
  const latestPoint = series[series.length - 1]!;
  const activeIndex = hoveredIndex ?? series.length - 1;
  const activePoint = series[activeIndex]!;
  const activeValue = values[activeIndex] ?? 0;
  const activeX = getPointX(activeIndex, series.length);
  const activeY = getPointY(activeValue, maxValue);
  const chartBaseY = HEIGHT - PADDING_BOTTOM;

  return (
    <div className="summary-card stack dashboard-trend-card">
      <div className="dashboard-card-head">
        <div>
          <span className="detail-label">{title}</span>
          <strong className="dashboard-strong">{formatPrimaryValue(latestPoint, mode)}</strong>
        </div>
        <span className="caption">Zirve: {highestPoint.shortLabel}</span>
      </div>

      <div
        className="dashboard-chart-shell"
        onMouseLeave={() => setHoveredIndex(null)}
        onFocus={() => undefined}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="dashboard-chart" aria-label={title} role="img">
          {yTicks.map((tick, index) => (
            <g key={`${title}-tick-${index}`}>
              <line
                x1={PADDING_LEFT}
                x2={WIDTH - PADDING_RIGHT}
                y1={tick.y}
                y2={tick.y}
                className="dashboard-chart-grid"
              />
              <text x={PADDING_LEFT - 10} y={tick.y + 4} textAnchor="end" className="dashboard-chart-y-label">
                {formatYAxisValue(tick.value, mode)}
              </text>
            </g>
          ))}

          {xLabelIndices.map((index) => {
            const x = getPointX(index, series.length);

            return (
              <text
                key={`${title}-x-${index}`}
                x={x}
                y={HEIGHT - 4}
                textAnchor="middle"
                className="dashboard-chart-x-label"
              >
                {series[index]?.shortLabel}
              </text>
            );
          })}

          <path d={areaPath} className="dashboard-chart-area" />
          <path d={linePath} className="dashboard-chart-line" />

          {hoveredIndex !== null ? (
            <line
              x1={activeX}
              x2={activeX}
              y1={PADDING_TOP}
              y2={chartBaseY}
              className="dashboard-chart-hover-line"
            />
          ) : null}

          <circle cx={activeX} cy={activeY} r={5.5} className="dashboard-chart-point-ring" />
          <circle cx={activeX} cy={activeY} r={3.5} className="dashboard-chart-point" />

          {series.map((point, index) => {
            const x = getPointX(index, series.length);
            const nextX =
              index < series.length - 1 ? getPointX(index + 1, series.length) : WIDTH - PADDING_RIGHT;
            const width = Math.max(16, nextX - x);

            return (
              <rect
                key={`${title}-hover-${point.dateKey}`}
                x={index === 0 ? PADDING_LEFT - 8 : x - width / 2}
                y={PADDING_TOP}
                width={width}
                height={chartBaseY - PADDING_TOP}
                className="dashboard-chart-hitbox"
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                tabIndex={0}
                aria-label={`${point.shortLabel} ${title}`}
              />
            );
          })}
        </svg>

        <div className="dashboard-chart-tooltip" style={getTooltipStyle(activeIndex, series.length)}>
          <strong>{activePoint.shortLabel}</strong>
          <span>Sipariş: {activePoint.ordersCount}</span>
          <span>Ciro: {formatCurrency(activePoint.revenueCents)}</span>
        </div>
      </div>
    </div>
  );
}
