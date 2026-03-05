
import { BessDailyData, RawRow } from '../types';
import { isValid, compareAsc, parse } from 'date-fns';

const normalizeKey = (key: string): string => {
  const k = key.toLowerCase().trim();
  
  // 1. Time/Date
  if (k === 'time (seconds)' || k === 'time' || k.includes('time (seconds)') || k === 'date' || k === 'timestamp') return 'date';
  
  // 2. Nameplate Capacity
  if (k.includes('nameplate') && k.includes('capacity')) return 'nameplateCapacity';

  // --- LTSA / Test Results (Specific Matches First) ---

  // Guaranteed RTE
  if (k.includes('guaranteed') && k.includes('round trip efficiency')) return 'rteGuaranteed';
  // Measured RTE (Point of Common Coupling)
  if (k.includes('round trip efficiency') && (k.includes('coupling') || k.includes('measured') || k.includes('pcc'))) return 'rteMeasured';

  // Guaranteed Capacity
  if (k.includes('guaranteed') && k.includes('discharge') && k.includes('capacity')) return 'dischargeCapacityGuaranteed';
  // Measured Capacity (Useable / Point of Common Coupling)
  if (k.includes('useable') && k.includes('discharge') && k.includes('capacity')) return 'dischargeCapacityMeasured';


  // --- Daily Operations ---

  // 12. Energy Charged (kWh)
  if ((k.includes('energy') && k.includes('charged')) || (k.includes('charge') && k.includes('energy'))) {
      if (!k.includes('discharged') && !k.includes('capacity')) return 'energyCharged';
  }

  // 13. Energy Discharged (kWh)
  if ((k.includes('energy') && k.includes('discharged')) || (k.includes('discharge') && k.includes('energy'))) {
      if (!k.includes('capacity')) return 'energyDischarged';
  }

  // 14. Budget Cycles (New)
  if (k.includes('budget') && k.includes('cycle')) return 'budgetCycles';
  if (k.includes('target') && k.includes('cycle')) return 'budgetCycles';

  // 15. Budget Internal Availability (New)
  if (k.includes('budget') && k.includes('internal') && k.includes('availability')) return 'budgetInternalAvailability';
  if (k.includes('target') && k.includes('internal') && k.includes('availability')) return 'budgetInternalAvailability';
  
  // 6. Auxiliary Power
  if (k.includes('auxiliary') || k.includes('aux power')) return 'auxPower';
  
  // 7. Total Availability
  if (k === 'total availability' || k === 'availability' || k === 'system availability' || (k.includes('availability') && !k.includes('internal') && !k.includes('budget'))) return 'totalAvailability';
  
  // 8. Internal Availability
  if (k.includes('internal') && k.includes('availability') && !k.includes('budget') && !k.includes('target')) return 'internalAvailability';
  
  // 9. Remarks
  if (k.includes('remark') || k.includes('comment') || k.includes('note')) return 'remarks';
  
  // 10. Outage Type
  if (k.includes('type of outages') || k.includes('outage type') || k.includes('outage category')) return 'outageType';

  return key;
};

const parsePercent = (val: any): number | null => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        if (val.trim() === '') return null;
        const clean = val.replace(/%/g, '').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? null : num;
    }
    return null;
};

const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const clean = val.replace(/,/g, '').replace(/[^0-9.-]/g, ''); // Remove non-numeric chars except dot and minus
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

const parseNullableNumber = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = parseNumber(val);
    return num === 0 && val !== 0 && val !== '0' ? undefined : num;
};

