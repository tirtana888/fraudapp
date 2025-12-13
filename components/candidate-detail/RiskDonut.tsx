import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface RiskDonutProps {
    score: number;
    size?: number;
}

const RiskDonut: React.FC<RiskDonutProps> = ({ score, size = 100 }) => {
    // Determine color based on score
    let color = '#22c55e'; // Green
    if (score > 35) color = '#eab308'; // Yellow
    if (score > 65) color = '#ef4444'; // Red

    // Data for the donut: [Score, Remaining]
    const data = [
        { name: 'Risk', value: score },
        { name: 'Safe', value: 100 - score },
    ];

    const emptyColor = '#f1f5f9'; // Slate-100

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius="70%"
                        outerRadius="90%"
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell key="risk" fill={color} />
                        <Cell key="safe" fill={emptyColor} />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>

            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color }}>{Math.round(score)}</span>
            </div>
        </div>
    );
};

export default RiskDonut;
