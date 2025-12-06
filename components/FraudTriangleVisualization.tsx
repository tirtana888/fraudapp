import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, Activity, MessageCircle } from 'lucide-react';

interface FraudTriangleVisualizationProps {
  pressure: number;
  opportunity: number;
  rationalization: number;
  isDarkMode?: boolean;
  consistencyScore?: number;
  sentimentScore?: number;
  benchmarkAvg?: number;
  industryAvg?: number;
}

const DynamicFraudTriangle: React.FC<{
  pressure: number;
  opportunity: number;
  rationalization: number;
  isDarkMode?: boolean;
}> = ({ pressure, opportunity, rationalization, isDarkMode }) => {
  const width = 320;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2 + 10;
  const maxRadius = 110;

  const pressureX = centerX;
  const pressureY = centerY - (pressure / 100) * maxRadius;

  const opportunityAngle = (Math.PI / 180) * 30;
  const opportunityX = centerX + (opportunity / 100) * maxRadius * Math.cos(opportunityAngle);
  const opportunityY = centerY + (opportunity / 100) * maxRadius * Math.sin(opportunityAngle);

  const rationalizationAngle = (Math.PI / 180) * 150;
  const rationalizationX = centerX + (rationalization / 100) * maxRadius * Math.cos(rationalizationAngle);
  const rationalizationY = centerY + (rationalization / 100) * maxRadius * Math.sin(rationalizationAngle);

  const trianglePath = `M ${pressureX} ${pressureY} L ${opportunityX} ${opportunityY} L ${rationalizationX} ${rationalizationY} Z`;

  const refPressureY = centerY - maxRadius;
  const refOpportunityX = centerX + maxRadius * Math.cos(opportunityAngle);
  const refOpportunityY = centerY + maxRadius * Math.sin(opportunityAngle);
  const refRationalizationX = centerX + maxRadius * Math.cos(rationalizationAngle);
  const refRationalizationY = centerY + maxRadius * Math.sin(rationalizationAngle);
  const refPath = `M ${centerX} ${refPressureY} L ${refOpportunityX} ${refOpportunityY} L ${refRationalizationX} ${refRationalizationY} Z`;

  const getColorByScore = (score: number) => {
    if (score >= 70) return '#ef4444';
    if (score >= 50) return '#f59e0b';
    if (score >= 30) return '#eab308';
    return '#22c55e';
  };

  const avgScore = Math.round((pressure + opportunity + rationalization) / 3);
  const mainColor = getColorByScore(avgScore);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="mx-auto">
      <defs>
        <linearGradient id="fraudGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={mainColor} stopOpacity="0.7" />
          <stop offset="100%" stopColor={mainColor} stopOpacity="0.3" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <path
        d={refPath}
        fill={isDarkMode ? '#1e293b' : '#f8fafc'}
        stroke={isDarkMode ? '#334155' : '#e2e8f0'}
        strokeWidth="2"
        strokeDasharray="5,5"
        opacity="0.5"
      />

      <path
        d={trianglePath}
        fill="url(#fraudGradient)"
        stroke={mainColor}
        strokeWidth="3"
        strokeLinejoin="round"
        filter="url(#glow)"
      />

      <circle cx={pressureX} cy={pressureY} r="8" fill={getColorByScore(pressure)} stroke="#fff" strokeWidth="3" />
      <text x={pressureX} y={pressureY - 20} textAnchor="middle" className="text-xs font-bold" fill={isDarkMode ? '#f97316' : '#ea580c'}>
        Tekanan
      </text>
      <text x={pressureX} y={pressureY - 6} textAnchor="middle" className="text-lg font-black" fill={isDarkMode ? '#fb923c' : '#ea580c'}>
        {pressure}
      </text>

      <circle cx={opportunityX} cy={opportunityY} r="8" fill={getColorByScore(opportunity)} stroke="#fff" strokeWidth="3" />
      <text x={opportunityX + 20} y={opportunityY - 8} textAnchor="start" className="text-xs font-bold" fill={isDarkMode ? '#60a5fa' : '#2563eb'}>
        Peluang
      </text>
      <text x={opportunityX + 20} y={opportunityY + 8} textAnchor="start" className="text-lg font-black" fill={isDarkMode ? '#60a5fa' : '#2563eb'}>
        {opportunity}
      </text>

      <circle cx={rationalizationX} cy={rationalizationY} r="8" fill={getColorByScore(rationalization)} stroke="#fff" strokeWidth="3" />
      <text x={rationalizationX - 20} y={rationalizationY - 8} textAnchor="end" className="text-xs font-bold" fill={isDarkMode ? '#f97316' : '#ea580c'}>
        Rasionalisasi
      </text>
      <text x={rationalizationX - 20} y={rationalizationY + 8} textAnchor="end" className="text-lg font-black" fill={isDarkMode ? '#fb923c' : '#ea580c'}>
        {rationalization}
      </text>

      <circle cx={centerX} cy={centerY} r="4" fill={isDarkMode ? '#64748b' : '#94a3b8'} opacity="0.6" />
    </svg>
  );
};

