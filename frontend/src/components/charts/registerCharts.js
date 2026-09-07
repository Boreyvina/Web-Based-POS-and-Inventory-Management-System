/**
 * Chart.js v4 is modular: you must register the pieces you use, once,
 * before any chart renders. Importing this file anywhere does that.
 */
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  Title, Tooltip, Legend, Filler
);

ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";
ChartJS.defaults.color = '#64748B';
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.boxWidth = 8;

export const PALETTE = ['#12867F', '#0B1F24', '#B45309', '#7C3AED', '#0369A1', '#BE185D', '#4D7C0F'];
