import React, { useState, useEffect, useMemo } from 'react';
import { instructorService } from '../../services/instructor.service';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Alert from '../ui/Alert';
import {
  Search,
  X,
  Check,
  UserCheck,
  Users,
  AlertCircle,
  Plus,
} from 'lucide-react';

const StudentSelector = ({ value = [], onChange, error }) => {
  const [allStudents, setAllStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadStudents = async () => {
      try {
        setIsLoading(true);
        const res = await instructorService.getStudents();
        const list = Array.isArray(res) ? res : res.data || [];
        if (mounted) {
          setAllStudents(list);
          setFetchError(null);
        }
      } catch (err) {
        if (mounted) {
          setFetchError(err.message || 'Failed to load active student directory.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    loadStudents();
    return () => {
      mounted = false;
    };
  }, []);

  // Standardize selected IDs as string array
  const selectedIds = useMemo(() => {
    return (value || []).map((item) => (item?._id || item?.id || item).toString());
  }, [value]);

  // Lookup map for fast student retrieval
  const studentMap = useMemo(() => {
    const map = new Map();
    allStudents.forEach((s) => {
      const id = (s._id || s.id).toString();
      map.set(id, s);
    });
    return map;
  }, [allStudents]);

  // Filter available students by search
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return allStudents;
    const term = searchTerm.toLowerCase().trim();
    return allStudents.filter(
      (s) =>
        s.name?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term)
    );
  }, [allStudents, searchTerm]);

  const toggleStudent = (studentId) => {
    const idStr = studentId.toString();
    let updated;
    if (selectedIds.includes(idStr)) {
      updated = selectedIds.filter((id) => id !== idStr);
    } else {
      updated = [...selectedIds, idStr];
    }
    onChange(updated);
  };

  const removeStudent = (studentId) => {
    const idStr = studentId.toString();
    const updated = selectedIds.filter((id) => id !== idStr);
    onChange(updated);
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map((s) => (s._id || s.id).toString());
    const combined = [...new Set([...selectedIds, ...filteredIds])];
    onChange(combined);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-surface-dark-muted/20 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-brand-sage" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Designated Student Roster
          </h4>
          <Badge variant="sage" size="sm">
            {selectedIds.length} Assigned
          </Badge>
        </div>

        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 self-start sm:self-auto cursor-pointer"
          >
            Clear Selected ({selectedIds.length})
          </button>
        )}
      </div>

      {fetchError && (
        <Alert variant="error" title="Directory Sync Issue">
          {fetchError}
        </Alert>
      )}

      {/* Selected Student Chips */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-white dark:bg-surface-dark rounded-xl border border-surface-light-border dark:border-surface-dark-border">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Selected for Enrollment
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
            {selectedIds.map((id) => {
              const student = studentMap.get(id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-brand-sage-light/60 dark:bg-brand-sage-dark/40 text-brand-sage-dark dark:text-brand-sage-light border border-brand-sage/20"
                >
                  <span className="truncate max-w-[150px]">
                    {student ? student.name : id}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStudent(id)}
                    className="ml-1.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                    title={`Remove ${student?.name || 'student'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Student Search & Quick Select */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search students by name or email..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {filteredStudents.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAllFiltered}
            className="whitespace-nowrap text-xs"
          >
            Assign All Filtered ({filteredStudents.length})
          </Button>
        )}
      </div>

      {/* Available Students Checklist */}
      <div className="bg-white dark:bg-surface-dark rounded-xl border border-surface-light-border dark:border-surface-dark-border divide-y divide-slate-100 dark:divide-slate-800/60 max-h-56 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 flex items-center justify-center text-xs text-slate-500">
            <Spinner size="sm" className="mr-2" />
            Loading active students...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            {searchTerm
              ? `No active students match "${searchTerm}"`
              : 'No registered active students found.'}
          </div>
        ) : (
          filteredStudents.map((student) => {
            const id = (student._id || student.id).toString();
            const isSelected = selectedIds.includes(id);

            return (
              <div
                key={id}
                onClick={() => toggleStudent(id)}
                className={`flex items-center justify-between p-2.5 sm:px-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-brand-primary border-brand-primary text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-surface-dark'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {student.name?.charAt(0) || 'S'}
                  </div>

                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {student.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {student.email}
                    </div>
                  </div>
                </div>

                <Badge
                  variant={isSelected ? 'success' : 'neutral'}
                  size="sm"
                  className="text-[10px]"
                >
                  {isSelected ? 'Assigned' : 'Unassigned'}
                </Badge>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p className="text-xs font-medium text-red-500 flex items-center mt-1">
          <AlertCircle className="w-3.5 h-3.5 mr-1" />
          {error}
        </p>
      )}

      {selectedIds.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center">
          <AlertCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          Restricted assessments require at least 1 assigned student before publishing.
        </p>
      )}
    </div>
  );
};

export default StudentSelector;
