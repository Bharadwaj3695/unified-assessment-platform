import React, { useState, useEffect, useCallback } from 'react';
import { instructorService } from '../../services/instructor.service';
import InstructorSearchBar from '../../components/instructor/InstructorSearchBar';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import {
  Users,
  Search,
  CheckCircle2,
  Calendar,
  FileCheck2,
  Mail,
  UserCheck,
} from 'lucide-react';

const StudentsList = () => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await instructorService.getStudents();
      const list = Array.isArray(res) ? res : res.data || [];
      setStudents(list);
    } catch (err) {
      setError(err.message || 'Failed to retrieve student directory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
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
      {/* Prominent Workspace Search Bar */}
      <div className="rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] p-4 sm:p-5 shadow-warm-xs">
        <InstructorSearchBar placeholder="Search student directory, course assessments, or submissions..." />
      </div>

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

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] placeholder-[#64748B]/60 focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20 transition-all"
          />
        </div>
      </div>

      {/* Directory Table */}
      <Card>
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <Spinner size="md" />
            <p className="mt-3 text-xs text-[#64748B]">Loading student roster...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 text-sm">
            {error}
          </div>
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
