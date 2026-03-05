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
} from 'recharts';
import { AggregatedData } from '../types';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';

interface IrradiationChartProps {
  data: AggregatedData[];
  title: string;
}

const IrradiationChart: React.FC<IrradiationChartProps> = ({ data, title }) => {
  const { chartColors, t } = useThemeLanguage();
  const formatNumber = (num: number) => 
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(num);

  const barSize = data.length > 50 ? undefined : data.length > 20 ? 10 : 30;

  return (
    <div className="h-[400px] w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{title}</h3>
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
            label={{ value: `${t('label_irr')} (kWh/m²)`, angle: -90, position: 'insideLeft', fill: chartColors.text, fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value: number, name: string) => [formatNumber(value) + ' kWh/m²', name]}
            contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: chartColors.tooltipBg,
                color: chartColors.tooltipText
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          <Bar name={t('label_actual')} dataKey="ghiActual" stackId="a" fill="#ea580c" barSize={barSize} radius={[0, 0, 0, 0]} />
          <Bar name={t('label_forecast')} dataKey="ghiForecast" stackId="a" fill="#fdba74" barSize={barSize} radius={[2, 2, 0, 0]} />
          
          <Line 
            type="monotone" 
            name={t('label_budget')} 
            dataKey="ghiBudget" 
            stroke="#4b5563" 
            strokeWidth={data.length > 100 ? 1.5 : 3} 
            dot={data.length < 30 ? { r: 4, fill: '#4b5563', strokeWidth: 2, stroke: '#fff' } : false} 
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default IrradiationChart;