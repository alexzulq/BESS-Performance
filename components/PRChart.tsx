import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AggregatedData } from '../types';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';

interface PRChartProps {
  data: AggregatedData[];
  title: string;
}

const PRChart: React.FC<PRChartProps> = ({ data, title }) => {
  const { chartColors, t } = useThemeLanguage();
  const formatPct = (num: number) => (num * 100).toFixed(1) + '%';

  return (
    <div className="h-[400px] w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
          <XAxis 
            dataKey="periodLabel" 
            tick={{ fill: chartColors.text, fontSize: 12 }} 
            axisLine={false} 
            tickLine={false}
            minTickGap={20}
          />
          <YAxis 
            tick={{ fill: chartColors.text, fontSize: 12 }} 
            axisLine={false} 
            tickLine={false}
            tickFormatter={(val) => (val * 100).toFixed(0) + '%'}
            domain={['auto', 'auto']} 
            label={{ value: t('label_pr'), angle: -90, position: 'insideLeft', fill: chartColors.text, fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value: number, name: string) => [formatPct(value), name]}
            contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: chartColors.tooltipBg,
                color: chartColors.tooltipText
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          <Line 
            type="monotone" 
            name={`${t('label_budget')} PR`}
            dataKey="prBudget" 
            stroke="#9ca3af" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 6 }}
          />
          
          <Line 
            type="monotone" 
            name={`${t('label_forecast')} PR`}
            dataKey="prForecast" 
            stroke="#fbbf24" 
            strokeWidth={2} 
            strokeDasharray="3 3"
            dot={false}
            activeDot={{ r: 6 }}
          />

          <Line 
            type="monotone" 
            name={`${t('label_actual')} PR`}
            dataKey="prActual" 
            stroke="#ea580c" 
            strokeWidth={data.length > 60 ? 1.5 : 3} 
            dot={data.length < 30 ? { r: 4, fill: '#ea580c', strokeWidth: 2, stroke: '#fff' } : false} 
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PRChart;