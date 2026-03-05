import { DailyData, AggregatedData, RawRow, SimulationResult, LossFactors } from '../types';
import { isValid, compareAsc, format, isSameMonth, isAfter, subDays, startOfMonth, startOfYear } from 'date-fns';

/**
 * Normalizes keys from Excel to standard internal keys
 */
const normalizeKey = (key: string): string => {
  const k = key.toLowerCase().trim();
  
  // Specific exclusions to prevent false positives
  // e.g. "Site Capacity" should be capacity, not site name.
  
  // 1. Capacity (High Priority)
  if (k.includes('capacity') || (k.includes('system') && k.includes('size')) || k.includes('dc power') || k.includes('installed power')) {
      return 'systemCapacity';
  }

  // 2. Date
  if (k === 'date' || k === 'datetime' || k === 'timestamp' || k.includes('date')) return 'date';

  // 3. Site Name (must not contain capacity)
  if (k.includes('site') || k.includes('plant') || k.includes('project')) return 'siteName';

  // 4. Specific Yield (ignore for now, but preserve)
  if (k.includes('sy') || k.includes('specific yield') || k.includes('/kwp')) {
     return key; 
  }

  // 5. GHI / Irradiation
  if (k.includes('ghi') || k.includes('irradiation') || k.includes('irradiance') || k.includes('poa')) {
      if (k.includes('budget') || k.includes('target') || k.includes('expected')) return 'ghiBudget';
      if (k.includes('actual') || k.includes('measured')) return 'ghiActual';
      // Fallback if just "GHI" usually implies actuals in some reports, but let's be safe
      if (!k.includes('budget') && !k.includes('forecast')) return 'ghiActual';
  }
  
  // 6. Energy / kWh (Handle Estimated Loss distinct from Actual/Budget)
  if (k.includes('kwh') || k.includes('energy') || k.includes('yield') || k.includes('production') || k.includes('loss')) {
      if (k.includes('estimated') || k.includes('loss') || k.includes('outage') || k.includes('curtailment')) return 'estimatedLoss';
      if (k.includes('budget') || k.includes('target') || k.includes('expected')) return 'kwhBudget';
      if (k.includes('actual') || k.includes('measured') || k.includes('inverter')) return 'kwhActual';
  }

  // 7. PR
  if (k.includes('pr') || k.includes('performance ratio') || k.includes('efficiency')) {
      if (k.includes('budget') || k.includes('target') || k.includes('expected')) return 'prBudget';
      if (k.includes('actual') || k.includes('measured')) return 'prActual';
  }

  // 8. Notes
  if (k.includes('note') || k.includes('issue') || k.includes('comment') || k.includes('remark') || k.includes('reason')) {
      return 'notes';
  }
  
  return key;
};

/**
 * Parses raw excel rows into typed DailyData
 */
