import { useMemo } from "react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Shield } from "lucide-react";

interface EnhancedRiskChartProps {
  data: {
    predictions: Array<{
      date: number;
      riskScore: number;
      riskCategory: string;
      confidenceScore: number;
    }>;
    medicalData: Array<{
      date: number;
      glucoseLevel: number;
      bmi: number;
      systolicBP: number;
      diastolicBP: number;
    }>;
  };
  featureImportance?: Record<string, number>;
}

export function EnhancedRiskChart({ data, featureImportance }: EnhancedRiskChartProps) {
  const chartData = useMemo(() => {
    const combined = [];
    
    // Combine predictions and medical data by date
    const dataMap = new Map();
    
    data.predictions.forEach(pred => {
      const dateKey = new Date(pred.date).toDateString();
      dataMap.set(dateKey, {
        ...dataMap.get(dateKey),
        date: pred.date,
        riskScore: pred.riskScore,
        riskCategory: pred.riskCategory,
        confidenceScore: pred.confidenceScore,
      });
    });
    
    data.medicalData.forEach(med => {
      const dateKey = new Date(med.date).toDateString();
      dataMap.set(dateKey, {
        ...dataMap.get(dateKey),
        date: med.date,
        glucoseLevel: med.glucoseLevel,
        bmi: med.bmi,
        systolicBP: med.systolicBP,
        diastolicBP: med.diastolicBP,
      });
    });
    
    return Array.from(dataMap.values()).sort((a, b) => a.date - b.date);
  }, [data]);

  const getRiskColor = (category: string) => {
    switch (category) {
      case "low": return "#10b981";
      case "moderate": return "#f59e0b";
      case "high": return "#f97316";
      case "very_high": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const getRiskIcon = (category: string) => {
    switch (category) {
      case "low": return <Shield className="w-4 h-4" />;
      case "moderate": return <TrendingUp className="w-4 h-4" />;
      case "high": return <AlertTriangle className="w-4 h-4" />;
      case "very_high": return <AlertTriangle className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  // Prepare feature importance data for bar chart
  const featureData = useMemo(() => {
    if (!featureImportance) return [];
    
    return Object.entries(featureImportance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([feature, importance]) => ({
        feature: feature.replace(/([A-Z])/g, ' $1').trim(),
        importance: importance * 100,
        fill: '#3b82f6'
      }));
  }, [featureImportance]);

  // Prepare risk distribution data for pie chart
  const riskDistribution = useMemo(() => {
    const distribution = { low: 0, moderate: 0, high: 0, very_high: 0 };
    
    data.predictions.forEach(pred => {
      const category = pred.riskCategory.toLowerCase().replace(' ', '_');
      if (category in distribution) {
        distribution[category as keyof typeof distribution]++;
      }
    });
    
    return Object.entries(distribution).map(([category, count]) => ({
      name: category.replace('_', ' ').toUpperCase(),
      value: count,
      fill: getRiskColor(category)
    }));
  }, [data.predictions]);

  // Calculate trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return 'stable';
    const first = chartData[0]?.riskScore || 0;
    const last = chartData[chartData.length - 1]?.riskScore || 0;
    const diff = last - first;
    
    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>No data available for chart visualization</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Risk Score Trend */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-gray-900">Risk Score Trend</h4>
          <div className="flex items-center space-x-2">
            {trend === 'increasing' && <TrendingUp className="w-5 h-5 text-red-500" />}
            {trend === 'decreasing' && <TrendingDown className="w-5 h-5 text-green-500" />}
            {trend === 'stable' && <Shield className="w-5 h-5 text-blue-500" />}
            <span className="text-sm text-gray-600 capitalize">{trend} trend</span>
          </div>
        </div>
        {chartData.length < 2 && (
          <p className="text-sm text-amber-600 mb-4">
            Complete at least two assessments to unlock full trend analysis.
          </p>
        )}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                stroke="#6b7280"
                label={{ value: "Assessment Date", position: "insideBottom", offset: -5 }}
              />
              <YAxis 
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                stroke="#6b7280"
                label={{ value: "Risk Score (%)", angle: -90, position: "insideLeft" }}
              />
              <Legend />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-4 border rounded-lg shadow-lg">
                        <p className="font-medium">{label ? new Date(label).toLocaleDateString() : 'Unknown date'}</p>
                        <p className="text-blue-600">
                          Risk Score: {data.riskScore?.toFixed(1)}%
                        </p>
                        <p className="text-gray-600">
                          Confidence: {data.confidenceScore ? 
                            (typeof data.confidenceScore === 'number' ? 
                              data.confidenceScore.toFixed(1) : 
                              data.confidenceScore) : 'N/A'}%
                        </p>
                        {data.glucoseLevel && (
                          <p className="text-gray-600">
                            Glucose: {data.glucoseLevel} mg/dL
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="riskScore"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Importance */}
      {featureData.length > 0 && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h4 className="text-lg font-semibold text-gray-900 mb-6">Key Risk Factors</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  type="number" 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  stroke="#6b7280"
                />
                <YAxis 
                  dataKey="feature" 
                  type="category" 
                  width={120}
                  stroke="#6b7280"
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Importance']}
                  labelStyle={{ color: '#374151' }}
                />
                <Bar dataKey="importance" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Glucose Trend */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h5 className="font-semibold text-gray-900 mb-4 flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            Glucose Level (mg/dL)
          </h5>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.filter(d => d.glucoseLevel !== undefined)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  stroke="#9ca3af"
                />
                <YAxis
                  stroke="#9ca3af"
                  label={{ value: "mg/dL", angle: -90, position: "insideLeft" }}
                />
                <Line
                  type="monotone"
                  dataKey="glucoseLevel"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} mg/dL`, 'Glucose']}
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BMI Trend */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h5 className="font-semibold text-gray-900 mb-4 flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            BMI
          </h5>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.filter(d => d.bmi !== undefined)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  stroke="#9ca3af"
                />
                <YAxis
                  stroke="#9ca3af"
                  label={{ value: "BMI", angle: -90, position: "insideLeft" }}
                />
                <Line
                  type="monotone"
                  dataKey="bmi"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}`, 'BMI']}
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Blood Pressure Trend */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h5 className="font-semibold text-gray-900 mb-4 flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            Blood Pressure (mmHg)
          </h5>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.filter(d => d.systolicBP !== undefined && d.diastolicBP !== undefined)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  stroke="#9ca3af"
                />
                <YAxis
                  stroke="#9ca3af"
                  label={{ value: "mmHg", angle: -90, position: "insideLeft" }}
                />
                <Line
                  type="monotone"
                  dataKey="systolicBP"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', r: 4 }}
                  name="Systolic"
                />
                <Line
                  type="monotone"
                  dataKey="diastolicBP"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', r: 4 }}
                  name="Diastolic"
                />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} mmHg`, name]}
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      {riskDistribution.length > 0 && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h4 className="text-lg font-semibold text-gray-900 mb-6">Risk Distribution</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center space-y-3">
              {riskDistribution.map((item, index) => (
                <div key={index} className="flex items-center">
                  <div
                    className="w-4 h-4 rounded-full mr-3"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-sm text-gray-600">{item.name}</span>
                  <span className="ml-auto font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {chartData.length}
          </div>
          <div className="text-sm text-blue-800">Total Assessments</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {chartData.length > 0 ? chartData[chartData.length - 1]?.riskScore?.toFixed(1) : '0'}%
          </div>
          <div className="text-sm text-green-800">Latest Risk Score</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {chartData.length > 0 && chartData[chartData.length - 1]?.confidenceScore ? 
              (typeof chartData[chartData.length - 1].confidenceScore === 'number' ? 
                chartData[chartData.length - 1].confidenceScore.toFixed(1) : 
                chartData[chartData.length - 1].confidenceScore) : '0'}%
          </div>
          <div className="text-sm text-yellow-800">Confidence Level</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {trend === 'increasing' ? '↗' : trend === 'decreasing' ? '↘' : '→'}
          </div>
          <div className="text-sm text-purple-800">Trend Direction</div>
        </div>
      </div>
    </div>
  );
}