const FraudTriangleVisualization: React.FC<FraudTriangleVisualizationProps> = ({
  pressure,
  opportunity,
  rationalization,
  isDarkMode,
  consistencyScore = 85,
  sentimentScore = 75,
  benchmarkAvg = 45,
  industryAvg = 50
}) => {
  const avgScore = Math.round((pressure + opportunity + rationalization) / 3);

  const getScoreInterpretation = (score: number) => {
    if (score >= 70) return { label: 'Sangat Tinggi', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertCircle };
    if (score >= 50) return { label: 'Tinggi', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: AlertCircle };
    if (score >= 30) return { label: 'Sedang', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: Minus };
    return { label: 'Rendah', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: CheckCircle2 };
  };

  const getTrend = (candidateScore: number, benchmark: number) => {
    const diff = candidateScore - benchmark;
    if (Math.abs(diff) < 5) return { icon: Minus, color: 'text-gray-500', text: 'Setara' };
    if (diff > 0) return { icon: TrendingUp, color: 'text-red-500', text: `+${Math.round(diff)}` };
    return { icon: TrendingDown, color: 'text-green-500', text: `${Math.round(diff)}` };
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 80) return { label: 'Sangat Positif', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 60) return { label: 'Positif', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 40) return { label: 'Netral', color: 'text-gray-600', bg: 'bg-gray-50' };
    if (score >= 20) return { label: 'Negatif', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { label: 'Sangat Negatif', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const getConsistencyLabel = (score: number) => {
    if (score >= 85) return { label: 'Sangat Konsisten', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 70) return { label: 'Konsisten', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 50) return { label: 'Cukup Konsisten', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { label: 'Tidak Konsisten', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const pressureInterpretation = getScoreInterpretation(pressure);
  const opportunityInterpretation = getScoreInterpretation(opportunity);
  const rationalizationInterpretation = getScoreInterpretation(rationalization);
  const benchmarkTrend = getTrend(avgScore, benchmarkAvg);
  const industryTrend = getTrend(avgScore, industryAvg);
  const sentimentInfo = getSentimentLabel(sentimentScore);
  const consistencyInfo = getConsistencyLabel(consistencyScore);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 pb-4 border-b border-gray-100 dark:border-slate-700 text-center">
          Visualisasi Fraud Triangle
        </h3>

        <div className="w-full h-[300px] flex items-center justify-center">
          <DynamicFraudTriangle
            pressure={pressure}
            opportunity={opportunity}
            rationalization={rationalization}
            isDarkMode={isDarkMode}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className={`p-4 rounded-xl border-2 ${pressureInterpretation.bg} border-opacity-50`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-bold tracking-wider">Tekanan</p>
              {React.createElement(pressureInterpretation.icon, {
                size: 16,
                className: pressureInterpretation.color
              })}
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">{pressure}</p>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${pressureInterpretation.color.replace('text-', 'bg-')} rounded-full transition-all duration-500`}
                style={{ width: `${pressure}%` }}
              />
            </div>
            <p className={`text-xs font-bold ${pressureInterpretation.color}`}>{pressureInterpretation.label}</p>
          </div>

          <div className={`p-4 rounded-xl border-2 ${opportunityInterpretation.bg} border-opacity-50`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-bold tracking-wider">Peluang</p>
              {React.createElement(opportunityInterpretation.icon, {
                size: 16,
                className: opportunityInterpretation.color
              })}
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">{opportunity}</p>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${opportunityInterpretation.color.replace('text-', 'bg-')} rounded-full transition-all duration-500`}
                style={{ width: `${opportunity}%` }}
              />
            </div>
            <p className={`text-xs font-bold ${opportunityInterpretation.color}`}>{opportunityInterpretation.label}</p>
          </div>

          <div className={`p-4 rounded-xl border-2 ${rationalizationInterpretation.bg} border-opacity-50`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-bold tracking-wider">Rasionalisasi</p>
              {React.createElement(rationalizationInterpretation.icon, {
                size: 16,
                className: rationalizationInterpretation.color
              })}
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">{rationalization}</p>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${rationalizationInterpretation.color.replace('text-', 'bg-')} rounded-full transition-all duration-500`}
                style={{ width: `${rationalization}%` }}
              />
            </div>
            <p className={`text-xs font-bold ${rationalizationInterpretation.color}`}>{rationalizationInterpretation.label}</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center italic">
          Bentuk segitiga berubah sesuai nilai komponen. Semakin besar area, semakin tinggi risiko.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-brand-slate-850 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Skor Konsistensi</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Konsistensi jawaban</p>
            </div>
          </div>

          <div className="flex items-end gap-3 mb-3">
            <div className="text-4xl font-black text-gray-900 dark:text-white">{consistencyScore}</div>
            <div className="text-lg text-gray-400 mb-1">/100</div>
          </div>

          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700"
              style={{ width: `${consistencyScore}%` }}
            />
          </div>

          <div className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold ${consistencyInfo.bg} ${consistencyInfo.color}`}>
            {consistencyInfo.label}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
            Mengukur kesesuaian antara jawaban survei dan wawancara. Skor tinggi menunjukkan kandidat jujur dan konsisten.
          </p>
        </div>

        <div className="bg-white dark:bg-brand-slate-850 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <MessageCircle size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Analisis Sentimen</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sentimen wawancara</p>
            </div>
          </div>

          <div className="flex items-end gap-3 mb-3">
            <div className="text-4xl font-black text-gray-900 dark:text-white">{sentimentScore}</div>
            <div className="text-lg text-gray-400 mb-1">/100</div>
          </div>

          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
              style={{ width: `${sentimentScore}%` }}
            />
          </div>

          <div className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold ${sentimentInfo.bg} ${sentimentInfo.color}`}>
            {sentimentInfo.label}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
            Sentimen keseluruhan dari jawaban kandidat. Sentimen positif menunjukkan sikap terbuka dan kooperatif.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 p-6 rounded-2xl border-2 border-blue-200 dark:border-slate-700">
        <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-600" />
          Perbandingan Benchmark
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-bold mb-2">Skor Kandidat</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">{avgScore}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Rata-rata Fraud Triangle</p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-bold mb-2">Benchmark Perusahaan</p>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-3xl font-black text-gray-900 dark:text-white">{benchmarkAvg}</p>
              <div className={`flex items-center gap-1 ${benchmarkTrend.color} text-sm font-bold`}>
                {React.createElement(benchmarkTrend.icon, { size: 16 })}
                <span>{benchmarkTrend.text}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Perbandingan internal</p>
          </div>
        </div>

        <div className="mt-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-100 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-bold mb-2">Benchmark Industri</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black text-gray-900 dark:text-white">{industryAvg}</p>
            <div className={`flex items-center gap-1 ${industryTrend.color} text-sm font-bold`}>
              {React.createElement(industryTrend.icon, { size: 16 })}
              <span>{industryTrend.text}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Standar industri sejenis</p>
        </div>

        <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            <strong>Interpretasi:</strong> {
              avgScore > benchmarkAvg + 10
                ? 'Kandidat menunjukkan risiko lebih tinggi dari rata-rata internal perusahaan. Pertimbangkan verifikasi tambahan.'
                : avgScore < benchmarkAvg - 10
                  ? 'Kandidat menunjukkan risiko lebih rendah dari rata-rata internal. Kandidat berpotensi baik.'
                  : 'Kandidat berada pada tingkat risiko yang setara dengan rata-rata internal perusahaan.'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default FraudTriangleVisualization;