export const parseRawData = (rows: RawRow[]): DailyData[] => {
  // Helper to safely parse floats
  const parseVal = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
          // Remove commas and currency symbols if any, keep decimal points
          const cleaned = val.replace(/,/g, '').replace(/[^\d.-]/g, '');
          const float = parseFloat(cleaned);
          return isNaN(float) ? 0 : float;
      }
      return 0;
  };

  // Pass 1: Parse rows
  const parsed = rows.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => {
      newRow[normalizeKey(key)] = row[key];
    });

    // Handle Excel dates (which can be numbers) or strings
    let dateObj: Date = new Date();
    if (typeof newRow.date === 'number') {
      // Excel date serial number conversion (approximate epoch)
      dateObj = new Date(Math.round((newRow.date - 25569) * 86400 * 1000));
    } else if (typeof newRow.date === 'string') {
      dateObj = new Date(newRow.date);
      // Try parsing if Date constructor fails
      if (!isValid(dateObj)) dateObj = new Date(Date.parse(newRow.date));
    } else if (newRow.date instanceof Date) {
      dateObj = newRow.date;
    }

    // Normalize PR to 0-1 scale if it looks like percentage (e.g. 75 -> 0.75)
    let prB = parseFloat(newRow.prBudget) || 0;
    if (prB > 1.5) prB = prB / 100;

    let prA = newRow.prActual !== undefined && newRow.prActual !== null ? parseFloat(newRow.prActual) : null;
    if (prA !== null && prA > 1.5) prA = prA / 100;

    // Normalize Site Name (Trim whitespace, default to Unknown)
    let siteName = newRow.siteName ? String(newRow.siteName).trim() : 'Unknown Site';
    if (siteName === '') siteName = 'Unknown Site';

    return {
      date: dateObj,
      siteName: siteName,
      ghiBudget: parseVal(newRow.ghiBudget),
      ghiActual: newRow.ghiActual !== undefined && newRow.ghiActual !== null ? parseVal(newRow.ghiActual) : null,
      kwhBudget: parseVal(newRow.kwhBudget),
      prBudget: prB,
      kwhActual: newRow.kwhActual !== undefined && newRow.kwhActual !== null ? parseVal(newRow.kwhActual) : null,
      prActual: prA,
      systemCapacity: newRow.systemCapacity !== undefined ? parseVal(newRow.systemCapacity) : null,
      kwhForecast: 0,
      ghiForecast: 0,
      isForecast: false,
      notes: newRow.notes ? String(newRow.notes) : undefined,
      estimatedLoss: newRow.estimatedLoss !== undefined ? parseVal(newRow.estimatedLoss) : undefined
    };
  }).filter(d => isValid(d.date)).sort((a, b) => compareAsc(a.date, b.date));

  // Pass 2: Backfill/Normalize System Capacity per Site
  // If a site has capacity defined in ANY row, apply it to ALL rows for that site.
  // Note: For granular data (inverters), this logic finds the first valid capacity.
  // We rely on runProjection to sum/max them correctly.
  const siteCapacities = new Map<string, number>();
  
  // First pass to find capacities
  parsed.forEach(d => {
      if (d.systemCapacity && d.systemCapacity > 0) {
          if (!siteCapacities.has(d.siteName)) {
              siteCapacities.set(d.siteName, d.systemCapacity);
          }
      }
  });

  return parsed.map(d => {
      let cap = d.systemCapacity;
      // Backfill if missing or zero
      if ((!cap || cap === 0) && siteCapacities.has(d.siteName)) {
          cap = siteCapacities.get(d.siteName)!;
      }
      
      return { ...d, systemCapacity: cap };
  });
};

/**
 * Calculates the best-guess capacity for each site in the provided data,
 * handling multi-inverter (sum) vs hourly (max) logic.
 */
export const getSiteCapacityMap = (data: DailyData[]): Map<string, number> => {
  const uniqueSites = Array.from(new Set(data.map(d => d.siteName)));
  const siteCapacityMap = new Map<string, number>();
  
  uniqueSites.forEach(site => {
      const siteRows = data.filter(d => d.siteName === site);
      
      const dailySumCaps = new Map<string, number>();
      const dailyMaxRowCaps = new Map<string, number>();
      const dailyEnergies = new Map<string, number>();
      
      let maxDailyEnergy = 0;
      let dayWithMaxEnergy = '';

      siteRows.forEach(row => {
          const dayKey = row.date.toISOString().split('T')[0];
          
          // Track sum of capacities (for Inverter logic)
          const currentSum = dailySumCaps.get(dayKey) || 0;
          dailySumCaps.set(dayKey, currentSum + (row.systemCapacity || 0));

          // Track max row capacity (for Hourly logic)
          const currentMax = dailyMaxRowCaps.get(dayKey) || 0;
          if ((row.systemCapacity || 0) > currentMax) {
             dailyMaxRowCaps.set(dayKey, row.systemCapacity || 0);
          }
          
          // Track energy to check yield
          const energy = row.kwhActual || row.kwhBudget || 0; 
          const currentEnergy = dailyEnergies.get(dayKey) || 0;
          const newEnergy = currentEnergy + energy;
          dailyEnergies.set(dayKey, newEnergy);

          if (newEnergy > maxDailyEnergy) {
              maxDailyEnergy = newEnergy;
              dayWithMaxEnergy = dayKey;
          }
      });

      // HEURISTIC: Check Specific Yield on the highest energy day
      let useSumStrategy = true;
      if (dayWithMaxEnergy) {
          const capSum = dailySumCaps.get(dayWithMaxEnergy) || 0;
          const yieldIfSum = capSum > 0 ? maxDailyEnergy / capSum : 0;
          
          if (yieldIfSum < 1.5 && maxDailyEnergy > 10) {
              useSumStrategy = false;
          }
      }

      let siteCap = 0;
      if (useSumStrategy) {
          dailySumCaps.forEach(v => { if (v > siteCap) siteCap = v; });
      } else {
          dailyMaxRowCaps.forEach(v => { if (v > siteCap) siteCap = v; });
      }

      siteCapacityMap.set(site, siteCap);
  });
  return siteCapacityMap;
}

