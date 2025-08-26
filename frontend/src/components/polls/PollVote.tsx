import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { Vote, CheckCircle, AlertCircle } from 'lucide-react';

interface PollVoteProps {
  poll: {
    _id: string;
    title: string;
    description: string;
    options: Array<{
      text: string;
      votes: number;
    }>;
    allowMultipleVotes: boolean;
    hasVoted?: boolean;
    studentVote?: {
      selectedOptions: number[];
    };
  };
  onVoteSuccess: () => void;
}

const PollVote: React.FC<PollVoteProps> = ({ poll, onVoteSuccess }) => {
  const [selectedOptions, setSelectedOptions] = useState<number[]>(
    poll.studentVote?.selectedOptions || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleOptionToggle = (optionIndex: number) => {
    if (poll.hasVoted) return; // Prevent changes if already voted

    setSelectedOptions(prev => {
      if (poll.allowMultipleVotes) {
        // For multiple votes, toggle the option
        return prev.includes(optionIndex)
          ? prev.filter(index => index !== optionIndex)
          : [...prev, optionIndex];
      } else {
        // For single vote, replace the selection
        return [optionIndex];
      }
    });
  };

  const handleSubmitVote = async () => {
    if (poll.hasVoted) return;

    if (selectedOptions.length === 0) {
      setError('Please select at least one option');
      return;
    }

    if (!poll.allowMultipleVotes && selectedOptions.length > 1) {
      setError('You can only select one option for this poll');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/polls/${poll._id}/vote`, {
        selectedOptions
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(true);
      setTimeout(() => {
        onVoteSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit vote');
    } finally {
      setLoading(false);
    }
  };

  if (poll.hasVoted) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-800 dark:text-green-200">
            You have already voted on this poll
          </span>
        </div>
        {poll.studentVote && (
          <div className="mt-2 text-sm text-green-700 dark:text-green-300">
            Your selection: {poll.studentVote.selectedOptions.map(index => poll.options[index].text).join(', ')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">
              Vote submitted successfully!
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {poll.options.map((option, index) => {
          const isSelected = selectedOptions.includes(index);
          
          return (
            <div key={index} className="relative">
              <button
                type="button"
                onClick={() => handleOptionToggle(index)}
                disabled={poll.hasVoted || loading}
                className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                } ${poll.hasVoted || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-gray-500'
                  }`}>
                    {isSelected && (
                      <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {option.text}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {poll.allowMultipleVotes ? (
            <span>Select one or more options</span>
          ) : (
            <span>Select one option</span>
          )}
        </div>
        
        <button
          onClick={handleSubmitVote}
          disabled={loading || selectedOptions.length === 0 || poll.hasVoted}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Submitting...
            </>
          ) : (
            <>
              <Vote className="w-4 h-4" />
              Submit Vote
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PollVote; 