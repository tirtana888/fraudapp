import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface PsychometricRadarProps {
    pressure: number;
    opportunity: number;
    rationalization: number;
}

const PsychometricRadar: React.FC<PsychometricRadarProps> = ({ pressure, opportunity, rationalization }) => {
    const data = [
        {
            subject: 'Pressure',
            A: pressure,
            fullMark: 100,
        },
        {
            subject: 'Opportunity',
            A: opportunity,
            fullMark: 100,
        },
        {
            subject: 'Rationalization',
            A: rationalization,
            fullMark: 100,
        },
    ];

    return (
        <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    />
                    <Radar
                        name="Candidate"
                        dataKey="A"
                        stroke="#D95D00"
                        fill="#D95D00"
                        fillOpacity={0.4}
                        isAnimationActive={true}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PsychometricRadar;