export const parseBessData = (rows: RawRow[]): BessDailyData[] => {
    // Pass 1: Parse rows
    const parsed = rows.map((row): BessDailyData | null => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
            const normalized = normalizeKey(key);
            newRow[normalized] = row[key];
        });

        let dateObj: Date | null = null;
        
        // Robust Date Parsing
        if (typeof newRow.date === 'number') {
            dateObj = new Date(Math.round((newRow.date - 25569) * 86400 * 1000));
        } else if (typeof newRow.date === 'string') {
            const formats = [
                'yyyy-MM-dd', 
                'M/d/yy',     
                'MM/dd/yy',
                'M/d/yyyy',   
                'MM/dd/yyyy',
            ];

            for (const fmt of formats) {
                try {
                    const p = parse(newRow.date, fmt, new Date());
                    if (isValid(p)) {
                        if (p.getFullYear() > 2000) {
                            dateObj = p;
                            break;
                        }
                    }
                } catch (e) {}
            }
            if (!dateObj) {
                const d = new Date(newRow.date);
                if (isValid(d)) dateObj = d;
            }
        }

        if (!dateObj || !isValid(dateObj)) {
            return null;
        }

        const totalAvail = parsePercent(newRow.totalAvailability);
        const internalAvail = parsePercent(newRow.internalAvailability);
        const budgetIntAvail = newRow.budgetInternalAvailability !== undefined ? parsePercent(newRow.budgetInternalAvailability) : undefined;

        const nameplateCap = parseNumber(newRow.nameplateCapacity);
        const eCharged = parseNumber(newRow.energyCharged);
        const eDischarged = parseNumber(newRow.energyDischarged);
        
        const budgetCycles = newRow.budgetCycles !== undefined ? parseNumber(newRow.budgetCycles) : undefined;

        // LTSA Parsing
        const rteMeasured = parsePercent(newRow.rteMeasured) ?? undefined;
        const rteGuaranteed = parsePercent(newRow.rteGuaranteed) ?? undefined;
        const dischargeCapacityMeasured = parseNullableNumber(newRow.dischargeCapacityMeasured);
        const dischargeCapacityGuaranteed = parseNullableNumber(newRow.dischargeCapacityGuaranteed);

        // Normalize outage type
        let outageType: any = 'None';
        if (newRow.outageType) {
            const t = String(newRow.outageType).toLowerCase();
            if (t.includes('internal')) outageType = 'Internal';
            else if (t.includes('external')) outageType = 'External';
        } else if (newRow.remarks) {
             const rem = String(newRow.remarks).toLowerCase();
             if (rem.includes('grid') || rem.includes('external') || rem.includes('trip')) outageType = 'External';
             else if (rem.includes('communication') || rem.includes('bess') || rem.includes('internal') || rem.includes('fault')) outageType = 'Internal';
        }

        // Cycle Calculation
        let cycles = 0; // Average
        let cyclesCharged = 0;
        let cyclesDischarged = 0;

        const capacityBase = nameplateCap;
        
        if (capacityBase > 0) {
            if (eDischarged > 0) cyclesDischarged = eDischarged / capacityBase;
            if (eCharged > 0) cyclesCharged = eCharged / capacityBase;
            
            // Average of Charge and Discharge
            if (cyclesCharged > 0 || cyclesDischarged > 0) {
                cycles = (cyclesCharged + cyclesDischarged) / 2;
            }
        } else if (eDischarged === 0 && eCharged === 0 && (totalAvail === null || totalAvail > 0)) {
            // Implicit idle
            cycles = 0;
        }

        return {
            date: dateObj,
            nameplateCapacity: nameplateCap,
            auxPower: parseNumber(newRow.auxPower),
            totalAvailability: totalAvail,
            internalAvailability: internalAvail,
            budgetInternalAvailability: budgetIntAvail ?? undefined, // Ensure undefined if null
            remarks: newRow.remarks ? String(newRow.remarks) : '',
            outageType: outageType,
            energyCharged: eCharged,
            energyDischarged: eDischarged,
            cycles: cycles, 
            cyclesCharged: cyclesCharged,
            cyclesDischarged: cyclesDischarged,
            budgetCycles: budgetCycles,
            
            // LTSA
            rteMeasured,
            rteGuaranteed,
            dischargeCapacityMeasured,
            dischargeCapacityGuaranteed
        };
    }).filter((d): d is BessDailyData => d !== null).sort((a, b) => compareAsc(a.date, b.date));

    if (parsed.length === 0) return [];

    // Helper to normalize 0-1 vs 0-100 scales for Availability
    const normalizeScale = (data: (number | null)[]) => {
        const nonZero = data.filter((v): v is number => v !== null && v > 0);
        if (nonZero.length === 0) return 1; // Default
        
        const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
        // If avg is small (<= 1.05), assume 0-1 scale and multiply by 100
        return avg <= 1.05 ? 100 : 1;
    };

    const totalAvailScale = normalizeScale(parsed.map(d => d.totalAvailability));
    const internalAvailScale = normalizeScale(parsed.map(d => d.internalAvailability));

    return parsed.map(d => {
        let budgetAvail = d.budgetInternalAvailability;
        
        // Try to detect if budget needs scaling based on actuals
        if (budgetAvail !== undefined && budgetAvail !== null && internalAvailScale === 100 && budgetAvail <= 1.05 && budgetAvail > 0) {
            budgetAvail = budgetAvail * 100;
        }

        return {
            ...d,
            totalAvailability: d.totalAvailability !== null ? d.totalAvailability * totalAvailScale : null,
            internalAvailability: d.internalAvailability !== null ? d.internalAvailability * internalAvailScale : null,
            budgetInternalAvailability: budgetAvail
        };
    });
};