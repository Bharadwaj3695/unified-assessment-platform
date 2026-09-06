import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { instructorService } from '../../services/instructor.service';
import Badge from '../ui/Badge';
import {
  Search,
  X,
  BookOpen,
  Users,
  FileCheck2,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const InstructorSearchBar = ({ onSelectAssessment, placeholder = 'Search assessments, students, or submissions...' }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ assessments: [], students: [], submissions: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults({ assessments: [], students: [], submissions: [] });
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await instructorService.searchWorkspace(query);
        setResults(res);
        setIsOpen(true);
      } catch (err) {
        console.error('Workspace search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalResultsCount =
    (results.assessments?.length || 0) +
    (results.students?.length || 0) +
    (results.submissions?.length || 0);

  const handleClear = () => {
    setQuery('');
    setResults({ assessments: [], students: [], submissions: [] });
    setIsOpen(false);
  };

  const handleSelectAssessment = (asmt) => {
    setIsOpen(false);
    if (onSelectAssessment) {
      onSelectAssessment(asmt);
    } else {
      navigate(`/instructor/edit/${asmt._id || asmt.id}`);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Live Dropdown Results Panel */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-surface-dark rounded-2xl border border-surface-light-border dark:border-surface-dark-border shadow-2xl z-50 overflow-hidden max-h-[480px] flex flex-col animate-in fade-in-50 slide-in-from-top-1 duration-150">
          {/* Header Tabs */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-light-border dark:border-surface-dark-border bg-slate-50/70 dark:bg-surface-dark-muted/50">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'all'
                    ? 'bg-brand-primary text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                All ({totalResultsCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('assessments')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'assessments'
                    ? 'bg-brand-primary text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Assessments ({results.assessments?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'students'
                    ? 'bg-brand-primary text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Students ({results.students?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('submissions')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'submissions'
                    ? 'bg-brand-primary text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Submissions ({results.submissions?.length || 0})
              </button>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">Press Esc to exit</span>
          </div>

          {/* Results Body */}
          <div className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-brand-primary" />
                Searching workspace catalog...
              </div>
            ) : totalResultsCount === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No matching results found for "{query}"
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Try searching with a different course title, category, or student email.
                </p>
              </div>
            ) : (
              <>
                {/* Assessments Section */}
                {(activeTab === 'all' || activeTab === 'assessments') &&
                  results.assessments?.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center">
                        <BookOpen className="w-3.5 h-3.5 mr-1.5 text-brand-primary" />
                        Assessments
                      </div>
                      <div className="mt-1 space-y-1">
                        {results.assessments.map((asmt) => (
                          <div
                            key={asmt._id || asmt.id}
                            onClick={() => handleSelectAssessment(asmt)}
                            className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-brand-primary flex items-center justify-center flex-shrink-0">
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-primary transition-colors">
                                  {asmt.title}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {asmt.category || 'General'} · {asmt.durationMinutes} mins · {asmt.totalPoints || 100} pts
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Badge
                                variant={asmt.status === 'published' ? 'success' : 'warning'}
                                size="sm"
                              >
                                {asmt.status}
                              </Badge>
                              <Badge
                                variant={asmt.accessType === 'restricted' ? 'sage' : 'neutral'}
                                size="sm"
                              >
                                {asmt.accessType || 'public'}
                              </Badge>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-primary transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Students Section */}
                {(activeTab === 'all' || activeTab === 'students') &&
                  results.students?.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1.5 text-brand-sage" />
                        Students
                      </div>
                      <div className="mt-1 space-y-1">
                        {results.students.map((student) => (
                          <div
                            key={student._id || student.id}
                            onClick={() => {
                              setIsOpen(false);
                              navigate('/instructor/students');
                            }}
                            className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {student.name?.charAt(0) || 'S'}
                              </div>
                              <div className="truncate">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-primary transition-colors">
                                  {student.name}
                                </div>
                                <div className="text-xs text-slate-400 truncate">{student.email}</div>
                              </div>
                            </div>
                            <Badge variant="secondary" size="sm">
                              {student.submissions?.length || 0} Attempts
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Submissions Section */}
                {(activeTab === 'all' || activeTab === 'submissions') &&
                  results.submissions?.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center">
                        <FileCheck2 className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                        Submissions
                      </div>
                      <div className="mt-1 space-y-1">
                        {results.submissions.map((sub) => (
                          <div
                            key={sub._id || sub.id}
                            onClick={() => {
                              setIsOpen(false);
                              navigate('/instructor/submissions');
                            }}
                            className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center flex-shrink-0">
                                <FileCheck2 className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-primary transition-colors">
                                  {sub.student?.name || 'Student'} — {sub.assessment?.title || 'Assessment'}
                                </div>
                                <div className="text-xs text-slate-400">
                                  Score: {sub.score !== undefined ? sub.score : 'Pending'} / {sub.totalPoints || 100} · Status: {sub.status}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant={sub.status === 'evaluated' ? 'success' : 'warning'}
                              size="sm"
                            >
                              {sub.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorSearchBar;