/**
 * Runs the "Smart Projection" logic
 */
export const runProjection = (
    data: DailyData[], 
    overrideCapacityMap?: Map<string, number>,
    prLookbackDays: number = 30
): SimulationResult => {
  if (data.length === 0) throw new Error("No valid data rows found.");

  // 1. Identify Split Date (Last date with valid kwhActual)
  const actuals = data.filter(d => d.kwhActual !== null && d.kwhActual !== undefined && !isNaN(d.kwhActual));
  const lastActualDate = actuals.length > 0 ? actuals[actuals.length - 1].date : data[0].date;

  // 2. Determine System Capacity (Per Site)
  // Use override map if provided (from full history), otherwise calculate from partial data
  const siteCapacityMap = overrideCapacityMap || getSiteCapacityMap(data);

  // Calculate total capacity for the metrics (only for sites present in data)
  const uniqueSites = Array.from(new Set(data.map(d => d.siteName)));
  let totalCapacityKW = 0;
  uniqueSites.forEach(s => totalCapacityKW += siteCapacityMap.get(s) || 0);
  const finalSystemCapacityMW = totalCapacityKW / 1000;

  // 3. Calculate Latest Trend PR (Last X days ending on Split Date)
  const lookbackStart = subDays(lastActualDate, prLookbackDays);
  const recentData = data.filter(d => 
    d.date > lookbackStart && 
    d.date <= lastActualDate && 
    d.prActual !== null && 
    d.prActual > 0
  );

  const sumPr = recentData.reduce((sum, d) => sum + (d.prActual || 0), 0);
  const sumPrBudget = recentData.reduce((sum, d) => sum + (d.prBudget || 0), 0);
  
  const trendPr = recentData.length > 0 ? sumPr / recentData.length : (data[0].prBudget || 0.8);
  const trendPrBudget = recentData.length > 0 ? sumPrBudget / recentData.length : (data[0].prBudget || 0.8);
  
  // Calculate Variance (Actual Trend - Budget Trend for same period)
  const trendPrVariance = trendPr - trendPrBudget;

  // 4. Generate Forecast Series & YTD Loss Analysis
  const mtdStartDate = startOfMonth(lastActualDate);
  const ytdStartDate = startOfYear(lastActualDate);

  let ytdKwhBudget = 0;
  let ytdKwhActual = 0;
  let ytdVarianceIrradiance = 0;
  let ytdVariancePr = 0;

  // MTD Trackers
  let mtdKwhBudget = 0;
  let mtdKwhActual = 0;
  let mtdVarianceIrradiance = 0;
  let mtdVariancePr = 0;

  const processedData = data.map(d => {
    const isPast = d.date <= lastActualDate;
    let kwhForecast = 0;
    let ghiForecast = 0;
    
    // Effective budget calculation
    let effectiveKwhBudget = d.kwhBudget;
    
    // Use the intelligent capacity map for calculations
    const effectiveCapacity = siteCapacityMap.get(d.siteName) || d.systemCapacity || 0;

    if (!isPast) {
      // Forecast Logic: GHI * TrendPR * effectiveCapacity
      kwhForecast = d.ghiBudget * trendPr * effectiveCapacity;
      
      // GHI Forecast logic: Use Budget GHI as forecast
      ghiForecast = d.ghiBudget;

      // Synthetic Budget for missing future budget data
      if ((!effectiveKwhBudget || effectiveKwhBudget === 0) && d.ghiBudget > 0) {
          const prForBudget = d.prBudget > 0 ? d.prBudget : trendPr;
          effectiveKwhBudget = d.ghiBudget * prForBudget * effectiveCapacity;
      }

    } else {
      // Loss Analysis for Past Data
      if (d.kwhActual !== null) {
        const actual = d.kwhActual;
        
        // Backfill past budget if missing
        if ((!effectiveKwhBudget || effectiveKwhBudget === 0) && d.ghiBudget > 0 && d.prBudget > 0) {
             effectiveKwhBudget = d.ghiBudget * d.prBudget * effectiveCapacity;
        }

        const budget = effectiveKwhBudget;
        
        // Calculate decomposition for this row
        let weatherCorrected = budget;
        if (d.ghiBudget > 0 && d.ghiActual !== null) {
          weatherCorrected = budget * (d.ghiActual / d.ghiBudget);
        }
        
        const irrVar = weatherCorrected - budget;
        const prVar = actual - weatherCorrected;

        // YTD Accumulation
        if (d.date >= ytdStartDate) {
            ytdKwhBudget += budget;
            ytdKwhActual += actual;
            ytdVarianceIrradiance += irrVar;
            ytdVariancePr += prVar;
        }

        // MTD Accumulation
        if (d.date >= mtdStartDate) {
            mtdKwhBudget += budget;
            mtdKwhActual += actual;
            mtdVarianceIrradiance += irrVar;
            mtdVariancePr += prVar;
        }
      }
    }

    return {
      ...d,
      kwhBudget: effectiveKwhBudget,
      kwhActual: isPast ? (d.kwhActual || 0) : null,
      kwhForecast: isPast ? 0 : kwhForecast,
      ghiActual: isPast ? (d.ghiActual || 0) : null,
      ghiForecast: isPast ? 0 : ghiForecast,
      isForecast: !isPast
    };
  });

  interface MonthlyCalc extends AggregatedData {
      theoreticalKwhBudget: number;
      theoreticalKwhActual: number;
      theoreticalKwhForecast: number;
  }

  // 5. Monthly Aggregation
  const monthlyMap = new Map<string, MonthlyCalc>();

  processedData.forEach(d => {
    const monthKey = format(d.date, 'yyyy-MM');
    const monthLabel = format(d.date, 'MMM yyyy');

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        periodKey: monthKey,
        periodLabel: monthLabel,
        kwhBudget: 0,
        kwhActual: 0,
        kwhForecast: 0,
        totalProjected: 0,
        variancePct: 0,
        cumulativeKwhBudget: 0,
        cumulativeKwhProjected: 0,
        cumulativeKwhActual: null,
        cumulativeKwhForecast: null,
        ghiBudget: 0,
        ghiActual: 0,
        ghiForecast: 0,
        prBudget: 0,
        prActual: null,
        prForecast: null,
        theoreticalKwhBudget: 0,
        theoreticalKwhActual: 0,
        theoreticalKwhForecast: 0
      });
    }

    const m = monthlyMap.get(monthKey)!;
    // Use the intelligent capacity
    const capacity = siteCapacityMap.get(d.siteName) || d.systemCapacity || 0;

    // Energy
    m.kwhBudget += d.kwhBudget;
    m.kwhActual += (d.kwhActual || 0);
    m.kwhForecast += d.kwhForecast || 0;
    
    // Irradiation
    m.ghiBudget += d.ghiBudget;
    m.ghiActual += (d.ghiActual || 0);
    m.ghiForecast += d.ghiForecast || 0;

    // Theoretical Energy (Irradiance * Capacity) for PR weighting
    m.theoreticalKwhBudget += (d.ghiBudget * capacity);
    
    // For Actual PR
    if (!d.isForecast && d.kwhActual !== null && d.ghiActual !== null) {
        m.theoreticalKwhActual += (d.ghiActual * capacity);
    }

    // For Forecast PR
    if (d.isForecast) {
        m.theoreticalKwhForecast += (d.ghiForecast * capacity); 
    }
  });

  const monthlyData = Array.from(monthlyMap.values()).map(m => {
    m.totalProjected = m.kwhActual + m.kwhForecast;
    m.variancePct = m.kwhBudget > 0 
      ? ((m.totalProjected - m.kwhBudget) / m.kwhBudget) * 100 
      : 0;
    
    // Calculate PRs (weighted average)
    m.prBudget = m.theoreticalKwhBudget > 0 ? m.kwhBudget / m.theoreticalKwhBudget : 0;
    m.prActual = m.theoreticalKwhActual > 0 ? m.kwhActual / m.theoreticalKwhActual : null;
    m.prForecast = m.theoreticalKwhForecast > 0 ? m.kwhForecast / m.theoreticalKwhForecast : null;

    const { theoreticalKwhBudget, theoreticalKwhActual, theoreticalKwhForecast, ...rest } = m;
    return rest as AggregatedData;
  }).sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  // 6. Calculate Cumulatives
  let runningBudget = 0;
  let runningProjected = 0;
  
  const tempWithRunning = monthlyData.map((m) => {
      runningBudget += m.kwhBudget;
      runningProjected += m.totalProjected;
      return {
          ...m,
          cumulativeKwhBudget: runningBudget,
          cumulativeKwhProjected: runningProjected,
          isFullyActual: m.kwhForecast === 0
      };
  });

  let lastActualIndex = -1;
  for (let i = 0; i < tempWithRunning.length; i++) {
      if (tempWithRunning[i].isFullyActual) {
          lastActualIndex = i;
      } else {
          break; 
      }
  }

  const monthlyDataWithCumulative = tempWithRunning.map((m, i) => {
      const isActualSegment = i <= lastActualIndex;
      const isForecastSegment = i >= lastActualIndex; 
      
      return {
          ...m,
          cumulativeKwhActual: isActualSegment ? m.cumulativeKwhProjected : null,
          cumulativeKwhForecast: isForecastSegment ? m.cumulativeKwhProjected : null
      };
  });

  // Global Metrics
  const totalBudget = monthlyData.reduce((sum, m) => sum + m.kwhBudget, 0);
  const totalProjected = monthlyData.reduce((sum, m) => sum + m.totalProjected, 0);
  const varianceYearEnd = totalBudget > 0 ? ((totalProjected - totalBudget) / totalBudget) * 100 : 0;

  const lossAnalysisYTD: LossFactors = {
    periodLabel: 'YTD',
    kwhBudget: ytdKwhBudget,
    kwhActual: ytdKwhActual,
    varianceTotal: ytdKwhActual - ytdKwhBudget,
    varianceIrradiance: ytdVarianceIrradiance,
    variancePr: ytdVariancePr
  };

  const lossAnalysisMTD: LossFactors = {
    periodLabel: format(mtdStartDate, 'MMM yyyy'),
    kwhBudget: mtdKwhBudget,
    kwhActual: mtdKwhActual,
    varianceTotal: mtdKwhActual - mtdKwhBudget,
    varianceIrradiance: mtdVarianceIrradiance,
    variancePr: mtdVariancePr
  };

  return {
    dailyData: processedData,
    monthlyData: monthlyDataWithCumulative,
    metrics: {
      lastDataDate: lastActualDate,
      trendPr,
      trendPrVariance,
      impliedCapacity: finalSystemCapacityMW, 
      totalBudget,
      totalProjected,
      varianceYearEnd
    },
    lossAnalysisYTD,
    lossAnalysisMTD
  };
};