import React, { useState, useEffect } from 'react';
import {
  Search,
  Menu,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  CornerDownRight,
  Hash
} from 'lucide-react';
import { DOCUMENTATION_DATA, DocSection, DocContent } from '../constants/documentationData';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

// Utility for merging tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Documentation() {
  const [activeSection, setActiveSection] = useState<string>('jobs');
  const [activeSubSection, setActiveSubSection] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ section: DocSection, content: DocContent }[]>([]);

  // Search Logic
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results: { section: DocSection, content: DocContent }[] = [];

    DOCUMENTATION_DATA.forEach(section => {
      section.content.forEach(content => {
        if (
          content.subtitle.toLowerCase().includes(query) ||
          content.description.toLowerCase().includes(query) ||
          section.title.toLowerCase().includes(query)
        ) {
          results.push({ section, content });
        }
      });
    });
    setSearchResults(results);
  }, [searchQuery]);

  // Scroll Spy Logic
  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('h3[id], h4[id]');
      let current = '';

      headings.forEach(heading => {
        const top = heading.getBoundingClientRect().top;
        if (top < 150) {
          current = heading.id;
        }
      });

      if (current) {
        // Check if it's a section or subsection
        const isSection = DOCUMENTATION_DATA.find(s => s.id === current);
        if (isSection) {
          setActiveSection(current);
        } else {
          // Find parent section
          const parent = DOCUMENTATION_DATA.find(s => s.content.some(c => c.id === current));
          if (parent) setActiveSection(parent.id);
          setActiveSubSection(current);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToId = (id: string, isMobile = false) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      if (isMobile) setSidebarOpen(false);
      setSearchQuery(''); // Close search results
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-[#D95D00] text-white rounded-full shadow-lg hover:bg-[#B14d00] transition-transform active:scale-95"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:h-[calc(100vh-2rem)] lg:sticky lg:top-8 rounded-xl",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full overflow-y-auto p-4 custom-scrollbar">
          <div className="mb-8 px-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#D95D00] to-orange-400 bg-clip-text text-transparent">
              Dokumentasi
            </h1>
            <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">HireGood Platform Guide</p>
          </div>

          <nav className="space-y-1">
            {DOCUMENTATION_DATA.map((section) => (
              <div key={section.id} className="mb-4">
                <button
                  onClick={() => scrollToId(section.id, true)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors group",
                    activeSection === section.id
                      ? "bg-orange-50 text-[#D95D00] dark:bg-orange-900/10 dark:text-orange-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <span className={cn("transition-colors", activeSection === section.id ? "text-[#D95D00]" : "text-slate-400 group-hover:text-slate-600")}>
                    {section.icon}
                  </span>
                  {section.title}
                </button>

                {/* Nested Links */}
                {activeSection === section.id && (
                  <div className="mt-1 ml-4 pl-4 border-l border-slate-200 dark:border-slate-800 space-y-1">
                    {section.content.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => scrollToId(sub.id, true)}
                        className={cn(
                          "block w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors truncate",
                          activeSubSection === sub.id
                            ? "text-[#D95D00] font-medium bg-orange-50/50 dark:bg-transparent"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300"
                        )}
                      >
                        {sub.subtitle}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[-1] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 py-8 relative">
        <div className="max-w-3xl mx-auto">

          {/* Global Search Bar */}
          <div className="relative mb-10 group z-20">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-[#D95D00] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Cari dokumentasi... (Tekan '/')"
              className="block w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-[#D95D00] shadow-sm transition-all focus:shadow-md"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Search Dropdown */}
            <AnimatePresence>
              {searchQuery && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden z-50 max-h-[60vh] overflow-y-auto"
                >
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">Tidak ada hasil untuk "{searchQuery}"</div>
                  ) : (
                    <div className="py-2">
                      {searchResults.map((result, idx) => (
                        <button
                          key={`${result.section.id}-${result.content.id}-${idx}`}
                          onClick={() => scrollToId(result.content.id)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 last:border-0 dark:border-slate-700/50"
                        >
                          <div className="text-xs font-semibold text-[#D95D00] mb-0.5 flex items-center gap-1">
                            {result.section.title} <ChevronRight className="w-3 h-3" /> {result.content.subtitle}
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                            {result.content.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Intro Section */}
          <div className="mb-12">
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Dokumentasi
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              Panduan lengkap menggunakan platform HireGood untuk proses rekrutmen yang lebih efisien dan terintegrasi dengan AI Integrity Assessment.
            </p>
          </div>

          {/* Quick Start Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
            <div
              onClick={() => scrollToId('create-job')}
              className="group p-6 bg-gradient-to-br from-orange-50 to-white dark:from-slate-800 dark:to-slate-800/50 rounded-2xl border border-orange-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all hover:bg-white"
            >
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-[#D95D00] rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Lightbulb className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2 group-hover:text-[#D95D00] transition-colors">Mulai Merekrut</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pelajari cara membuat lowongan pertama Anda dan mengundang kandidat.</p>
            </div>

            <div
              onClick={() => scrollToId('how-it-works')}
              className="group p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">Memahami Skor AI</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pelajari bagaimana AI Integrity Assessment menganalisis risiko kandidat.</p>
            </div>
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-slate-800 mb-12"></div>

          {/* Sections Renderer */}
          <div className="space-y-24">
            {DOCUMENTATION_DATA.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                    {section.icon}
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {section.title}
                  </h2>
                </div>

                <div className="space-y-16 border-l border-slate-200 dark:border-slate-800 pl-8 ml-4">
                  {section.content.map((content) => (
                    <div key={content.id} id={content.id} className="scroll-mt-28 relative group">
                      {/* Anchor Link Hover */}
                      <div className="absolute -left-[42px] top-1 hidden lg:flex items-center justify-center w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => scrollToId(content.id)}>
                        <Hash className="w-3 h-3 text-slate-400" />
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                        {content.subtitle}
                      </h3>

                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                        {content.description}
                      </p>

                      {/* Steps */}
                      {content.steps && (
                        <div className="mb-6">
                          <ol className="space-y-4">
                            {content.steps.map((step, idx) => (
                              <li key={idx} className="flex gap-4">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 font-mono">
                                  {idx + 1}
                                </div>
                                <span className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed pt-0.5">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Tips */}
                      {content.tips && (
                        <div className="my-6 p-4 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                          <div className="flex gap-3">
                            <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2">
                              {content.tips.map((tip, idx) => (
                                <p key={idx} className="text-sm text-blue-900 dark:text-blue-300 leading-relaxed">
                                  {tip}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {content.warnings && (
                        <div className="my-6 p-4 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30">
                          <div className="flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2">
                              {content.warnings.map((warn, idx) => (
                                <p key={idx} className="text-sm text-amber-900 dark:text-amber-300 leading-relaxed">
                                  {warn}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

        </div>
      </main>

      {/* Right Sidebar (TOC) */}
      <aside className="hidden xl:block w-64 p-8 sticky top-8 h-[calc(100vh-2rem)] overflow-y-auto">
        <h5 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
          On This Page
        </h5>
        <div className="space-y-1 relative border-l border-slate-200 dark:border-slate-800">
          {DOCUMENTATION_DATA.map((section) => (
            <div key={section.id}>
              <button
                onClick={() => scrollToId(section.id)}
                className={cn(
                  "block w-full text-left px-4 py-1.5 text-xs transition-colors border-l -ml-px",
                  activeSection === section.id
                    ? "text-[#D95D00] font-medium border-[#D95D00]"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-transparent"
                )}
              >
                {section.title}
              </button>
              {/* Active Section Sub-items */}
              {activeSection === section.id && (
                <div className="space-y-1">
                  {section.content.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => scrollToId(sub.id)}
                      className={cn(
                        "block w-full text-left pl-8 pr-2 py-1 text-[11px] transition-colors border-l -ml-px",
                        activeSubSection === sub.id
                          ? "text-[#D95D00] font-medium border-[#D95D00]"
                          : "text-slate-400 hover:text-slate-600 dark:text-slate-500 border-transparent"
                      )}
                    >
                      {sub.subtitle}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
          <a href="mailto:support@hiregood.one" className="flex items-center text-xs text-slate-500 hover:text-[#D95D00] transition-colors gap-2">
            <ExternalLink className="w-3 h-3" />
            Butuh bantuan?
          </a>
        </div>
      </aside>
    </div>
  );
}
