import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush
} from 'recharts';
import { DailyData } from '../types';
import { format } from 'date-fns';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';

interface DailyYieldChartProps {
  data: DailyData[];
}

const DailyYieldChart: React.FC<DailyYieldChartProps> = ({ data }) => {
  const { chartColors, t, theme } = useThemeLanguage();
  const formatNumber = (num: number) => 
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);

  const formatDate = (date: Date) => {
      try {
          return format(date, 'MMM dd');
      } catch (e) {
          return '';
      }
  };
  
  const formatTooltipDate = (date: Date) => {
      try {
          return format(date, 'MMM dd, yyyy');
      } catch (e) {
          return '';
      }
  };

  return (
    <div className="h-[450px] w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{t('chart_dailyYield')}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
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
            dataKey="date" 
            tickFormatter={formatDate}
            tick={{ fill: chartColors.text, fontSize: 12 }} 
            minTickGap={30}
            axisLine={false} 
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: chartColors.text, fontSize: 12 }} 
            axisLine={false} 
            tickLine={false}
            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
            label={{ value: `${t('label_energy')} (kWh)`, angle: -90, position: 'insideLeft', fill: chartColors.text, fontSize: 12 }}
          />
          <Tooltip 
            labelFormatter={formatTooltipDate}
            formatter={(value: number, name: string) => [formatNumber(value) + ' kWh', name]}
            contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: chartColors.tooltipBg,
                color: chartColors.tooltipText
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Brush 
            dataKey="date" 
            height={30} 
            stroke={theme === 'dark' ? "#4b5563" : "#94a3b8"}
            tickFormatter={formatDate} 
            fill={theme === 'dark' ? "#1f2937" : "#f8fafc"}
          />
          
          <Bar name={t('label_actual')} dataKey="kwhActual" stackId="a" fill="#1e40af" barSize={6} radius={[0, 0, 0, 0]} />
          <Bar name={t('label_forecast')} dataKey="kwhForecast" stackId="a" fill="#93c5fd" barSize={6} radius={[2, 2, 0, 0]} />
          
          <Line 
            type="monotone" 
            name={t('label_budget')} 
            dataKey="kwhBudget" 
            stroke="#dc2626" 
            strokeWidth={1.5} 
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DailyYieldChart;