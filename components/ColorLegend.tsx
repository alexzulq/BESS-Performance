
import React from 'react';

const ColorLegend: React.FC = () => {
  return (
    <div className="flex flex-wrap items-center gap-6 text-xs mt-1 px-1 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center">
        <span className="w-8 h-0.5 bg-gray-500 border-t-2 border-dashed border-gray-500 mr-2"></span>
        <span className="text-gray-600 dark:text-gray-300 font-medium">Budget / Target</span>
      </div>
      <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
      <span className="text-gray-500 dark:text-gray-400 font-medium mr-1">Actual Performance:</span>
      <div className="flex items-center">
        <span className="w-3 h-3 rounded-full bg-green-500 mr-2 shadow-sm shrink-0"></span>
        <span className="text-gray-600 dark:text-gray-300 font-medium">Met or Exceeded</span>
      </div>
      <div className="flex items-center">
        <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2 shadow-sm shrink-0"></span>
        <span className="text-gray-600 dark:text-gray-300 font-medium">Deviate 0-10%</span>
      </div>
      <div className="flex items-center">
        <span className="w-3 h-3 rounded-full bg-red-500 mr-2 shadow-sm shrink-0"></span>
        <span className="text-gray-600 dark:text-gray-300 font-medium">Off Target {'>'}10%</span>
      </div>
    </div>
  );
};

export default ColorLegend;
