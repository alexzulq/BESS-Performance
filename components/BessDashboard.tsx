
import React, { useMemo, useState } from 'react';
import { BessDailyData } from '../types';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, BarChart, Bar, ReferenceLine, ComposedChart, Cell } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Filter, Calendar, RotateCw, Upload, Presentation, X, ShieldCheck, Zap } from 'lucide-react';
import { format, isValid, endOfWeek, endOfMonth, endOfYear, subMonths, parseISO, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import clsx from 'clsx';
import ColorLegend from './ColorLegend';

interface BessDashboardProps {
  data: BessDailyData[];
  onReset: () => void;
}

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const BessDashboard: React.FC<BessDashboardProps> = ({ data, onReset }) => {
  const { chartColors, t } = useThemeLanguage();

  // 1. Initial State for Filters
  const minDate = data.length > 0 ? data[0].date : new Date();
  const maxDate = data.length > 0 ? data[data.length - 1].date : new Date();

  const [startDate, setStartDate] = useState(format(minDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(maxDate, 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [showFilters, setShowFilters] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  // Quick Filter Handlers
  const applyQuickFilter = (type: 'week' | 'month' | 'year' | 'last-month') => {
      const now = new Date();
      let start, end;
      
      switch(type) {
          case 'week':
              start = startOfWeek(now, { weekStartsOn: 1 });
              end = endOfWeek(now, { weekStartsOn: 1 });
              break;
          case 'month':
              start = startOfMonth(now);
              end = endOfMonth(now);
              break;
          case 'last-month':
              const lastMonth = subMonths(now, 1);
              start = startOfMonth(lastMonth);
              end = endOfMonth(lastMonth);
              break;
          case 'year':
              start = startOfYear(now);
              end = endOfYear(now);
              break;
      }
      
      if (start && end && isValid(start) && isValid(end)) {
          setStartDate(format(start, 'yyyy-MM-dd'));
          setEndDate(format(end, 'yyyy-MM-dd'));
      }
  };

  // Toggle Series Visibility
  const handleLegendClick = (e: any) => {
    const { dataKey } = e;
    if (dataKey) {
        setHiddenSeries(prev => 
            prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]
        );
    }
  };

  const renderLegendText = (value: string, entry: any) => {
    const { dataKey } = entry;
    const isHidden = hiddenSeries.includes(dataKey);
    return (
        <span style={{ 
            textDecoration: isHidden ? 'line-through' : 'none', 
            opacity: isHidden ? 0.5 : 1,
            cursor: 'pointer' 
        }}>
            {value}
        </span>
    );
  };

  // 2. Filter Data based on Date Range
  const filteredData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    // Validate dates
    if (!isValid(start) || !isValid(end)) return data;
    
    // Set end date to end of day to be inclusive
    const endInclusive = new Date(end);
    endInclusive.setHours(23, 59, 59, 999);

    return data.filter(d => d.date >= start && d.date <= endInclusive);
  }, [data, startDate, endDate]);

  // 3. Aggregate Data based on View Mode
  const chartData = useMemo(() => {
    if (viewMode === 'daily') return filteredData;

    const map = new Map<string, any>();

    filteredData.forEach(d => {
        let key = '';
        let dateObj = d.date;

        if (viewMode === 'weekly') {
            const start = startOfWeek(d.date, { weekStartsOn: 1 });
            key = format(start, 'yyyy-MM-dd');
            dateObj = start;
        } else if (viewMode === 'monthly') {
             const start = startOfMonth(d.date);
             key = format(start, 'yyyy-MM');
             dateObj = start;
        } else if (viewMode === 'quarterly') {
             const start = startOfQuarter(d.date);
             key = format(start, 'yyyy-QQQ'); 
             dateObj = start;
        } else if (viewMode === 'yearly') {
             const start = startOfYear(d.date);
             key = format(start, 'yyyy');
             dateObj = start;
        }

        if (!map.has(key)) {
            map.set(key, {
                date: dateObj,
                count: 0,
                totalAvailSum: 0,
                totalAvailCount: 0,
                intAvailSum: 0,
                intAvailCount: 0,
                auxSum: 0,
                cyclesSum: 0,
                cyclesChargedSum: 0,
                cyclesDischargedSum: 0,
                budgetCyclesSum: 0,
                budgetIntAvailSum: 0,
                hasBudgetCycles: false,
                hasBudgetIntAvail: false
            });
        }
        
        const entry = map.get(key);
        entry.count++;
        
        // Handle Null Availability correctly
        if (d.totalAvailability !== null) {
            entry.totalAvailSum += d.totalAvailability;
            entry.totalAvailCount++;
        }
        if (d.internalAvailability !== null) {
            entry.intAvailSum += d.internalAvailability;
            entry.intAvailCount++;
        }

        entry.auxSum += d.auxPower;
        entry.cyclesSum += (d.cycles || 0);
        entry.cyclesChargedSum += (d.cyclesCharged || 0);
        entry.cyclesDischargedSum += (d.cyclesDischarged || 0);

        if (d.budgetCycles !== undefined) {
             entry.budgetCyclesSum += d.budgetCycles;
             entry.hasBudgetCycles = true;
        }
        if (d.budgetInternalAvailability !== undefined) {
             entry.budgetIntAvailSum += d.budgetInternalAvailability;
             entry.hasBudgetIntAvail = true;
        }
    });

    return Array.from(map.values()).map(e => ({
        date: e.date,
        // Average the values for the period, return null if no valid data points
        totalAvailability: e.totalAvailCount > 0 ? e.totalAvailSum / e.totalAvailCount : null,
        internalAvailability: e.intAvailCount > 0 ? e.intAvailSum / e.intAvailCount : null,
        
        auxPower: e.auxSum / e.count,
        // Sum cycles for the period
        cycles: e.cyclesSum,
        cyclesCharged: e.cyclesChargedSum,
        cyclesDischarged: e.cyclesDischargedSum,
        // Sum budget cycles for consistency
        budgetCycles: e.hasBudgetCycles ? e.budgetCyclesSum : null,
        // Average budget availability
        budgetInternalAvailability: e.hasBudgetIntAvail ? (e.budgetIntAvailSum / e.count) : null,
        
        // Placeholders
        nameplateCapacity: 0, 
        remarks: '',
        outageType: 'None' 
    })).sort((a,b) => a.date.getTime() - b.date.getTime());
  }, [filteredData, viewMode]);

  // 4. Calculate Metrics based on Filtered Data (Selected Range)
  const metrics = useMemo(() => {
    if (filteredData.length === 0) return null;
    
    // Valid data points for availability
    const validTotalAvail = filteredData.filter(d => d.totalAvailability !== null);
    const validIntAvail = filteredData.filter(d => d.internalAvailability !== null);

    const totalAvailSum = validTotalAvail.reduce((acc, curr) => acc + (curr.totalAvailability || 0), 0);
    const internalAvailSum = validIntAvail.reduce((acc, curr) => acc + (curr.internalAvailability || 0), 0);
    
    const budgetInternalAvailSum = filteredData.reduce((acc, curr) => acc + (curr.budgetInternalAvailability || 0), 0);
    const hasBudgetInt = filteredData.some(d => d.budgetInternalAvailability !== undefined);

    const outages = filteredData.filter(d => d.totalAvailability !== null && d.totalAvailability < 100);
    const auxSum = filteredData.reduce((acc, curr) => acc + curr.auxPower, 0);
    
    // Total Cycles (Sum in filtered range)
    const totalCycles = filteredData.reduce((acc, curr) => acc + (curr.cycles || 0), 0);
    const budgetCyclesSum = filteredData.reduce((acc, curr) => acc + (curr.budgetCycles || 0), 0);
    const hasBudgetCycles = filteredData.some(d => d.budgetCycles !== undefined);

    // YTD Calculation
    const currentEndDate = parseISO(endDate);
    const ytdStart = startOfYear(isValid(currentEndDate) ? currentEndDate : new Date());
    const ytdData = data.filter(d => d.date >= ytdStart && d.date <= currentEndDate);
    const ytdCycles = ytdData.reduce((acc, curr) => acc + (curr.cycles || 0), 0);
    const ytdBudgetCycles = ytdData.reduce((acc, curr) => acc + (curr.budgetCycles || 0), 0);
    const hasYtdBudget = ytdData.some(d => d.budgetCycles !== undefined);

    // MTD Calculation (Month To Date based on End Date selection)
    const mtdStart = startOfMonth(isValid(currentEndDate) ? currentEndDate : new Date());
    const mtdData = data.filter(d => d.date >= mtdStart && d.date <= currentEndDate);
    const mtdCycles = mtdData.reduce((acc, curr) => acc + (curr.cycles || 0), 0);
    const mtdBudgetCycles = mtdData.reduce((acc, curr) => acc + (curr.budgetCycles || 0), 0);
    const hasMtdBudget = mtdData.some(d => d.budgetCycles !== undefined);

    // LTSA Metrics
    const reverseData = [...data].sort((a,b) => b.date.getTime() - a.date.getTime());
    
    const latestRteRow = reverseData.find(d => d.rteMeasured !== undefined && d.rteMeasured !== null);
    const latestCapRow = reverseData.find(d => d.dischargeCapacityMeasured !== undefined && d.dischargeCapacityMeasured !== null);

    return {
        avgTotal: validTotalAvail.length > 0 ? totalAvailSum / validTotalAvail.length : 0,
        avgInternal: validIntAvail.length > 0 ? internalAvailSum / validIntAvail.length : 0,
        avgBudgetInternal: hasBudgetInt ? budgetInternalAvailSum / filteredData.length : undefined,
        
        countInternal: outages.filter(d => d.outageType === 'Internal').length,
        countExternal: outages.filter(d => d.outageType === 'External').length,
        
        latestCapacity: filteredData[filteredData.length - 1].nameplateCapacity,
        avgAux: auxSum / filteredData.length,
        
        totalCycles,
        budgetCycles: hasBudgetCycles ? budgetCyclesSum : undefined,
        
        ytdCycles,
        ytdBudgetCycles: hasYtdBudget ? ytdBudgetCycles : undefined,

        mtdCycles,
        mtdBudgetCycles: hasMtdBudget ? mtdBudgetCycles : undefined,

        // LTSA
        ltsaRte: latestRteRow,
        ltsaCap: latestCapRow
    };
  }, [filteredData, data, endDate]);

  if (!metrics) return (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">No Data Within Selected Range</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Adjust your date filters to see data.</p>
            <button 
                onClick={() => {
                    setStartDate(format(minDate, 'yyyy-MM-dd'));
                    setEndDate(format(maxDate, 'yyyy-MM-dd'));
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
                Reset Filters
            </button>
        </div>
    </div>
  );

  const formatXAxis = (date: Date) => {
      if (viewMode === 'yearly') return format(date, 'yyyy');
      if (viewMode === 'quarterly') return format(date, 'QQQ yy');
      if (viewMode === 'monthly') return format(date, 'MMM yy');
      if (viewMode === 'weekly') return format(date, 'dd MMM');
      return format(date, 'MMM dd');
  };

  const formatTooltipDate = (date: Date) => {
    if (viewMode === 'yearly') return format(date, 'yyyy');
    if (viewMode === 'quarterly') return format(date, 'QQQ yyyy');
    if (viewMode === 'monthly') return format(date, 'MMMM yyyy');
    if (viewMode === 'weekly') return `Week of ${format(date, 'dd MMM yyyy')}`;
    return format(date, 'dd MMM yyyy');
  };

  // Common Tooltip
  const CustomTooltip = ({ active, payload, label, unit = '' }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg text-sm z-50">
          <p className="font-bold mb-2 text-gray-900 dark:text-gray-100">{formatTooltipDate(new Date(label))}</p>
          {payload.map((p: any, idx: number) => {
             // Customize labels
             let name = p.name;
             let value = p.value;
             let displayUnit = unit;
             
             if (name === 'Actual Cycles') displayUnit = '';

             // Force Gray color for budget text in tooltip for consistency
             let color = p.color;
             if (name.includes('Budget') || name.includes('Guaranteed')) {
                 color = '#6b7280';
             }

             return (
                <div key={idx} style={{ color: color }} className="flex items-center gap-2 mb-1">
                    <span className="capitalize">{name}:</span>
                    <span className="font-mono font-bold">
                        {value !== null && value !== undefined ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'} {displayUnit}
                    </span>
                </div>
             );
          })}
        </div>
      );
    }
    return null;
  };

  const renderKPI = (
    title: string, 
    value: string, 
    label: string, 
    icon: React.ReactNode, 
    budget?: number, 
    actual?: number,
    isPercentage: boolean = false,
    lowerIsBetter: boolean = false
  ) => {
      let circleColor = ""; 
      
      if (budget !== undefined && actual !== undefined && budget > 0) {
          let diff = 0;
          if (isPercentage) {
              diff = actual - budget;
          } else {
              diff = ((actual - budget) / budget) * 100;
          }

          if (lowerIsBetter) {
              // CYCLES: Lower is Better
              if (diff <= 0) {
                  circleColor = "bg-green-500";
              } else if (diff <= 5) { // 5% buffer 
                  circleColor = "bg-yellow-500";
              } else {
                  circleColor = "bg-red-500";
              }
          } else {
              // AVAILABILITY: Higher is Better
              if (diff >= 0) {
                  circleColor = "bg-green-500";
              } else if (diff >= -5) {
                  circleColor = "bg-yellow-500";
              } else {
                  circleColor = "bg-red-500";
              }
          }
      }

      return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                    <div className="opacity-20">{icon}</div>
                </div>
                
                <div className="flex items-center">
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h4>
                    {circleColor && (
                        <div className={`w-3 h-3 rounded-full ${circleColor} ml-3 shadow-sm shrink-0`} title="Status Indicator"></div>
                    )}
                </div>
            </div>

            <div className="flex items-center mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {label}
                 </p>
            </div>
        </div>
      );
  };

  // Helper for Chart Coloring
  const getAvailabilityColor = (actual: number | null, budget: number | null) => {
      if (actual === null || actual === undefined) return '#e5e7eb'; // gray-200
      if (budget === null || budget === undefined) return '#3b82f6'; // fallback
      
      // Higher is better
      if (actual >= budget) return '#22c55e'; // green-500
      
      const deviation = (budget - actual) / budget; 
      // Deviation 0-10% -> Amber
      if (deviation <= 0.10) return '#eab308'; // yellow-500
      
      return '#ef4444'; // red-500
  };

  const getCycleColor = (actual: number | null, budget: number | null) => {
      if (actual === null || actual === undefined) return '#e5e7eb';
      if (budget === null || budget === undefined) return '#8b5cf6'; // fallback
      
      // Lower is better
      if (actual <= budget) return '#22c55e'; // green-500
      
      const deviation = (actual - budget) / budget;
      if (deviation <= 0.10) return '#eab308'; // yellow-500
      
      return '#ef4444'; // red-500
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6">
        
        {/* Left: View Mode Toggle */}
        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto w-full xl:w-auto">
            {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as ViewMode[]).map((mode) => (
                <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={clsx(
                        "px-4 py-2 text-sm font-medium rounded-md capitalize transition-all whitespace-nowrap",
                        viewMode === mode 
                            ? "bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750"
                    )}
                >
                    {mode}
                </button>
            ))}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <button 
                onClick={() => alert("PPT Export Coming Soon!")}
                className="flex items-center px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm transition-colors"
            >
                <Presentation className="w-4 h-4 mr-2" />
                Export PPT
            </button>

            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                    "flex items-center px-4 py-2.5 text-sm font-medium border rounded-lg transition-colors shadow-sm",
                    showFilters 
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" 
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750"
                )}
            >
                <Filter className="w-4 h-4 mr-2" />
                Filters
            </button>

            <button 
                onClick={onReset}
                className="flex items-center px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-200 hover:text-red-600 transition-all shadow-sm"
            >
                <Upload className="w-4 h-4 mr-2" />
                Upload New File
            </button>
        </div>
      </div>

      {/* 2. Filter Panel (Expanded) */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg mb-8 animate-in slide-in-from-top-2 relative">
             <button 
                onClick={() => setShowFilters(false)} 
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
             >
                <X className="w-5 h-5" />
             </button>
             
             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Filter Data</h3>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="w-full">
                            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">From</span>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input 
                                    type="date" 
                                    value={startDate}
                                    min={format(minDate, 'yyyy-MM-dd')}
                                    max={endDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="pl-9 block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                                />
                            </div>
                        </div>
                        <div className="w-full">
                            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">To</span>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input 
                                    type="date" 
                                    value={endDate}
                                    min={startDate}
                                    max={format(maxDate, 'yyyy-MM-dd')}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="pl-9 block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Filters</label>
                    <div className="flex flex-wrap gap-2">
                        <button 
                            onClick={() => applyQuickFilter('week')}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                            This Week
                        </button>
                        <button 
                            onClick={() => applyQuickFilter('month')}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                            This Month
                        </button>
                        <button 
                            onClick={() => applyQuickFilter('last-month')}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                            Last Month
                        </button>
                        <button 
                            onClick={() => applyQuickFilter('year')}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                            This Year
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Sets the date range to the current calendar period.
                    </p>
                </div>
             </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {renderKPI(
              "Total Availability", 
              `${metrics.avgTotal.toFixed(1)}%`, 
              "Grid Dependent (No Budget)", 
              <Activity className="w-8 h-8 text-blue-500"/>
          )}
          
          {renderKPI(
              "Actual Availability", 
              `${metrics.avgInternal.toFixed(1)}%`, 
              metrics.avgBudgetInternal ? `Guaranteed: ${metrics.avgBudgetInternal.toFixed(1)}%` : "No Guaranteed", 
              <CheckCircle className="w-8 h-8 text-green-500"/>,
              metrics.avgBudgetInternal,
              metrics.avgInternal,
              true,
              false // Higher is Better
          )}
          
          {renderKPI(
              "MTD Cycles", 
              `${metrics.mtdCycles.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, 
              metrics.mtdBudgetCycles ? `Budget: ${metrics.mtdBudgetCycles.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "No Budget", 
              <RotateCw className="w-8 h-8 text-purple-500"/>,
              metrics.mtdBudgetCycles,
              metrics.mtdCycles,
              false,
              true // Lower is Better
          )}
          
          {renderKPI(
              "YTD Cycles", 
              `${metrics.ytdCycles.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, 
              metrics.ytdBudgetCycles ? `Budget: ${metrics.ytdBudgetCycles.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "No Budget", 
              <RotateCw className="w-8 h-8 text-indigo-500"/>,
              metrics.ytdBudgetCycles,
              metrics.ytdCycles,
              false,
              true // Lower is Better
          )}

          {renderKPI(
              "Recorded Outages", 
              `${metrics.countInternal + metrics.countExternal}`, 
              `${metrics.countInternal} Int / ${metrics.countExternal} Ext`, 
              <AlertTriangle className="w-8 h-8 text-orange-500"/>
          )}
      </div>

      {/* LTSA / Performance Tests Section */}
      {(metrics.ltsaRte || metrics.ltsaCap) && (
          <div className="mb-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="flex items-center gap-2 mb-3">
                 <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                 <h3 className="text-lg font-semibold text-gray-800 dark:text-white">LTSA Performance Tests (Latest)</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderKPI(
                    "Round Trip Efficiency (PCC)", 
                    metrics.ltsaRte?.rteMeasured ? `${(metrics.ltsaRte.rteMeasured * 100).toFixed(2)}%` : "N/A", 
                    metrics.ltsaRte?.rteGuaranteed 
                        ? `Guaranteed: ${(metrics.ltsaRte.rteGuaranteed * 100).toFixed(2)}%` 
                        : "No Guaranteed Value", 
                    <Zap className="w-8 h-8 text-yellow-500"/>,
                    metrics.ltsaRte?.rteGuaranteed ? metrics.ltsaRte.rteGuaranteed * 100 : undefined,
                    metrics.ltsaRte?.rteMeasured ? metrics.ltsaRte.rteMeasured * 100 : undefined,
                    true,
                    false
                )}
                {renderKPI(
                    "Discharge Energy Capacity (PCC)", 
                    metrics.ltsaCap?.dischargeCapacityMeasured ? `${(metrics.ltsaCap.dischargeCapacityMeasured / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} MWh` : "N/A", 
                    metrics.ltsaCap?.dischargeCapacityGuaranteed
                        ? `Guaranteed: ${(metrics.ltsaCap.dischargeCapacityGuaranteed / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} MWh` 
                        : "No Guaranteed Value", 
                    <Activity className="w-8 h-8 text-cyan-500"/>,
                    metrics.ltsaCap?.dischargeCapacityGuaranteed,
                    metrics.ltsaCap?.dischargeCapacityMeasured,
                    false,
                    false
                )}
             </div>
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
                 * Displaying latest recorded test values. 
                 RTE Date: {metrics.ltsaRte ? format(metrics.ltsaRte.date, 'yyyy-MM-dd') : 'N/A'}. 
                 Capacity Date: {metrics.ltsaCap ? format(metrics.ltsaCap.date, 'yyyy-MM-dd') : 'N/A'}.
             </p>
          </div>
      )}
      
      {/* Legend */}
      <div className="mb-8">
          <ColorLegend />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
           {/* Chart 1: Availability Trend */}
           <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-[400px]">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 capitalize">
                    {viewMode} Availability Trend
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                        <XAxis dataKey="date" tickFormatter={formatXAxis} stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                        <YAxis domain={[0, 105]} stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip unit="%" />} />
                        <Legend onClick={handleLegendClick} formatter={renderLegendText} />
                        <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" />
                        
                        <Bar hide={hiddenSeries.includes('internalAvailability')} dataKey="internalAvailability" name="Actual Availability" barSize={20} radius={[4, 4, 0, 0]} fill="#22c55e">
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getAvailabilityColor(entry.internalAvailability, entry.budgetInternalAvailability)} />
                            ))}
                        </Bar>

                        <Line hide={hiddenSeries.includes('totalAvailability')} type="monotone" dataKey="totalAvailability" name="Total Avail." stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls={false} />
                        <Line hide={hiddenSeries.includes('budgetInternalAvailability')} type="step" dataKey="budgetInternalAvailability" name="Guaranteed Availability" stroke="#6b7280" strokeWidth={3} strokeDasharray="5 5" dot={false} connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Chart 2: Cycles */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-[400px]">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Cycle Usage (Throughput)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                        <XAxis dataKey="date" tickFormatter={formatXAxis} stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                        <YAxis stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend onClick={handleLegendClick} formatter={renderLegendText} />
                        
                        <Bar hide={hiddenSeries.includes('cycles')} dataKey="cycles" name="Actual Cycles" radius={[4, 4, 0, 0]} barSize={20} fill="#22c55e">
                             {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getCycleColor(entry.cycles, entry.budgetCycles)} />
                            ))}
                        </Bar>

                        <Line hide={hiddenSeries.includes('budgetCycles')} type="step" dataKey="budgetCycles" name="Budget Cycles" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Chart 3: Auxiliary Power */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-[400px]">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Auxiliary Power Consumption</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorAux" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                        <XAxis dataKey="date" tickFormatter={formatXAxis} stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                        <YAxis stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: chartColors.text }} />
                        <Tooltip content={<CustomTooltip unit="kW" />} />
                        <Legend onClick={handleLegendClick} formatter={renderLegendText} />
                        <Area hide={hiddenSeries.includes('auxPower')} type="monotone" dataKey="auxPower" name="Aux Power (kW)" stroke="#ec4899" fillOpacity={1} fill="url(#colorAux)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
      </div>

      {/* Outage Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Downtime & Events Log (Filtered Range)</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 font-medium sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3 text-right">Total Avail.</th>
                  <th className="px-6 py-3 text-right">Actual Availability</th>
                  <th className="px-6 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredData.filter(d => (d.totalAvailability !== null && d.totalAvailability < 100) || d.remarks).length === 0 && (
                    <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No events recorded in this period.</td>
                    </tr>
                )}
                {filteredData.filter(d => (d.totalAvailability !== null && d.totalAvailability < 100) || d.remarks).sort((a,b) => a.date.getTime() - b.date.getTime()).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-gray-900 dark:text-gray-200 font-medium">
                        {format(row.date, 'yyyy-MM-dd')}
                    </td>
                    <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                            ${row.outageType === 'Internal' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 
                              row.outageType === 'External' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : 
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {row.outageType}
                        </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                        <span className={row.totalAvailability !== null && row.totalAvailability < 100 ? 'text-red-600 font-bold' : ''}>
                             {row.totalAvailability !== null ? row.totalAvailability.toFixed(1) + '%' : '-'}
                        </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                        {row.internalAvailability !== null ? row.internalAvailability.toFixed(1) + '%' : '-'}
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400 max-w-lg">
                        {row.remarks || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};

export default BessDashboard;
