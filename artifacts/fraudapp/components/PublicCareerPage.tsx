import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { CompanyProfile, Job } from '../types';
import {
  Briefcase,
  MapPin,
  Clock,
  ArrowRight,
  Building2,
  Loader2,
  AlertCircle,
  Globe,
  Instagram,
  Linkedin
} from 'lucide-react';

import { getCompanyBySlug } from '../services/firebase';

interface PublicCareerPageProps {
  companySlug?: string;
}

const PublicCareerPage: React.FC<PublicCareerPageProps> = ({ companySlug: propCompanySlug }) => {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Determine effective identifier (Slug from prop/URL, or ID from URL)
  const identifier = React.useMemo(() => {
    if (propCompanySlug) return { type: 'slug', value: propCompanySlug };

    const pathname = window.location.pathname;
    // Try matching slug route first if no prop (unexpected but safe)
    const slugMatch = pathname.match(/^\/jobs\/([^/]+)\/?$/);
    if (slugMatch) return { type: 'slug', value: slugMatch[1] };

    // Legacy ID route
    const idMatch = pathname.match(/^\/careers\/([^/]+)\/?$/);
    return idMatch ? { type: 'id', value: idMatch[1] } : null;
  }, [propCompanySlug]);

  useEffect(() => {
    if (!identifier) {
      setError('Invalid company link');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        let companyData: CompanyProfile | null = null;

        if (identifier.type === 'slug') {
          companyData = await getCompanyBySlug(identifier.value);
        } else {
          const companyDoc = await getDoc(doc(db, 'companies', identifier.value));
          if (companyDoc.exists()) {
            companyData = { id: companyDoc.id, ...companyDoc.data() } as CompanyProfile;
          }
        }

        if (!companyData) {
          setError('Company not found');
          setLoading(false);
          return;
        }

        setCompany(companyData);

        // Fetch jobs using the retrieved company ID
        const jobsQuery = query(
          collection(db, 'jobs'),
          where('companyId', '==', companyData.id),
          where('status', '==', 'Active')
        );
        const jobsSnapshot = await getDocs(jobsQuery);
        const jobsData = jobsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Job[];

        jobsData.sort((a, b) => {
          const dateA = a.datePosted ? new Date(a.datePosted).getTime() : 0;
          const dateB = b.datePosted ? new Date(b.datePosted).getTime() : 0;
          return dateB - dateA;
        });

        setJobs(jobsData);
      } catch (err) {
        console.error('Error fetching career page data:', err);
        setError('Failed to load career page');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [identifier]);

  const getJobTypeIcon = (jobType: string) => {
    switch (jobType) {
      case 'Full-time':
        return <Clock className="w-4 h-4" />;
      case 'Part-time':
        return <Clock className="w-4 h-4" />;
      case 'Contract':
        return <Briefcase className="w-4 h-4" />;
      case 'Internship':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <Briefcase className="w-4 h-4" />;
    }
  };

  const brandColor = company?.brandColor || '#CC5500';
  const lighterBrandColor = brandColor + '20';
  const darkerBrandColor = brandColor + 'dd';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: brandColor }} />
          <p className="text-gray-600 dark:text-gray-400">Loading career opportunities...</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="text-center bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'This career page does not exist.'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Header */}
      <div className="relative overflow-hidden" style={{
        background: `linear-gradient(135deg, ${brandColor}15 0%, ${brandColor}05 100%)`
      }}>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ backgroundColor: brandColor }}></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ backgroundColor: brandColor }}></div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          {/* Company Logo and Info */}
          <div className="flex flex-col items-center text-center mb-8">
            {company.logoUrl ? (
              <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl">
                <img
                  src={company.logoUrl}
                  alt={`${company.name} logo`}
                  className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
                />
              </div>
            ) : (
              <div
                className="mb-6 p-8 rounded-3xl shadow-xl flex items-center justify-center"
                style={{ backgroundColor: lighterBrandColor }}
              >
                <Building2 className="w-24 h-24 sm:w-32 sm:h-32" style={{ color: brandColor }} />
              </div>
            )}

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              {company.name}
            </h1>

            {company.welcomeMessage && (
              <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 max-w-3xl leading-relaxed">
                {company.welcomeMessage}
              </p>
            )}

            <div className="flex items-center gap-6 mt-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                <Briefcase className="w-5 h-5" style={{ color: brandColor }} />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {jobs.length} Open Position{jobs.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {jobs.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex p-6 rounded-full mb-6" style={{ backgroundColor: lighterBrandColor }}>
              <Briefcase className="w-16 h-16" style={{ color: brandColor }} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              No Open Positions Yet
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              We don't have any job openings at the moment, but check back soon for exciting opportunities!
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
                Open Positions
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Find your next career opportunity with us
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs.map((job) => {
                const companySlug = company?.companySlug || company?.name.toLowerCase().replace(/\s+/g, '-');
                const jobLink = `/jobs/${companySlug}/${job.slug}`;

                return (
                  <div
                    key={job.id}
                    onClick={() => window.location.href = jobLink}
                    className="group relative bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm border-2 border-gray-200 dark:border-slate-700 hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden"
                    style={{
                      borderColor: `${brandColor}00`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = brandColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${brandColor}00`;
                    }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" style={{ backgroundColor: brandColor }}></div>

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 group-hover:translate-x-1 transition-transform">
                            {job.title}
                          </h3>
                          <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4" />
                              <span>{job.location}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {getJobTypeIcon(job.jobType)}
                              <span>{job.jobType}</span>
                            </div>
                          </div>
                        </div>
                        <div
                          className="p-3 rounded-xl group-hover:scale-110 transition-transform duration-300"
                          style={{ backgroundColor: lighterBrandColor }}
                        >
                          <ArrowRight className="w-6 h-6" style={{ color: brandColor }} />
                        </div>
                      </div>

                      <p className="text-gray-700 dark:text-gray-300 mb-6 line-clamp-3">
                        {job.description.replace(/<[^>]*>/g, '').substring(0, 150)}...
                      </p>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Posted {new Date(job.datePosted).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        <button
                          className="px-5 py-2.5 rounded-xl font-semibold text-white transition-all duration-300 group-hover:shadow-lg"
                          style={{
                            backgroundColor: brandColor,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = darkerBrandColor;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = brandColor;
                          }}
                        >
                          Apply Now
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-slate-700 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p className="mb-4">© {new Date().getFullYear()} {company.name}. All rights reserved.</p>
            <a
              href="https://hiregood.one"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 group"
            >
              <img
                src="/untitled_design_(43).png"
                alt="HireGood Logo"
                className="h-5 w-5 object-contain"
              />
              <span className="text-sm font-medium">
                Powered by <span className="font-bold text-orange-600 group-hover:text-orange-700 transition-colors">hiregood.one</span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicCareerPage;
