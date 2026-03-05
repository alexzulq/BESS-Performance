import React from 'react';
import { LossFactors } from '../types';
import { BarChart3, CloudSun, AlertTriangle } from 'lucide-react';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';

interface LossAnalysisCardProps {
  title: string;
  data: LossFactors;
}

const LossBar: React.FC<{ label: string; value: number; total: number; color: string }> = ({ label, value, total, color }) => {
    const isPositive = value >= 0;
    const sign = isPositive ? '+' : '';
    const formatted = Math.round(value).toLocaleString();
    const percent = total !== 0 ? (value / total * 100).toFixed(1) : '0.0';
    
    return (
        <div className="flex items-center text-sm py-2">
            <span className="w-32 text-gray-600 dark:text-gray-400 font-medium">{label}</span>
            <div className="flex-1 flex items-center">
                <span className={`font-bold mr-2 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {sign}{formatted} kWh
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({sign}{percent}%)
                </span>
            </div>
        </div>
    );
}

const LossAnalysisCard: React.FC<LossAnalysisCardProps> = ({ title, data }) => {
  const { t } = useThemeLanguage();

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-full transition-colors">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"/>
            {title}
        </h3>
        <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
            {data.periodLabel}
        </span>
      </div>
      
      <div className="flex-1 flex flex-col justify-center space-y-6">
          <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('loss_totalBudget')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{Math.round(data.kwhBudget).toLocaleString()} kWh</p>
          </div>

          <div className="space-y-4 relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 ml-[8rem]"></div>
              
              <LossBar 
                  label={t('loss_irrImpact')} 
                  value={data.varianceIrradiance} 
                  total={data.kwhBudget} 
                  color="orange"
              />
              <LossBar 
                  label={t('loss_prImpact')} 
                  value={data.variancePr} 
                  total={data.kwhBudget} 
                  color="red"
              />
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('loss_totalVar')}</p>
              <div className="flex items-baseline">
                    <p className={`text-2xl font-bold ${data.varianceTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {data.varianceTotal > 0 ? '+' : ''}{Math.round(data.varianceTotal).toLocaleString()} kWh
                    </p>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        {t('sub_vsBudget')}
                    </span>
              </div>
          </div>
      </div>
      
      <div className="mt-6 bg-slate-50 dark:bg-gray-750 p-3 rounded-lg text-xs text-gray-500 dark:text-gray-400">
          <p className="flex items-start gap-2">
              <CloudSun className="w-4 h-4 mt-0.5" />
              {t('label_irr')}: Weather deviations.
          </p>
          <p className="flex items-start gap-2 mt-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              {t('label_pr')}: System efficiency (soiling/faults).
          </p>
      </div>
    </div>
  );
};

export default LossAnalysisCard;