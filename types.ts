
export interface RawRow {
  [key: string]: any;
}

// --- SOLAR SPECIFIC TYPES ---

export interface DailyData {
  date: Date;
  siteName: string;
  ghiBudget: number;
  ghiActual: number | null;
  kwhBudget: number;
  kwhActual: number | null;
  kwhForecast: number;
  ghiForecast: number;
  prBudget: number;
  prActual: number | null;
  systemCapacity: number | null;
  isForecast: boolean;
  notes?: string;
  estimatedLoss?: number;
}

export interface AggregatedData {
  periodKey: string;
  periodLabel: string;
  kwhBudget: number;
  kwhActual: number;
  kwhForecast: number;
  totalProjected: number;
  variancePct: number;
  cumulativeKwhBudget: number;
  cumulativeKwhProjected: number;
  cumulativeKwhActual: number | null;
  cumulativeKwhForecast: number | null;
  ghiBudget: number;
  ghiActual: number;
  ghiForecast: number;
  prBudget: number;
  prActual: number | null;
  prForecast: number | null;
}

export interface LossFactors {
  periodLabel: string;
  kwhBudget: number;
  kwhActual: number;
  varianceTotal: number;
  varianceIrradiance: number;
  variancePr: number;
}

export interface SimulationResult {
  dailyData: DailyData[];
  monthlyData: AggregatedData[];
  metrics: {
    lastDataDate: Date;
    trendPr: number;
    trendPrVariance: number;
    impliedCapacity: number;
    totalBudget: number;
    totalProjected: number;
    varianceYearEnd: number;
  };
  lossAnalysisYTD: LossFactors;
  lossAnalysisMTD: LossFactors;
}

// --- BESS SPECIFIC TYPES ---

export interface BessDailyData {
  date: Date;
  nameplateCapacity: number; // Energy Capacity (kWh)
  auxPower: number; // kW
  totalAvailability: number | null; // % (0-100) or null if no data
  internalAvailability: number | null; // % (0-100) or null if no data
  budgetInternalAvailability?: number; // New (Target)
  remarks: string;
  outageType: 'Internal' | 'External' | 'None';
  
  // Vital Signs
  soc?: number; // % State of Charge
  activePower?: number; // MW
  reactivePower?: number; // MVar
  
  // Health & Asset Mgmt
  energyCharged?: number; // kWh (New)
  energyDischarged?: number; // kWh (New)
  cycles?: number; // Average Cycle Count ((Charge + Discharge)/2)
  cyclesCharged?: number; // Calculated Charge Cycles
  cyclesDischarged?: number; // Calculated Discharge Cycles
  budgetCycles?: number; // New (Target)
  throughput?: number; // kWh
  soh?: number; // % State of Health
  rte?: number; // % Round Trip Efficiency
  internalResistance?: number; // mOhm

  // Safety & Thermal
  cellTempMax?: number; // Celsius
  cellTempMin?: number; // Celsius
  cellTempAvg?: number; // Celsius
  voltageSpread?: number; // mV
  insulationResistance?: number; // MOhm

  // LTSA Test Results (Sporadic)
  rteMeasured?: number; // % at Point of Common Coupling
  rteGuaranteed?: number; // % based on LTSA
  dischargeCapacityMeasured?: number; // kWh Useable at Point of Common Coupling
  dischargeCapacityGuaranteed?: number; // kWh Guaranteed Useable based on LTSA
}

export interface BessMetrics {
  avgTotalAvailability: number;
  avgInternalAvailability: number;
  totalOutages: number;
  internalOutages: number;
  externalOutages: number;
  avgAuxPower: number;
  dataPoints: number;
  
  // Advanced
  totalCycles?: number;
  avgSoC?: number;
  avgSoh?: number;
  avgRte?: number;
  maxTemp?: number;
}