import { memo, useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleThreshold } from 'd3-scale';

const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// State FIPS to abbreviation mapping
const stateAbbrToFips = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25',
  MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32',
  NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
  OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47',
  TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55',
  WY: '56', DC: '11'
};

const fipsToStateAbbr = Object.fromEntries(
  Object.entries(stateAbbrToFips).map(([abbr, fips]) => [fips, abbr])
);

// Green to Red color scale (green = low complaints, red = high complaints)
const COLOR_SCALE = [
  '#22c55e', // green-500 (lowest)
  '#84cc16', // lime-500
  '#eab308', // yellow-500
  '#f97316', // orange-500
  '#ef4444', // red-500 (highest)
];

// Fixed thresholds for cleaner legend
const THRESHOLDS = [100, 500, 1000, 2000];

function StateHeatmap({ data, selectedState, onStateClick }) {
  // Group complaints by state
  const stateData = useMemo(() => {
    const counts = {};
    data.forEach(complaint => {
      const state = complaint.state;
      if (state && state.length === 2) {
        counts[state] = (counts[state] || 0) + 1;
      }
    });
    return counts;
  }, [data]);

  // Create color scale with fixed thresholds
  const colorScale = useMemo(() => {
    return scaleThreshold()
      .domain(THRESHOLDS)
      .range(COLOR_SCALE);
  }, []);

  const getStateColor = (stateAbbr) => {
    const count = stateData[stateAbbr] || 0;
    if (count === 0) return '#d1d5db'; // gray-300 for no data
    return colorScale(count);
  };

  // Get top 5 states for legend
  const topStates = useMemo(() => {
    return Object.entries(stateData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [stateData]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 lg:h-full flex flex-col">
      <div className="flex justify-between items-start gap-2 mb-3 sm:mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Complaints by State</h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-200">Tap a state to filter</p>
        </div>
        {selectedState && (
          <button
            onClick={() => onStateClick(null)}
            className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 active:text-blue-800 flex-shrink-0"
          >
            Clear ({selectedState})
          </button>
        )}
      </div>

      <div className="relative flex-grow flex items-center">
        <ComposableMap projection="geoAlbersUsa" className="w-full h-auto">
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map(geo => {
                const stateAbbr = fipsToStateAbbr[geo.id];
                const isSelected = selectedState === stateAbbr;
                const count = stateData[stateAbbr] || 0;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getStateColor(stateAbbr)}
                    stroke={isSelected ? '#1d4ed8' : '#fff'}
                    strokeWidth={isSelected ? 2 : 0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: {
                        fill: '#fbbf24',
                        outline: 'none',
                        cursor: 'pointer'
                      },
                      pressed: { outline: 'none' },
                    }}
                    onClick={() => onStateClick(stateAbbr === selectedState ? null : stateAbbr)}
                    data-tooltip-id="state-tooltip"
                    data-tooltip-content={`${stateAbbr}: ${count.toLocaleString()} complaints`}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Color Legend */}
      <div className="mt-3 sm:mt-4 border-t dark:border-gray-700 pt-3 sm:pt-4">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Volume:</p>
        <div className="flex items-center gap-0.5 sm:gap-1 mb-2 sm:mb-3">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 mr-1">Low</span>
          {COLOR_SCALE.map((color, i) => (
            <div
              key={i}
              className="flex-1 h-3 sm:h-4 first:rounded-l-sm last:rounded-r-sm"
              style={{ backgroundColor: color }}
            />
          ))}
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-1">High</span>
        </div>
        <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-400 ml-6 mr-6">
          <span>0</span>
          {THRESHOLDS.map((t) => (
            <span key={t}>{t.toLocaleString()}</span>
          ))}
          <span>{THRESHOLDS[THRESHOLDS.length - 1].toLocaleString()}+</span>
        </div>
      </div>

      {/* Top States */}
      <div className="mt-4 border-t dark:border-gray-700 pt-4">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Top States:</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {topStates.map(([state, count]) => (
            <button
              key={state}
              onClick={() => onStateClick(state === selectedState ? null : state)}
              className={`w-full text-center px-2 py-1 text-xs rounded ${
                state === selectedState
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {state}: {count.toLocaleString()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(StateHeatmap);
