import React, { useMemo, useState } from 'react';
import { DailyData, SimulationResult, AggregatedData } from '../types';
import { runProjection, getSiteCapacityMap } from '../utils/solarCalculations';
import { generatePPT } from '../utils/pptGenerator';
import YieldChart from './YieldChart';
import IrradiationChart from './IrradiationChart';
import CumulativeChart from './CumulativeChart';
import PRChart from './PRChart';
import MetricsTable from './MetricsTable';
import EventsList from './EventsList';
import LossAnalysisCard from './LossAnalysisCard';
import { TrendingUp, Battery, Zap, Sun, Filter, X, Calendar, BarChart2, Presentation } from 'lucide-react';
import { format, isValid, endOfWeek, endOfQuarter, getYear, getQuarter, parseISO, startOfWeek, startOfQuarter } from 'date-fns';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';
import clsx from 'clsx';

interface DashboardProps {
  initialData: DailyData[];
  onReset: () => void;
}

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'quarterly';

const MetricCard: React.FC<{ title: string; value: string; subValue?: string; icon: React.ReactElement<{ className?: string }>; colorClass: string }> = ({ title, value, subValue, icon, colorClass }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start justify-between transition-colors">
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <h4 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h4>
      {subValue && <p className={`text-sm mt-1 font-medium ${colorClass}`}>{subValue}</p>}
    </div>
    <div className={`p-3 rounded-lg ${colorClass.replace('text-', 'bg-').replace('700', '50').replace('600', '50')} dark:bg-opacity-20 opacity-80`}>
      {React.cloneElement(icon, { className: `w-6 h-6 ${colorClass}` })}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ initialData, onReset }) => {
  const { t } = useThemeLanguage();
  const uniqueSites = useMemo(() => Array.from(new Set(initialData.map(d => d.siteName))).sort(), [initialData]);
  const minDataDate = initialData.length > 0 ? initialData[0].date : new Date();
  const maxDataDate = initialData.length > 0 ? initialData[initialData.length - 1].date : new Date();

  // Filter State
  const [selectedSites, setSelectedSites] = useState<string[]>(uniqueSites);
  const [startDate, setStartDate] = useState<string>(format(minDataDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(maxDataDate, 'yyyy-MM-dd'));
  const [prLookbackDays, setPrLookbackDays] = useState<number>(30);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');

  // Independent Capacity Calculation: Use FULL data to determine site capacities, 
  // ensuring the metric card is correct even if the date filter excludes data.
  const globalCapacityMap = useMemo(() => {
     return getSiteCapacityMap(initialData);
  }, [initialData]);

  const selectedCapacityMW = useMemo(() => {
     let totalKw = 0;
     selectedSites.forEach(site => {
         totalKw += globalCapacityMap.get(site) || 0;
     });
     return totalKw / 1000;
  }, [globalCapacityMap, selectedSites]);

  // Compute Result
  const result: SimulationResult = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    const filtered = initialData.filter(d => {
      const siteMatch = selectedSites.includes(d.siteName);
      const dateMatch = isValid(start) && isValid(end) ? (d.date >= start && d.date <= end) : true;
      return siteMatch && dateMatch;
    });

    if (filtered.length === 0) {
        // Fallback: run on 1 dummy row but pass the global capacity map so forecasts use correct size
        return runProjection(initialData.slice(0, 1), globalCapacityMap, prLookbackDays);
    }
    return runProjection(filtered, globalCapacityMap, prLookbackDays);
  }, [initialData, selectedSites, startDate, endDate, globalCapacityMap, prLookbackDays]);

  const { metrics, monthlyData, lossAnalysisYTD, lossAnalysisMTD, dailyData } = result;
  
  // Dynamic Aggregation Logic
  const currentViewData: AggregatedData[] = useMemo(() => {
      if (viewMode === 'monthly') return monthlyData;

      // Helper to aggregate raw DailyData
      const map = new Map<string, any>(); // Using any for intermediate accumulator
      
      dailyData.forEach(d => {
          let key = '';
          let label = '';
          
          if (viewMode === 'daily') {
              key = format(d.date, 'yyyy-MM-dd');
              label = format(d.date, 'MMM dd');
          } else if (viewMode === 'weekly') {
              // Use ISO Week logic (Monday Start) and ISO Year (RRRR) to avoid year mismatch
              const start = startOfWeek(d.date, { weekStartsOn: 1 });
              key = format(start, 'RRRR-II'); 
              label = `W${format(start, 'II')} ${format(start, 'RR')}`;
          } else if (viewMode === 'quarterly') {
              key = `${getYear(d.date)}-Q${getQuarter(d.date)}`;
              label = `Q${getQuarter(d.date)} ${getYear(d.date)}`;
          }

          if (!map.has(key)) {
              map.set(key, {
                  periodKey: key,
                  periodLabel: label,
                  kwhBudget: 0,
                  kwhActual: 0,
                  kwhForecast: 0,
                  ghiBudget: 0,
                  ghiActual: 0,
                  ghiForecast: 0,
                  theoreticalKwhBudget: 0,
                  theoreticalKwhActual: 0,
                  theoreticalKwhForecast: 0,
              });
          }
          
          const acc = map.get(key);
          const cap = globalCapacityMap.get(d.siteName) || d.systemCapacity || 0;

          acc.kwhBudget += d.kwhBudget;
          acc.kwhActual += (d.kwhActual || 0);
          acc.kwhForecast += d.kwhForecast || 0;
          
          acc.ghiBudget += d.ghiBudget;
          acc.ghiActual += (d.ghiActual || 0);
          acc.ghiForecast += d.ghiForecast || 0;

          acc.theoreticalKwhBudget += (d.ghiBudget * cap);
          
          if (!d.isForecast && d.kwhActual !== null && d.ghiActual !== null) {
            acc.theoreticalKwhActual += (d.ghiActual * cap);
          }
          if (d.isForecast) {
            acc.theoreticalKwhForecast += (d.ghiForecast * cap);
          }
      });

      const aggregated = Array.from(map.values()).map(acc => {
          const totalProjected = acc.kwhActual + acc.kwhForecast;
          const variancePct = acc.kwhBudget > 0 ? ((totalProjected - acc.kwhBudget) / acc.kwhBudget) * 100 : 0;
          
          const prBudget = acc.theoreticalKwhBudget > 0 ? acc.kwhBudget / acc.theoreticalKwhBudget : 0;
          const prActual = acc.theoreticalKwhActual > 0 ? acc.kwhActual / acc.theoreticalKwhActual : null;
          const prForecast = acc.theoreticalKwhForecast > 0 ? acc.kwhForecast / acc.theoreticalKwhForecast : null;

          return {
              periodKey: acc.periodKey,
              periodLabel: acc.periodLabel,
              kwhBudget: acc.kwhBudget,
              kwhActual: acc.kwhActual,
              kwhForecast: acc.kwhForecast,
              totalProjected,
              variancePct,
              ghiBudget: acc.ghiBudget,
              ghiActual: acc.ghiActual,
              ghiForecast: acc.ghiForecast,
              prBudget,
              prActual,
              prForecast,
              cumulativeKwhBudget: 0, // Placeholder
              cumulativeKwhProjected: 0,
              cumulativeKwhActual: null,
              cumulativeKwhForecast: null
          } as AggregatedData;
      }).sort((a, b) => a.periodKey.localeCompare(b.periodKey));

      // Calculate Cumulatives
      let runBudget = 0;
      let runProjected = 0;
      
      let lastActualIdx = -1;
      aggregated.forEach((item, idx) => {
          if (item.kwhForecast === 0) lastActualIdx = idx;
      });

      return aggregated.map((item, idx) => {
          runBudget += item.kwhBudget;
          runProjected += item.totalProjected;
          
          const isActualSeg = idx <= lastActualIdx;
          const isForecastSeg = idx >= lastActualIdx;

          return {
              ...item,
              cumulativeKwhBudget: runBudget,
              cumulativeKwhProjected: runProjected,
              cumulativeKwhActual: isActualSeg ? runProjected : null,
              cumulativeKwhForecast: isForecastSeg ? runProjected : null
          };
      });

  }, [dailyData, monthlyData, viewMode, globalCapacityMap]);

  const varianceColor = metrics.varianceYearEnd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const varianceSign = metrics.varianceYearEnd > 0 ? '+' : '';

  // PR Variance Calculation
  const prDiff = (metrics.trendPrVariance * 100).toFixed(1);
  const prSign = metrics.trendPrVariance > 0 ? '+' : '';
  const prColor = metrics.trendPrVariance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  const handleSiteToggle = (site: string) => {
      if (selectedSites.includes(site)) {
          if (selectedSites.length > 1) setSelectedSites(selectedSites.filter(s => s !== site));
      } else {
          setSelectedSites([...selectedSites, site]);
      }
  };

  const selectAllSites = () => setSelectedSites(uniqueSites);
  const deselectAllSites = () => setSelectedSites([]);

  const handleExportPPT = () => {
    generatePPT(result, selectedSites, selectedCapacityMW);
  };
  
  // Dynamic Chart Titles
  const yieldTitle = t(`chart_yield_${viewMode}`);
  const prTitle = t(`chart_pr_${viewMode}`);
  const irrTitle = t(`chart_irr_${viewMode}`);
  const tableTitle = t(`table_title_${viewMode}`);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboardTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {selectedSites.length === uniqueSites.length ? 'All Sites' : `${selectedSites.length} Sites`} 
            {' '} ({startDate} - {endDate})
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-full sm:w-auto">
                {(['daily', 'weekly', 'monthly', 'quarterly'] as ViewMode[]).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={clsx(
                            "flex-1 px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-all",
                            viewMode === mode 
                                ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm" 
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        )}
                    >
                        {mode}
                    </button>
                ))}
            </div>

            <button 
                onClick={handleExportPPT}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors shadow-sm"
            >
                <Presentation className="w-4 h-4 mr-2" />
                Export PPT
            </button>

            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center px-4 py-2 text-sm font-medium border rounded-lg transition-colors 
                ${showFilters 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'}`}
            >
                <Filter className="w-4 h-4 mr-2" />
                {t('btn_filters')}
            </button>
            <button 
                onClick={onReset}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
                {t('btn_reset')}
            </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-8 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><Filter className="w-4 h-4 mr-2"/> {t('filter_title')}</h3>
                  <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filter_selectSites')}</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                         <button onClick={selectAllSites} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
                         <button onClick={deselectAllSites} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Deselect All</button>
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
                          {uniqueSites.map(site => (
                              <label key={site} className="flex items-center space-x-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedSites.includes(site)} 
                                    onChange={() => handleSiteToggle(site)}
                                    className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-200">{site}</span>
                              </label>
                          ))}
                      </div>
                  </div>
                  <div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('filter_dateRange')}</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">From</span>
                                <input 
                                    type="date" 
                                    value={startDate}
                                    min={format(minDataDate, 'yyyy-MM-dd')}
                                    max={format(maxDataDate, 'yyyy-MM-dd')}
                                    onClick={(e) => {
                                        try { (e.currentTarget as any).showPicker() } catch(err) {}
                                    }}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 cursor-pointer"
                                />
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">To</span>
                                <input 
                                    type="date" 
                                    value={endDate}
                                    min={format(minDataDate, 'yyyy-MM-dd')}
                                    max={format(maxDataDate, 'yyyy-MM-dd')}
                                    onClick={(e) => {
                                        try { (e.currentTarget as any).showPicker() } catch(err) {}
                                    }}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 cursor-pointer"
                                />
                            </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">PR Lookback (Days)</label>
                        <div className="flex items-center gap-2">
                             <input 
                                type="number"
                                min={7}
                                max={365}
                                value={prLookbackDays}
                                onChange={(e) => setPrLookbackDays(Number(e.target.value))}
                                className="block w-24 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                             />
                             <span className="text-xs text-gray-500 dark:text-gray-400">Days used to calculate "Recent PR" trend.</span>
                        </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title={t('metric_yield')} 
          value={`${(metrics.totalProjected / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} MWh`}
          subValue={`${varianceSign}${metrics.varianceYearEnd.toFixed(1)}% ${t('sub_vsBudget')}`}
          icon={<Zap />}
          colorClass={varianceColor}
        />
        <MetricCard 
          title={t('metric_capacity')} 
          value={`${(selectedCapacityMW).toFixed(2)} MWp`}
          subValue={t('sub_totalCap')}
          icon={<Battery />}
          colorClass="text-blue-600 dark:text-blue-400"
        />
        <MetricCard 
          title={`${t('metric_pr')} (${prLookbackDays}d)`}
          value={`${(metrics.trendPr * 100).toFixed(1)}%`}
          subValue={`${prSign}${prDiff}% ${t('sub_vsBudget')}`}
          icon={<Sun />}
          colorClass={prColor}
        />
        <MetricCard 
          title={t('metric_horizon')} 
          value={`${currentViewData.filter(m => m.kwhForecast > 0).length} ${viewMode === 'daily' ? 'days' : viewMode === 'weekly' ? 'weeks' : viewMode === 'quarterly' ? 'qtrs' : t('table_month')}`}
          subValue={t('sub_remaining')}
          icon={<TrendingUp />}
          colorClass="text-indigo-600 dark:text-indigo-400"
        />
      </div>

      {/* Loss Analysis Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <LossAnalysisCard title={t('loss_ytd')} data={lossAnalysisYTD} />
          <LossAnalysisCard title={t('loss_mtd')} data={lossAnalysisMTD} />
      </div>

      {/* Main Charts Area */}
      <div className="space-y-8 mb-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <YieldChart data={currentViewData} title={yieldTitle} />
            <PRChart data={currentViewData} title={prTitle} />
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <CumulativeChart data={currentViewData} />
            <IrradiationChart data={currentViewData} title={irrTitle} />
         </div>
      </div>

      {/* Events Table (Only if events exist in current filtered data) */}
      <EventsList data={dailyData} />

      <MetricsTable data={currentViewData} title={tableTitle} />
    </div>
  );
};

export default Dashboard;