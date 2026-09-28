import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import questionBankService from '../../services/questionBank.service';
import { Search, Filter, CheckSquare, Square, Layers, BookOpen } from 'lucide-react';

const QuestionBankPickerModal = ({ isOpen, onClose, onSelectQuestions }) => {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedBloom, setSelectedBloom] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

  const [categories, setCategories] = useState([]);
  const [selectedMap, setSelectedMap] = useState({});

  const loadCategories = async () => {
    try {
      const res = await questionBankService.getCategories();
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch {
      // ignore
    }
  };

  const loadQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedDifficulty !== 'All') params.difficulty = selectedDifficulty;
      if (selectedBloom !== 'All') params.bloomLevel = selectedBloom;
      if (selectedType !== 'All') params.type = selectedType;

      const res = await questionBankService.getQuestions(params);
      const list = res.data || res.questions || [];
      setQuestions(list);
    } catch (err) {
      setError(err.message || 'Failed to load question bank items.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedDifficulty, selectedBloom, selectedType]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadQuestions();
      setSelectedMap({});
    }
  }, [isOpen, loadQuestions]);

  const toggleSelect = (q) => {
    setSelectedMap((prev) => {
      const copy = { ...prev };
      if (copy[q._id]) {
        delete copy[q._id];
      } else {
        copy[q._id] = q;
      }
      return copy;
    });
  };

  const toggleSelectAll = () => {
    if (Object.keys(selectedMap).length === questions.length) {
      setSelectedMap({});
    } else {
      const map = {};
      questions.forEach((q) => {
        map[q._id] = q;
      });
      setSelectedMap(map);
    }
  };

  const handleConfirm = () => {
    const selectedList = Object.values(selectedMap).map((bq) => ({
      questionText: bq.questionText,
      type: bq.type,
      options: bq.options || [],
      correctAnswer: bq.correctAnswer || '',
      explanation: bq.explanation || '',
      points: bq.points || 5,
      difficulty: bq.difficulty,
      bloomLevel: bq.bloomLevel,
      tags: bq.tags || [],
      // Embedded Question Bank Versioning Snapshot
      bankQuestionId: bq._id,
      questionBankId: bq.questionBankId,
      questionBankVersion: bq.version || 1,
    }));

    onSelectQuestions(selectedList);
    onClose();
  };

  const selectedCount = Object.keys(selectedMap).length;

  const getBloomBadgeColor = (level) => {
    switch (level) {
      case 'CREATE': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'EVALUATE': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'ANALYZE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'APPLY': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'UNDERSTAND': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REMEMBER':
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Questions from Question Bank"
      size="xl"
    >
      <div className="space-y-4">
        {/* Filter Toolbar */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search questions by keyword or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="All">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="All">All Types</option>
                <option value="mcq">MCQ</option>
                <option value="short_answer">Short Answer</option>
                <option value="long_answer">Long Answer</option>
                <option value="file_upload">File Upload</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Bloom Level</label>
              <select
                value={selectedBloom}
                onChange={(e) => setSelectedBloom(e.target.value)}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="All">All Bloom Levels</option>
                <option value="REMEMBER">REMEMBER</option>
                <option value="UNDERSTAND">UNDERSTAND</option>
                <option value="APPLY">APPLY</option>
                <option value="ANALYZE">ANALYZE</option>
                <option value="EVALUATE">EVALUATE</option>
                <option value="CREATE">CREATE</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full p-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="All">All Difficulties</option>
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between px-1 text-sm text-slate-600">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={questions.length === 0}
            className="flex items-center space-x-1.5 font-medium hover:text-primary-600 disabled:opacity-50"
          >
            {selectedCount > 0 && selectedCount === questions.length ? (
              <CheckSquare className="w-4 h-4 text-primary-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Select All ({questions.length})</span>
          </button>

          <span className="font-semibold text-primary-700">
            {selectedCount} Selected
          </span>
        </div>

        {/* Questions List */}
        <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded text-sm">{error}</div>
          ) : questions.length === 0 ? (
            <EmptyState
              title="No Questions Found"
              description="Try adjusting your search criteria or create new questions in your Question Bank."
            />
          ) : (
            questions.map((q) => {
              const isSelected = Boolean(selectedMap[q._id]);
              return (
                <div
                  key={q._id}
                  onClick={() => toggleSelect(q)}
                  className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{q.questionText}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                            {q.type?.replace('_', ' ')}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getBloomBadgeColor(q.bloomLevel)}`}>
                            {q.bloomLevel}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            {q.difficulty}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {q.points} pts
                          </span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono">
                            v{q.version || 1}
                          </span>
                          <span className="text-xs text-slate-500">
                            {q.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            Import {selectedCount} Question{selectedCount === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default QuestionBankPickerModal;
