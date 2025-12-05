import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  TrendingUp,
  Users,
  Mail,
  Shield,
  Loader2,
  Calendar
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { db } from '../services/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { CompanyProfile } from '../types';

const BRAND_ORANGE = '#C25E00';
const CHART_COLORS = {
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#10B981',
};

interface GlobalMetrics {
  total_assessments: number;
  completed_assessments: number;
  email_usage: number;
  kyc_usage: number;
  risk_distribution: {
    High: number;
    Medium: number;
    Low: number;
  };
  last_updated: string;
}

const SuperAdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(true);

  // Real-time listener for global metrics
  useEffect(() => {
    const statsRef = doc(db, 'stats', 'global_metrics');

    const unsubscribe = onSnapshot(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        setMetrics(snapshot.data() as GlobalMetrics);
      } else {
        // Initialize with zeros if no data
        setMetrics({
          total_assessments: 0,
          completed_assessments: 0,
          email_usage: 0,
          kyc_usage: 0,
          risk_distribution: { High: 0, Medium: 0, Low: 0 },
          last_updated: new Date().toISOString()
        });
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to stats:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch recent companies
  useEffect(() => {
    const fetchRecentCompanies = async () => {
      try {
        const q = query(
          collection(db, 'companies'),
          orderBy('joinedDate', 'desc'),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const companiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CompanyProfile[];
        setCompanies(companiesData);
      } catch (error) {
        console.error('Error fetching companies:', error);
      } finally {
        setCompaniesLoading(false);
      }
    };

    fetchRecentCompanies();
  }, []);

  // Calculate derived metrics
  const highRiskPercentage = metrics ?
    (metrics.completed_assessments > 0
      ? ((metrics.risk_distribution.High / metrics.completed_assessments) * 100).toFixed(1)
      : '0.0')
    : '0.0';

  const totalCompaniesCount = companies.length; // Could be fetched separately for exact count

  // Estimated revenue (example calculation: $50 per completed assessment)
  const estimatedRevenue = metrics ? (metrics.completed_assessments * 50).toLocaleString() : '0';

  // Prepare chart data
  const riskChartData = metrics ? [
    { name: 'Low Risk', value: metrics.risk_distribution.Low, color: CHART_COLORS.Low },
    { name: 'Medium Risk', value: metrics.risk_distribution.Medium, color: CHART_COLORS.Medium },
    { name: 'High Risk', value: metrics.risk_distribution.High, color: CHART_COLORS.High },
  ] : [];

  const fraudIndicatorsData = metrics ? [
    { name: 'Email Sent', count: metrics.email_usage },
    { name: 'KYC Checks', count: metrics.kyc_usage },
    { name: 'High Risk', count: metrics.risk_distribution.High },
  ] : [];

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'Suspended':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getTierBadgeStyle = (tier: string) => {
    switch (tier) {
      case 'Enterprise':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'Premium':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Basic':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back! Today is {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Assessments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm text-green-600 font-medium">Live</span>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold text-gray-900">
              {metrics?.total_assessments.toLocaleString() || '0'}
            </p>
            <p className="text-sm text-gray-600">Total Assessments</p>
            <p className="text-xs text-gray-500 mt-2">
              {metrics?.completed_assessments || 0} completed
            </p>
          </div>
        </div>

        {/* High Risk Detected */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-sm text-red-600 font-medium">{highRiskPercentage}%</span>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold text-gray-900">
              {metrics?.risk_distribution.High || 0}
            </p>
            <p className="text-sm text-gray-600">High Risk Detected</p>
            <p className="text-xs text-gray-500 mt-2">
              Requires immediate review
            </p>
          </div>
        </div>

        {/* Companies Onboarded */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm text-blue-600 font-medium">
              <TrendingUp className="w-4 h-4 inline" />
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold text-gray-900">
              {totalCompaniesCount}
            </p>
            <p className="text-sm text-gray-600">Companies Onboarded</p>
            <p className="text-xs text-gray-500 mt-2">
              Active clients
            </p>
          </div>
        </div>

        {/* Estimated Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm text-green-600 font-medium">Est.</span>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold text-gray-900">
              ${estimatedRevenue}
            </p>
            <p className="text-sm text-gray-600">Estimated Revenue</p>
            <p className="text-xs text-gray-500 mt-2">
              Based on completed assessments
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Risk Distribution Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-600" />
            Integrity Risk Distribution
          </h2>
          {riskChartData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No risk data available yet</p>
              </div>
            </div>
          )}
        </div>

        {/* Fraud Indicators Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-600" />
            System Usage Metrics
          </h2>
          {fraudIndicatorsData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fraudIndicatorsData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill={BRAND_ORANGE} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No usage data available yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Companies Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-600" />
            Recent Companies
          </h2>
        </div>

        {companiesLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No companies registered yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidates
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.map((company, index) => (
                  <tr
                    key={company.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Building2 className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {company.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {company.adminEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTierBadgeStyle(company.tier)}`}>
                        {company.tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {formatDate(company.joinedDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeStyle(company.status)}`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        {company.usersCount || 0}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Last Updated Footer */}
      {metrics && (
        <div className="mt-6 text-center text-sm text-gray-500">
          Last updated: {new Date(metrics.last_updated).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
