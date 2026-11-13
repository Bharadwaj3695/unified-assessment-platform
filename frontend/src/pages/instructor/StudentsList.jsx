import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { instructorService } from '../../services/instructor.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import TableSkeleton from '../../components/ui/TableSkeleton';
import { useRefresh } from '../../hooks/useRefresh';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import {
  X,
  FileCheck2,
  Mail,
  RefreshCw,
} from 'lucide-react';

const StudentsList = () => {
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search');
    if (q) setSearchTerm(q);
  }, [location.search]);

  const loadStudents = useCallback(async (isManual = false) => {
    try {
      if (!isManual) {
        setIsLoading(true);
      }
      setError(null);
      const res = await instructorService.getStudents();
      const list = Array.isArray(res) ? res : res.data || [];
      setStudents(list);
    } catch (err) {
      setError(err.message || 'Failed to retrieve student directory.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { isRefreshing, refresh: handleRefresh } = useRefresh(
    () => loadStudents(true),
    { successMessage: 'Student directory refreshed!' }
  );

  useEffect(() => {
    loadStudents(false).catch(() => {});
  }, [loadStudents]);

  const filteredStudents = students.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.email?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Badge variant="sage" size="sm" dot>
              Student Directory
            </Badge>
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">· Enrolled Cohorts</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB]">
            Active Students
          </h1>
          <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">
            Overview of registered students eligible for restricted assessment assignment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={RefreshCw}
            iconClassName={isRefreshing ? 'animate-spin' : ''}
            onClick={handleRefresh}
            isLoading={isRefreshing}
            loadingText="Refreshing..."
            title="Refresh student directory"
            aria-label={isRefreshing ? 'Refreshing student directory' : 'Refresh student directory'}
          >
            Refresh
          </Button>

          {searchTerm && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FDECE2] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] border border-[#E05D38]/30">
              <span>Filter: &ldquo;{searchTerm}&rdquo;</span>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="hover:text-red-600 transition-colors cursor-pointer ml-1"
                title="Clear search filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : error ? (
          <ErrorState
            title="Failed to Load Students"
            message={error}
            onRetry={loadStudents}
          />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="No students found"
            description={
              searchTerm
                ? `No students match your query "${searchTerm}".`
                : 'There are currently no active students registered on the platform.'
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Student Name</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Submissions</TableHeader>
                <TableHeader>Enrolled Since</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStudents.map((s) => {
                const sId = s._id || s.id;
                const submissionCount = s.submissions?.length || 0;

                return (
                  <TableRow key={sId}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-[#FDECE2] dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261] border border-[#F4A261]/30 font-bold text-xs flex items-center justify-center">
                          {s.name?.charAt(0) || 'S'}
                        </div>
                        <span className="font-semibold text-[#1F2937] dark:text-[#F9FAFB]">
                          {s.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      <div className="flex items-center space-x-1">
                        <Mail className="w-3.5 h-3.5 text-[#64748B] mr-1" />
                        {s.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="sage" size="sm" dot>
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[#1F2937] dark:text-[#F9FAFB]">
                      <div className="flex items-center space-x-1">
                        <FileCheck2 className="w-3.5 h-3.5 text-[#3D8A78] mr-1" />
                        {submissionCount} Completed Attempts
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default StudentsList;
