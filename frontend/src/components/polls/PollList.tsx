import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';
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
  const [votingPoll, setVotingPoll] = useState<Poll | null>(null);

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

  const handleDeletePoll = async (pollId: string) => {
    if (!window.confirm('Are you sure you want to delete this poll?')) return;
    
    setDeletingPoll(pollId);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/polls/${pollId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolls(polls.filter(poll => poll._id !== pollId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete poll');
    } finally {
      setDeletingPoll(null);
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
    setVotingPoll(null);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Content Polls</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Vote on upcoming content and topics
          </p>
        </div>
        {isInstructor && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Vote className="w-4 h-4" />
            Create Poll
          </button>
        )}
      </div>

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
      ) : (
        <div className="grid gap-6">
          {polls.map((poll) => {
            const status = getPollStatus(poll);
            const winningOptions = getWinningOptions(poll);
            const canSeeResults = (poll.resultsVisible || status.status === 'expired' || isInstructor) && (poll.hasVoted || isInstructor);
            
            return (
              <div key={poll._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                {/* Poll Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          {poll.title}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800 dark:bg-${status.color}-900 dark:text-${status.color}-200`}>
                          {status.text}
                        </span>
                        {poll.hasVoted && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Voted
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {poll.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Ends: {formatDate(poll.endDate)}
                        </div>
                                                 <div className="flex items-center gap-1">
                           <Users className="w-4 h-4" />
                           {poll.totalVotes || 0} votes
                         </div>
                        <div className="flex items-center gap-1">
                          <Vote className="w-4 h-4" />
                          {poll.options.length} options
                        </div>
                      </div>
                    </div>
                    
                    {isInstructor && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleResults(poll._id, poll.resultsVisible)}
                          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          title={poll.resultsVisible ? 'Hide results' : 'Show results'}
                        >
                          {poll.resultsVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingPoll(poll)}
                          className="p-2 text-blue-500 hover:text-blue-700 transition-colors"
                          title="Edit poll"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePoll(poll._id)}
                          disabled={deletingPoll === poll._id}
                          className="p-2 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                          title="Delete poll"
                        >
                          {deletingPoll === poll._id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                                 {/* Poll Options */}
                 <div className="p-6">
                   {/* Show voting interface for students if poll is active and they haven't voted */}
                   {!isInstructor && status.status === 'active' && !poll.hasVoted && (
                     <PollVote poll={poll} onVoteSuccess={handleVoteSuccess} />
                   )}
                   
                   {/* Show results for everyone */}
                   {!isInstructor && !poll.hasVoted && status.status === 'active' && (
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
                   
                   <div className="space-y-3">
                     {poll.options.map((option, index) => {
                       const votePercentage = poll.totalVotes && poll.totalVotes > 0 
                         ? ((option.votes || 0) / poll.totalVotes) * 100 
                         : 0;
                       const isWinning = winningOptions.some(winning => winning.index === index);
                       const isSelected = poll.studentVote?.selectedOptions?.includes(index);
                       
                       return (
                         <div key={index} className="relative">
                           <div className={`flex items-center justify-between p-3 rounded-lg border ${
                             isSelected 
                               ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                               : 'border-gray-200 dark:border-gray-600'
                           }`}>
                             <div className="flex items-center gap-3 flex-1">
                               <div className={`w-4 h-4 rounded-full border-2 ${
                                 isSelected 
                                   ? 'border-blue-500 bg-blue-500' 
                                   : 'border-gray-300 dark:border-gray-500'
                               }`}>
                                 {isSelected && (
                                   <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                                 )}
                               </div>
                               <span className="text-gray-900 dark:text-gray-100">
                                 {option.text}
                               </span>
                               {isWinning && canSeeResults && (
                                 <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                                   🏆 Winner
                                 </span>
                               )}
                             </div>
                             
                             {canSeeResults && (
                               <div className="flex items-center gap-2">
                                 <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                   <div 
                                     className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                     style={{ width: `${votePercentage}%` }}
                                   ></div>
                                 </div>
                                 <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem] text-right">
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
                 </div>
              </div>
            );
          })}
        </div>
      )}

             {/* Create/Edit Poll Modal */}
       {showCreateModal && (
         <PollForm
           courseId={courseId}
           onClose={() => setShowCreateModal(false)}
           onSuccess={() => {
             fetchPolls();
             setShowCreateModal(false);
           }}
         />
       )}

       {editingPoll && (
         <PollForm
           courseId={courseId}
           poll={editingPoll}
           onClose={() => setEditingPoll(null)}
           onSuccess={() => {
             fetchPolls();
             setEditingPoll(null);
           }}
         />
       )}
     </div>
   );
 };

export default PollList; 