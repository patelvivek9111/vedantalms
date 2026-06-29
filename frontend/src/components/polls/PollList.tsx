import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Vote, 
  Calendar, 
  Users, 
  BarChart3, 
  Edit, 
  Trash2, 
  Eye,
  EyeOff,
  CheckCircle,
  Clock
} from 'lucide-react';
import PollForm from './PollForm';
import PollVote from './PollVote';
import ConfirmationModal from '../common/ConfirmationModal';
import { SectionDividerHeading } from '../common/SectionDividerHeading';

interface Poll {
  _id: string;
  title: string;
  description: string;
  options: Array<{
    text: string;
    votes: number;
  }>;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  endDate: string;
  isActive: boolean;
  resultsVisible: boolean;
  allowMultipleVotes: boolean;
  hasVoted?: boolean;
  studentVote?: {
    selectedOptions: number[];
  };
  totalVotes?: number;
  isExpired?: boolean;
}

interface PollListProps {
  courseId: string;
}

const PollList: React.FC<PollListProps> = ({ courseId }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [deletingPoll, setDeletingPoll] = useState<string | null>(null);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<string | null>(null);
  const [closingPoll, setClosingPoll] = useState<string | null>(null);

  const isInstructor = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    fetchPolls();
  }, [courseId]);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/polls/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolls(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch polls');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePoll = (pollId: string) => {
    setPollToDelete(pollId);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePoll = async () => {
    if (!pollToDelete) return;
    setShowDeleteConfirm(false);
    setDeletingPoll(pollToDelete);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/polls/${pollToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolls(polls.filter(poll => poll._id !== pollToDelete));
      setPollToDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete poll');
    } finally {
      setDeletingPoll(null);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    try {
      setClosingPoll(pollId);
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/polls/${pollId}`, { isActive: false }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolls(polls.map(poll =>
        poll._id === pollId ? { ...poll, isActive: false } : poll
      ));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to close poll');
    } finally {
      setClosingPoll(null);
    }
  };

  const handleToggleResults = async (pollId: string, currentVisible: boolean) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/polls/${pollId}`, {
        resultsVisible: !currentVisible
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolls(polls.map(poll => 
        poll._id === pollId 
          ? { ...poll, resultsVisible: !currentVisible }
          : poll
      ));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update poll');
    }
  };

  const handleVoteSuccess = () => {
    fetchPolls();
    setSelectedPollId(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPollStatus = (poll: Poll) => {
    const now = new Date();
    const endDate = new Date(poll.endDate);
    
    // First check if manually inactive
    if (!poll.isActive) {
      return { status: 'inactive', text: 'Inactive', color: 'gray' };
    }
    
    // Then check if expired (regardless of isActive setting)
    if (now > endDate) {
      return { status: 'expired', text: 'Expired', color: 'red' };
    }
    
    return { status: 'active', text: 'Active', color: 'green' };
  };

  const getWinningOptions = (poll: Poll) => {
    if (!poll.options || poll.options.length === 0) return [];
    
    const maxVotes = Math.max(...poll.options.map(option => option.votes || 0));
    return poll.options
      .map((option, index) => ({ ...option, index }))
      .filter(option => (option.votes || 0) === maxVotes && maxVotes > 0);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {isInstructor && !showCreateModal && !editingPoll && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">Create and manage polls for this course</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            + Create Poll
          </button>
        </div>
      )}

      {showCreateModal ? (
        <PollForm
          courseId={courseId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchPolls();
            setShowCreateModal(false);
          }}
        />
      ) : editingPoll ? (
        <PollForm
          courseId={courseId}
          poll={editingPoll}
          onClose={() => setEditingPoll(null)}
          onSuccess={() => {
            fetchPolls();
            setEditingPoll(null);
          }}
        />
      ) : (
        <>

          {/* Polls List */}
          {polls.length === 0 ? (
        <div className="text-center py-12">
          <Vote className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No polls yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isInstructor 
              ? 'Create your first poll to get student feedback on content'
              : 'No polls are currently available for voting'
            }
          </p>
        </div>
      ) : selectedPollId ? (
        (() => {
          const selectedPoll = polls.find((poll) => poll._id === selectedPollId);
          if (!selectedPoll) {
            return null;
          }
          const status = getPollStatus(selectedPoll);
          const winningOptions = getWinningOptions(selectedPoll);
          const canSeeResults =
            (selectedPoll.resultsVisible || status.status === 'expired' || isInstructor) &&
            (selectedPoll.hasVoted || isInstructor);

          return (
            <div className="space-y-3">
              <button
                onClick={() => setSelectedPollId(null)}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                ← Back to polls
              </button>
              <div className="overflow-hidden rounded-xl bg-white ring-1 ring-gray-200/70 dark:bg-gray-900 dark:ring-gray-700/60">
                {/* Poll Header */}
                <div className="border-b border-gray-100 p-4 dark:border-gray-800 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 sm:gap-0">
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 break-words flex-1 min-w-0">
                          {selectedPoll.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800 dark:bg-${status.color}-900 dark:text-${status.color}-200`}>
                            {status.text}
                          </span>
                          {selectedPoll.hasVoted && (
                            <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Voted
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedPoll.description && (
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3">
                          {selectedPoll.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="whitespace-nowrap">Ends: {formatDate(selectedPoll.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>{selectedPoll.totalVotes || 0} votes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Vote className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>{selectedPoll.options.length} opt</span>
                        </div>
                      </div>
                    </div>
                    
                    {isInstructor && (
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleToggleResults(selectedPoll._id, selectedPoll.resultsVisible)}
                          className="p-2 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          title={selectedPoll.resultsVisible ? 'Hide results' : 'Show results'}
                          aria-label={selectedPoll.resultsVisible ? 'Hide poll results' : 'Show poll results'}
                        >
                          {selectedPoll.resultsVisible ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />}
                        </button>
                        {selectedPoll.isActive && (
                          <button
                            onClick={() => handleClosePoll(selectedPoll._id)}
                            disabled={closingPoll === selectedPoll._id}
                            className="p-2 sm:p-2 text-amber-500 hover:text-amber-700 transition-colors disabled:opacity-50"
                            title="Close poll"
                            aria-label={`Close poll: ${selectedPoll.title}`}
                          >
                            {closingPoll === selectedPoll._id ? (
                              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-amber-500"></div>
                            ) : (
                              <Clock className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingPoll(selectedPoll)}
                          className="p-2 sm:p-2 text-blue-500 hover:text-blue-700 transition-colors"
                          title="Edit poll"
                          aria-label={`Edit poll: ${selectedPoll.title}`}
                        >
                          <Edit className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDeletePoll(selectedPoll._id)}
                          disabled={deletingPoll === selectedPoll._id}
                          className="p-2 sm:p-2 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                          title="Delete poll"
                          aria-label={`Delete poll: ${selectedPoll.title}`}
                        >
                          {deletingPoll === selectedPoll._id ? (
                            <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-red-500"></div>
                          ) : (
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                                 {/* Poll Options */}
                 <div className="p-4 sm:p-6">
                   {/* Show voting interface for students if poll is active and they haven't voted */}
                   {!isInstructor && status.status === 'active' && !selectedPoll.hasVoted ? (
                     <PollVote poll={selectedPoll} onVoteSuccess={handleVoteSuccess} />
                   ) : (
                     <>
                       {/* Show results for everyone */}
                       {!isInstructor && !selectedPoll.hasVoted && status.status === 'active' && (
                         <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                           <div className="flex items-center gap-2">
                             <Vote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                             <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                               Vote to see results
                             </span>
                           </div>
                           <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                             Submit your vote to view the current poll results and see which option is winning.
                           </p>
                         </div>
                       )}
                       
                       <div className="space-y-2 sm:space-y-3">
                    {selectedPoll.options.map((option, index) => {
                      const votePercentage = selectedPoll.totalVotes && selectedPoll.totalVotes > 0 
                        ? ((option.votes || 0) / selectedPoll.totalVotes) * 100 
                         : 0;
                       const isWinning = winningOptions.some(winning => winning.index === index);
                      const isSelected = selectedPoll.studentVote?.selectedOptions?.includes(index);
                       
                       return (
                         <div key={index} className="relative">
                           <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border gap-2 sm:gap-0 ${
                             isSelected 
                               ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                               : 'border-gray-200 dark:border-gray-600'
                           }`}>
                             <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                               <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex-shrink-0 ${
                                 isSelected 
                                   ? 'border-blue-500 bg-blue-500' 
                                   : 'border-gray-300 dark:border-gray-500'
                               }`}>
                                 {isSelected && (
                                   <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                                 )}
                               </div>
                               <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-2 flex-wrap">
                                   <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words">
                                     {option.text}
                                   </span>
                                   {isWinning && canSeeResults && (
                                     <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                                       🏆 Winner
                                     </span>
                                   )}
                                 </div>
                               </div>
                             </div>
                             
                             {canSeeResults && (
                               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                                 <div className="w-full sm:w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 sm:h-2">
                                   <div 
                                     className="bg-blue-500 h-2.5 sm:h-2 rounded-full transition-all duration-300"
                                     style={{ width: `${votePercentage}%` }}
                                   ></div>
                                 </div>
                                 <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-left sm:text-right whitespace-nowrap">
                                   {option.votes || 0} ({votePercentage.toFixed(1)}%)
                                 </span>
                               </div>
                             )}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                   
                   {/* Results Summary */}
                   {canSeeResults && winningOptions.length > 0 && (
                     <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                       <div className="flex items-center gap-2">
                         <BarChart3 className="w-4 h-4 text-green-600 dark:text-green-400" />
                         <span className="font-medium text-green-800 dark:text-green-200">
                           Winning option{winningOptions.length > 1 ? 's' : ''}:
                         </span>
                       </div>
                       <div className="mt-2 space-y-1">
                         {winningOptions.map((option, index) => (
                           <div key={index} className="text-green-700 dark:text-green-300">
                             • {option.text}
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                     </>
                   )}
                 </div>
              </div>
            </div>
          );
        })()
      ) : (
        <section aria-labelledby="polls-heading">
          <SectionDividerHeading id="polls-heading">Polls</SectionDividerHeading>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200/70 dark:divide-gray-800 dark:bg-gray-900 dark:ring-gray-700/60">
          {polls.map((poll) => {
            const status = getPollStatus(poll);
            return (
              <button
                key={poll._id}
                onClick={() => setSelectedPollId(poll._id)}
                className="w-full px-4 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60 sm:px-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{poll.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Ends {formatDate(poll.endDate)}</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{poll.totalVotes || 0} votes</span>
                      <span className="inline-flex items-center gap-1"><Vote className="h-3.5 w-3.5" />{poll.options.length} options</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    status.color === 'green'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : status.color === 'red'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {status.text}
                  </span>
                </div>
              </button>
            );
          })}
          </div>
        </section>
      )}
        </>
      )}

      {/* Delete Poll Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPollToDelete(null);
        }}
        onConfirm={confirmDeletePoll}
        title="Delete Poll"
        message="Are you sure you want to delete this poll? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={!!deletingPoll}
      />
     </div>
   );
 };

export default PollList; 