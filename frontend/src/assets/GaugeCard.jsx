import React from "react";
import { 
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis
} from "recharts";

const GaugeCard = ({
  gauge = {},
  colorInfo = {},
  timeFrameLabel = "",
  highlightNegative = false,
}) => {
  const { name = "Metric", value = 0, max = 100 } = gauge;
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  // For negative values, we'll show the absolute value in the chart but indicate it's negative in text
  const chartValue = isNegative ? absValue : value;
  const percentage = Math.min((absValue / max) * 100, 100);

  // Determine colors based on whether value is negative
  const gradientStart = isNegative ? '#ef4444' : (colorInfo.gradientStart || '#00C49F');
  const gradientEnd = isNegative ? '#dc2626' : (colorInfo.gradientEnd || '#0088FE');
  const textColor = isNegative ? 'text-red-600' : (colorInfo.text || 'text-gray-800');
  const percentColor = isNegative ? 'text-red-500' : 'text-gray-500';

  return (
    <div className="bg-white rounded-xl p-5 -mx-3 lg:-mx-0 md:-mx-5 shadow-sm flex flex-col items-center border border-gray-100">
      <h3 className={`text-lg font-semibold mb-4 ${textColor}`}>
        {name}
      </h3>
      <div className="w-full h-48">
        <ResponsiveContainer>
          <RadialBarChart
            data={[{...gauge, value: chartValue}]}
            cx="50%"
            cy="40%"
            startAngle={180}
            endAngle={0}
            innerRadius="70%"
            outerRadius="100%"
          >
            <PolarAngleAxis
              type="number"
              domain={[0, max]}
              angleAxisId={0}
              tick={false}
              allowDataOverflow
            />

            <RadialBar
              minAngle={15}
              background={{ fill: '#f3f4f6' }}
              dataKey="value"
              cornerRadius="50%"
              fill={`url(#${name}Gradient)`}
            />

            <text 
              x="50%" 
              y="50%" 
              textAnchor="middle" 
              dominantBaseline="middle"
              className={`text-2xl font-bold ${textColor}`}
            >
              {isNegative ? '-' : ''}${Math.round(absValue).toLocaleString()}
            </text>
            <text 
              x="50%" 
              y="65%" 
              textAnchor="middle" 
              dominantBaseline="middle"
              className={`text-sm ${percentColor}`}
            >
              {Math.round(percentage)}%
            </text>

            <defs>
              <linearGradient id={`${name}Gradient`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientStart} />
                <stop offset="100%" stopColor={gradientEnd} />
              </linearGradient>
            </defs>
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center mt-3">
        {isNegative && highlightNegative && (
          <p className="text-sm text-red-600 font-semibold mb-1">
            Negative savings
          </p>
        )}
        <p className="text-sm text-gray-500">
          {timeFrameLabel} data
        </p>
      </div>
    </div>
  );
};

export default GaugeCard;