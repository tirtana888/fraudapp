import React from 'react';
import {
    AreaChart,
    Area,
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
    Legend
} from 'recharts';

// --- Types ---

interface RevenueTrendData {
    month: string;
    revenue: number;
}

interface AssessmentVolumeData {
    day: string;
    assessments: number;
}

interface TierDistributionData {
    name: string;
    value: number;
}

// --- Mock Data Generators ---

const generateRevenueData = (): RevenueTrendData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, index) => ({
        month,
        revenue: Math.floor(15000000 + (index * 2500000) + (Math.random() * 5000000))
    }));
};

const generateAssessmentData = (): AssessmentVolumeData[] => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
        day,
        assessments: Math.floor(20 + Math.random() * 50)
    }));
};

// --- Components ---

interface RevenueChartProps {
    data?: RevenueTrendData[];
}

export const RevenueTrendChart: React.FC<RevenueChartProps> = ({ data }) => {
    const chartData = data || generateRevenueData();

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-gray-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
                    <p className="text-sm font-bold text-brand-orange">
                        Rp {payload[0].value.toLocaleString()}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Revenue Trend</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Monthly revenue over the last year</p>
                </div>
                <div className="flex gap-2">
                    {/* Time range toggle could go here */}
                </div>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#CC5500" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#CC5500" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickFormatter={(value) => `Rp ${(value / 1000000).toFixed(0)}M`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#CC5500"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

interface AssessmentVolumeChartProps {
    data?: AssessmentVolumeData[];
}

export const AssessmentVolumeChart: React.FC<AssessmentVolumeChartProps> = ({ data }) => {
    const chartData = data || generateAssessmentData();

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-gray-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {payload[0].value} Assessments
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assessment Volume</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Daily assessments over the last 7 days</p>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                        <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                        <Bar
                            dataKey="assessments"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

interface TierDistributionDataLocal {
    name: string;
    value: number;
    color: string;
}

interface TierDistributionChartProps {
    data?: TierDistributionDataLocal[];
}

export const TierDistributionChart: React.FC<TierDistributionChartProps> = ({ data }) => {
    // Using explicit colors for the donut chart
    const defaultData: TierDistributionDataLocal[] = [
        { name: 'Basic', value: 45, color: '#94a3b8' }, // Slate 400
        { name: 'Pro', value: 35, color: '#3b82f6' }, // Blue 500
        { name: 'Enterprise', value: 20, color: '#CC5500' }, // Brand Orange
    ];

    const chartData = data || defaultData;

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-gray-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {payload[0].name}: <span className="font-bold">{payload[0].value}%</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-brand-slate-850 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 h-full flex flex-col">
            <div className="mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">User Tiers</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Distribution by subscription tier</p>
            </div>
            <div className="flex-1 min-h-[250px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value, entry: any) => (
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 ml-1">{value}</span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Centered Total or Label if needed */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                    {/* Optional: Add center text */}
                </div>
            </div>
        </div>
    );
};
