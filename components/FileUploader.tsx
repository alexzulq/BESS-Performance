
import React, { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Loader2, Database } from 'lucide-react';
import { RawRow } from '../types';
import { addDays, format, subYears } from 'date-fns';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';

interface FileUploaderProps {
  onDataLoaded: (data: RawRow[]) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded }) => {
  const { t } = useThemeLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = useCallback((file: File) => {
    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<RawRow>(sheet);
        onDataLoaded(jsonData);
      } catch (err) {
        setError('Failed to parse Excel file. Please ensure it matches the template.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
  }, [onDataLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const downloadBessTemplate = () => {
    const headers = [
      "Time (seconds)", "Nameplate Energy Capacity, kW", 
      "Daily Energy Charged (kWh)", "Daily Energy Discharged (kWh)",
      "Budget Cycles", "Budget Internal Availability (%)",
      "Auxiliary Power, kW", "Total Availability", "Internal Availability", "Remarks", "Type of Outages",
      "Round Trip Efficiency at Point of Common Coupling",
      "Guaranteed Round Trip Efficiency based on LTSA",
      "Useable Discharge Energy Capacity at Point of Common Coupling",
      "Guaranteed Useable Discharge Energy Capacity based on LTSA"
    ];
    const rows = [
      ["2025-01-01", 14220, 13800, 12900, 1, "98%", 60.05, "100%", "100%", "", "External", "", "", "", ""],
      ["2025-01-02", 14220, 4000, 3800, 1, "98%", 45.68, "42%", "42%", "Communication Loss", "Internal", "", "", "", ""],
      ["2025-06-01", 14220, 13800, 12900, 1, "98%", 60.05, "100%", "100%", "LTSA Test Day", "None", 0.94, 0.92, 13500, 13000],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BESS");
    XLSX.writeFile(wb, "bess_template_standard.xlsx");
  };

  const generateBessMock = () => {
    setIsLoading(true);
    setTimeout(() => {
        try {
            const headers = [
              "Time (seconds)", "Nameplate Energy Capacity, kW",
              "Daily Energy Charged (kWh)", "Daily Energy Discharged (kWh)",
              "Budget Cycles", "Budget Internal Availability (%)",
              "Auxiliary Power, kW", "Total Availability", "Internal Availability", "Remarks", "Type of Outages",
              "Round Trip Efficiency at Point of Common Coupling",
              "Guaranteed Round Trip Efficiency based on LTSA",
              "Useable Discharge Energy Capacity at Point of Common Coupling",
              "Guaranteed Useable Discharge Energy Capacity based on LTSA"
            ];

            const rows: any[][] = [];
            const today = new Date();
            const startDate = subYears(today, 1);
            const daysToGenerate = 365;
            const capacity = 14220; // kWh

            for (let i = 0; i < daysToGenerate; i++) {
                const date = addDays(startDate, i);
                
                // Availability: Mostly 100, occasional dip
                let avail = 100;
                let intAvail = 100;
                let remarks = "";
                let outage = "None";

                if (Math.random() > 0.95) {
                    avail = Math.floor(Math.random() * 50) + 40;
                    if (Math.random() > 0.5) {
                        intAvail = avail;
                        outage = "Internal";
                        remarks = "Inverter Fault";
                    } else {
                        outage = "External";
                        remarks = "Grid Trip";
                    }
                }
                
                // Energy Data (For Cycles)
                const cycles = avail > 0 ? (0.8 + Math.random() * 0.4) * (avail/100) : 0;
                const eDischarged = capacity * cycles;
                const eCharged = eDischarged / 0.95; 
                
                // Aux Power
                const aux = 50 + (Math.random() * 20); // kW
                
                const budgetCycles = 1.0;
                const budgetIntAvail = 98.0;

                // LTSA Test Data (Once every 6 months roughly)
                let rteMeasured = "";
                let rteGuaranteed = "";
                let capMeasured = "";
                let capGuaranteed = "";

                if (i % 180 === 0) {
                   rteMeasured = (0.93 + (Math.random() * 0.03)).toFixed(2); // 93-96%
                   rteGuaranteed = "0.92";
                   capMeasured = (capacity * 0.95).toFixed(0);
                   capGuaranteed = (capacity * 0.92).toFixed(0);
                   remarks = "LTSA Scheduled Test";
                }

                rows.push([
                    format(date, 'yyyy-MM-dd'),
                    capacity,
                    eCharged.toFixed(0), eDischarged.toFixed(0),
                    budgetCycles, budgetIntAvail,
                    aux.toFixed(2),
                    avail, intAvail, remarks, outage,
                    rteMeasured, rteGuaranteed, capMeasured, capGuaranteed
                ]);
            }

            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            // Convert generated data back to JSON to simulate upload
            const jsonData = XLSX.utils.sheet_to_json<RawRow>(ws);
            onDataLoaded(jsonData);
        } catch (e) {
            console.error(e);
            setError("Failed to generate mock data");
        } finally {
            setIsLoading(false);
        }
    }, 500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 text-center ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileInput}
          accept=".xlsx,.xls,.csv"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center space-y-4">
          <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            ) : (
              <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`} />
            )}
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {isLoading ? 'Processing...' : 'Drop your Excel file here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              or click to browse
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
        <button
          onClick={downloadBessTemplate}
          className="flex items-center justify-center px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm group"
        >
          <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg mr-3 group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition-colors">
            <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Download Template</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Standard Excel Format</p>
          </div>
        </button>

        <button
          onClick={generateBessMock}
          className="flex items-center justify-center px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm group"
        >
          <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg mr-3 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
            <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Load Demo Data</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Try with sample dataset</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default FileUploader;