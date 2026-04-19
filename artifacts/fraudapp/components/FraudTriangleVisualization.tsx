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
  benchmarkAvg?: number; // Added benchmark prop
}> = ({ pressure, opportunity, rationalization, isDarkMode, benchmarkAvg = 50 }) => {
  const width = 320;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2 + 10;
  const maxRadius = 110;

  // Helper to calculate coordinates for a score at a specific angle
  const getCoords = (score: number, angleDeg: number) => {
    // Adjust angle: Pressure (Top, -90deg), Opportunity (Bottom Right, 30deg), Rationalization (Bottom Left, 150deg)
    // The previous code had specific logic. Let's standardize.
    // Pressure axis is typically UP or DOWN? Previous code: pressureY = centerY - ... (UP)
    // Let's stick to previous layout logic for consistency.

    // Pressure: Up (270 deg or -90 deg)
    // Opportunity: 30 deg
    // Rationalization: 150 deg

    // BUT calculate based on provided logic (Pressure vertical up)
    if (angleDeg === -90) {
      return { x: centerX, y: centerY - (score / 100) * maxRadius };
    }
    const angleRad = (Math.PI / 180) * angleDeg;
    return {
      x: centerX + (score / 100) * maxRadius * Math.cos(angleRad),
      y: centerY + (score / 100) * maxRadius * Math.sin(angleRad)
    };
  };

  const pC = getCoords(pressure, -90);
  const oC = getCoords(opportunity, 30);
  const rC = getCoords(rationalization, 150);

  const trianglePath = `M ${pC.x} ${pC.y} L ${oC.x} ${oC.y} L ${rC.x} ${rC.y} Z`;

  // Benchmark Triangle (Equilateral based on average)
  const bP = getCoords(benchmarkAvg, -90);
  const bO = getCoords(benchmarkAvg, 30);
  const bR = getCoords(benchmarkAvg, 150);
  const benchmarkPath = `M ${bP.x} ${bP.y} L ${bO.x} ${bO.y} L ${bR.x} ${bR.y} Z`;

  // Grid Levels (20, 40, 60, 80, 100)
  const levels = [20, 40, 60, 80, 100];

  const getColorByScore = (score: number) => {
    if (score >= 70) return '#ef4444';
    if (score >= 50) return '#f59e0b';
    if (score >= 30) return '#eab308';
    return '#22c55e';
  };

  const avgScore = Math.round((pressure + opportunity + rationalization) / 3);
  const mainColor = getColorByScore(avgScore);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="mx-auto overflow-visible">
      <defs>
        <linearGradient id="fraudGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={mainColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={mainColor} stopOpacity="0.4" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Radar Grid (Concentric Triangles) */}
      {levels.map((level) => {
        const lP = getCoords(level, -90);
        const lO = getCoords(level, 30);
        const lR = getCoords(level, 150);
        const path = `M ${lP.x} ${lP.y} L ${lO.x} ${lO.y} L ${lR.x} ${lR.y} Z`;
        return (
          <path
            key={level}
            d={path}
            fill="none"
            stroke={isDarkMode ? '#334155' : '#e2e8f0'}
            strokeWidth="1"
            strokeDasharray={level === 100 ? "0" : "4,4"}
          />
        );
      })}

      {/* Axis Lines */}
      {[-90, 30, 150].map(angle => {
        const start = { x: centerX, y: centerY };
        const end = getCoords(100, angle);
        return <line key={angle} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="1" />;
      })}

      {/* 2. Benchmark/Industry Overlay (Ghost Triangle) */}
      <path
        d={benchmarkPath}
        fill="none"
        stroke={isDarkMode ? '#64748b' : '#94a3b8'}
        strokeWidth="2"
        strokeDasharray="6,4"
        className="opacity-60"
      />
      <text x={bO.x + 10} y={bO.y} className="text-[10px] fill-gray-400 font-medium hidden md:block">Avg</text>

      {/* 3. Candidate Data Triangle (Animated) */}
      <path
        d={trianglePath}
        fill="url(#fraudGradient)"
        stroke={mainColor}
        strokeWidth="3"
        strokeLinejoin="round"
        filter="url(#glow)"
        className="drop-shadow-lg transition-all duration-1000 ease-out"
      >
        <animate attributeName="d" from={benchmarkPath} to={trianglePath} dur="1.5s" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
      </path>

      {/* Vertex Markers */}
      <g className="transition-all duration-1000 delay-500">
        <circle cx={pC.x} cy={pC.y} r="6" fill={getColorByScore(pressure)} stroke="#fff" strokeWidth="2" />
        <text x={pC.x} y={pC.y - 15} textAnchor="middle" className="text-xs font-bold uppercase tracking-wider" fill={isDarkMode ? '#f97316' : '#ea580c'}>Tekanan</text>

        <circle cx={oC.x} cy={oC.y} r="6" fill={getColorByScore(opportunity)} stroke="#fff" strokeWidth="2" />
        <text x={oC.x + 15} y={oC.y + 5} textAnchor="start" className="text-xs font-bold uppercase tracking-wider" fill={isDarkMode ? '#60a5fa' : '#2563eb'}>Peluang</text>

        <circle cx={rC.x} cy={rC.y} r="6" fill={getColorByScore(rationalization)} stroke="#fff" strokeWidth="2" />
        <text x={rC.x - 15} y={rC.y + 5} textAnchor="end" className="text-xs font-bold uppercase tracking-wider" fill={isDarkMode ? '#f97316' : '#ea580c'}>Rasionalisasi</text>
      </g>

      {/* Center Point */}
      <circle cx={centerX} cy={centerY} r="3" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
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
