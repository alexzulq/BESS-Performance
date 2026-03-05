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
  TooltipProps,
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { AggregatedData } from '../types';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';

interface YieldChartProps {
  data: AggregatedData[];
  title: string;
}

const YieldChart: React.FC<YieldChartProps> = ({ data, title }) => {
  const { chartColors, t } = useThemeLanguage();
  const formatNumber = (num: number) => 
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);

  // Auto-adjust bar size based on data density
  const barSize = data.length > 50 ? undefined : data.length > 20 ? 10 : 30;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataRow = payload[0].payload as AggregatedData;
      return (
        <div 
          className="text-sm p-3 rounded-lg shadow-lg border"
          style={{ 
            backgroundColor: chartColors.tooltipBg, 
            borderColor: chartColors.grid, 
            color: chartColors.tooltipText 
          }}
        >
          <p className="font-semibold mb-2">{label}</p>
          
          {/* Actual */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1e40af' }}></div>
            <span className="flex-1">{t('label_actual')}:</span>
            <span className="font-mono font-medium">{formatNumber(dataRow.kwhActual)} kWh</span>
          </div>

          {/* Budget */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#dc2626' }}></div>
            <span className="flex-1">{t('label_budget')}:</span>
            <span className="font-mono font-medium">{formatNumber(dataRow.kwhBudget)} kWh</span>
          </div>

          {/* Total Projected (Actual + Forecast) */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#93c5fd' }}></div>
            <span className="flex-1">{t('label_actual')} + {t('label_forecast')}:</span>
            <span className="font-mono font-medium">{formatNumber(dataRow.totalProjected)} kWh</span>
          </div>
        </div>
      );
    }
    return null;
  };

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
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            label={{ value: `${t('label_energy')} (kWh)`, angle: -90, position: 'insideLeft', fill: chartColors.text, fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          <Bar name={t('label_actual')} dataKey="kwhActual" stackId="a" fill="#1e40af" barSize={barSize} radius={[0, 0, 0, 0]} />
          <Bar name={t('label_forecast')} dataKey="kwhForecast" stackId="a" fill="#93c5fd" barSize={barSize} radius={[2, 2, 0, 0]} />
          
          <Line 
            type="monotone" 
            name={t('label_budget')} 
            dataKey="kwhBudget" 
            stroke="#dc2626" 
            strokeWidth={data.length > 100 ? 1.5 : 3} 
            dot={data.length < 30 ? { r: 4, fill: '#dc2626', strokeWidth: 2, stroke: '#fff' } : false} 
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default YieldChart;