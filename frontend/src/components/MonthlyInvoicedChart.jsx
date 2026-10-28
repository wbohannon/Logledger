import { useEffect, useMemo, useRef, useState } from 'react';

const MONTHS = 12;
const HEIGHT = 240;
const PAD = { top: 16, right: 8, bottom: 28, left: 56 };
const MAX_BAR = 24;

const money = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n) => (n >= 1000 ? `$${n / 1000}k` : `$${n}`);

/**
 * Bucket invoices by the month they were created (the invoice date), over the last 12 months.
 */
function bucketByMonth(invoices) {
  const now = new Date();
  const buckets = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, date: d, total: 0, paid: 0, count: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  for (const inv of invoices) {
    const d = new Date(inv.createdAt);
    const b = byKey[`${d.getFullYear()}-${d.getMonth()}`];
    if (!b) continue;
    b.total += inv.totalAmount;
    if (inv.status === 'paid') b.paid += inv.totalAmount;
    b.count += 1;
  }
  return buckets;
}

/** Pick a round tick step (1/2/5 × 10^n) giving ~4 gridlines, so labels land on readable values. */
function niceTicks(value) {
  const raw = Math.max(value, 1000) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const max = Math.ceil(Math.max(value, 1) / step) * step;
  const ticks = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return { max, ticks };
}

export default function MonthlyInvoicedChart({ invoices }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTable]);

  const buckets = useMemo(() => bucketByMonth(invoices), [invoices]);
  const { max: yMax, ticks } = niceTicks(Math.max(...buckets.map((b) => b.total)));

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / buckets.length;
  const barW = Math.min(MAX_BAR, band * 0.6);
  const y = (v) => PAD.top + plotH - (v / yMax) * plotH;
  // On narrow screens, label every other month so labels don't collide.
  const labelEvery = band < 36 ? 2 : 1;

  const yearTotal = buckets.reduce((s, b) => s + b.total, 0);
  const hovered = hover != null ? buckets[hover] : null;

  return (
    <div>
      <div className="chart-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Invoiced per month</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Last 12 months · {money(yearTotal)} total
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTable((s) => !s)}>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Invoices</th>
              <th>Invoiced</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {[...buckets].reverse().map((b) => (
              <tr key={b.key}>
                <td>{b.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td>
                <td>{b.count}</td>
                <td>{money(b.total)}</td>
                <td>{money(b.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={wrapRef} className="chart-wrap" onMouseLeave={() => setHover(null)}>
          <svg width={width} height={HEIGHT} role="img" aria-label="Column chart of invoiced amount per month for the last 12 months">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
                <text x={PAD.left - 8} y={y(t)} className="chart-axis" textAnchor="end" dominantBaseline="middle">
                  {moneyShort(t)}
                </text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const cx = PAD.left + band * i + band / 2;
              const h = (b.total / yMax) * plotH;
              const r = Math.min(4, h, barW / 2);
              const x0 = cx - barW / 2;
              const yBase = PAD.top + plotH;
              // Rounded top, square at the baseline.
              const d = h > 0
                ? `M${x0},${yBase} V${yBase - h + r} Q${x0},${yBase - h} ${x0 + r},${yBase - h} H${x0 + barW - r} Q${x0 + barW},${yBase - h} ${x0 + barW},${yBase - h + r} V${yBase} Z`
                : null;
              return (
                <g key={b.key}>
                  {hover === i && (
                    <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} className="chart-hover-band" />
                  )}
                  {d && <path d={d} className="chart-bar" />}
                  {i % labelEvery === (buckets.length - 1) % labelEvery && (
                    <text x={cx} y={HEIGHT - 8} className="chart-axis" textAnchor="middle">
                      {b.date.toLocaleDateString(undefined, { month: 'short' })}
                    </text>
                  )}
                  {/* Hit target covers the full column band, larger than the bar. */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
          {hovered && (
            <div
              className="chart-tooltip"
              style={{
                left: Math.min(Math.max(PAD.left + band * hover + band / 2, 90), width - 90),
                top: Math.max(y(hovered.total) - 8, 0),
              }}
            >
              <div className="chart-tooltip-title">
                {hovered.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </div>
              <div className="chart-tooltip-value">{money(hovered.total)}</div>
              <div className="chart-tooltip-meta">
                {hovered.count} invoice{hovered.count === 1 ? '' : 's'} · {money(hovered.paid)} paid
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
