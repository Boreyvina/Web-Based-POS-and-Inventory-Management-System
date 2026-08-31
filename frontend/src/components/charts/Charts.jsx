import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { PALETTE } from './registerCharts';
import { money } from '../../utils/format';

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
};

export function RevenueChart({ data }) {
  if (!data?.labels?.length) return <ChartEmpty />;

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Revenue',
        data: data.datasets[0].data,
        borderColor: PALETTE[0],
        backgroundColor: 'rgba(18,134,127,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className="h-64 sm:h-72">
      <Line
        data={chartData}
        options={{
          ...baseOptions,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => ` ${money(c.parsed.y)}` } },
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (v) => money(v) }, grid: { color: '#EEF2F2' } },
            x: { grid: { display: false } },
          },
        }}
      />
    </div>
  );
}

export function TopProductsChart({ data }) {
  if (!data?.labels?.length) return <ChartEmpty />;

  return (
    <div className="h-64 sm:h-72">
      <Bar
        data={{
          labels: data.labels,
          datasets: [
            {
              label: 'Units sold',
              data: data.datasets[0].data,
              backgroundColor: PALETTE[0],
              borderRadius: 4,
              barThickness: 18,
            },
          ],
        }}
        options={{
          ...baseOptions,
          indexAxis: 'y', // horizontal — product names need the room
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: '#EEF2F2' }, ticks: { precision: 0 } },
            y: { grid: { display: false } },
          },
        }}
      />
    </div>
  );
}

export function CategoryChart({ data }) {
  if (!data?.labels?.length) return <ChartEmpty />;

  return (
    <div className="h-64 sm:h-72">
      <Doughnut
        data={{
          labels: data.labels,
          datasets: [
            {
              data: data.datasets[0].data,
              backgroundColor: PALETTE,
              borderWidth: 2,
              borderColor: '#fff',
            },
          ],
        }}
        options={{
          ...baseOptions,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (c) => ` ${c.label}: ${money(c.parsed)}` } },
          },
        }}
      />
    </div>
  );
}

export function StockChart({ data }) {
  if (!data?.labels?.length) return <ChartEmpty />;

  return (
    <div className="h-72 sm:h-80">
      <Bar
        data={{
          labels: data.labels,
          datasets: [
            { label: 'In stock', data: data.datasets[0].data, backgroundColor: PALETTE[0], borderRadius: 4 },
            { label: 'Reorder at', data: data.datasets[1].data, backgroundColor: '#CBD5E1', borderRadius: 4 },
          ],
        }}
        options={{
          ...baseOptions,
          plugins: { legend: { position: 'top', align: 'end' } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#EEF2F2' }, ticks: { precision: 0 } },
            x: { grid: { display: false }, ticks: { maxRotation: 60, minRotation: 30, font: { size: 10 } } },
          },
        }}
      />
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="grid h-64 place-items-center text-sm text-slate-400 sm:h-72">
      No sales recorded in this period yet
    </div>
  );
}
