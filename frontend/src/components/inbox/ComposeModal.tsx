import React from 'react';
import { CheckSquare2, ChevronLeft, Paperclip } from 'lucide-react';
import { getImageUrl } from '../../services/api';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import type { NormalizedFile } from '../../utils/fileTypes';

export type ComposeModalProps = {
  open: boolean;
  onClose: () => void;
  user: { role?: string } | null;
  composeCourse: string;
  composeCourseOptions: { _id: string; title: string }[];
  setComposeCourse: (value: string) => void;
  composeRecipients: any[];
  composeToGroup: string;
  composeGroupUsers: any[];
  composeToInput: string;
  composeUserResults: any[];
  composeSubject: string;
  composeBody: string;
  composeAttachments: NormalizedFile[];
  sendIndividually: boolean;
  composeLoading: boolean;
  composeError: string | null;
  showGroupDropdown: boolean;
  composeToDropdownRef: React.RefObject<HTMLDivElement>;
  isUserOnline: (userId: string) => boolean;
  onSubmit: (e: React.FormEvent) => void;
  handleAddRecipient: (u: any) => void;
  handleRemoveRecipient: (id: string) => void;
  setComposeToGroup: (value: string) => void;
  setComposeGroupUsers: (users: any[]) => void;
  setComposeToInput: (value: string) => void;
  setComposeUserResults: (users: any[]) => void;
  setShowGroupDropdown: (value: boolean | ((prev: boolean) => boolean)) => void;
  setComposeSubject: (value: string) => void;
  setComposeBody: (value: string) => void;
  setComposeAttachments: (files: NormalizedFile[]) => void;
  setSendIndividually: (value: boolean) => void;
};

const ComposeModal: React.FC<ComposeModalProps> = ({
  open,
  onClose,
  user,
  composeCourse,
  composeCourseOptions,
  setComposeCourse,
  composeRecipients,
  composeToGroup,
  composeGroupUsers,
  composeToInput,
  composeUserResults,
  composeSubject,
  composeBody,
  composeAttachments,
  sendIndividually,
  composeLoading,
  composeError,
  showGroupDropdown,
  composeToDropdownRef,
  isUserOnline,
  onSubmit,
  handleAddRecipient,
  handleRemoveRecipient,
  setComposeToGroup,
  setComposeGroupUsers,
  setComposeToInput,
  setComposeUserResults,
  setShowGroupDropdown,
  setComposeSubject,
  setComposeBody,
  setComposeAttachments,
  setSendIndividually,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[100] p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-0 w-full max-w-xl relative border border-gray-200 dark:border-gray-700 max-h-[95vh] overflow-y-auto">
        <button
          className="absolute top-2 right-2 sm:top-3 sm:right-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl sm:text-2xl p-1 touch-manipulation"
          onClick={onClose}
        >
          &times;
        </button>
        <div className="border-b border-gray-200 dark:border-gray-700 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 lg:py-4 text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">
          Compose Message
        </div>
        <form onSubmit={onSubmit} className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          {/* Course Dropdown - Hide for admins */}
          {user?.role !== 'admin' && (
            <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
              <label htmlFor="compose-course" className="w-full sm:w-20 text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm">
                Course
              </label>
              <select
                id="compose-course"
                name="course"
                className="border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex-1"
                value={composeCourse}
                onChange={(e) => {
                  setComposeCourse(e.target.value);
                  setComposeToGroup('');
                  setComposeGroupUsers([]);
                }}
              >
                {composeCourseOptions.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* To Field with group selection */}
          <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center gap-2 relative" ref={composeToDropdownRef}>
            <span className="w-full sm:w-20 text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm">To</span>
            <div className="flex-1 relative">
              <div
                id="compose-to"
                className="flex items-center border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-gray-900 cursor-text"
              >
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {composeToGroup === 'sections' && user?.role !== 'admin' ? (
                    composeCourse ? (
                      <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs flex items-center">
                        All Students in {composeCourseOptions.find((c) => c._id === composeCourse)?.title || 'Course'}
                        <button
                          type="button"
                          className="ml-1 text-[10px] sm:text-xs text-red-500 dark:text-red-400 touch-manipulation"
                          onClick={(e) => {
                            e.stopPropagation();
                            setComposeToGroup('');
                            setComposeCourse('');
                          }}
                        >
                          &times;
                        </button>
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-[10px] sm:text-xs">Select a course...</span>
                    )
                  ) : (
                    composeRecipients.map((u) => (
                      <span
                        key={u._id}
                        className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs flex items-center gap-1"
                      >
                        <div className="relative flex-shrink-0">
                          {u.profilePicture ? (
                            <img
                              src={u.profilePicture.startsWith('http') ? u.profilePicture : getImageUrl(u.profilePicture)}
                              alt={`${u.firstName} ${u.lastName}`}
                              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-blue-300"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          {/* Fallback avatar with initials */}
                          <div
                            className={`w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-[8px] sm:text-[10px] font-bold ${
                              u.profilePicture ? 'hidden' : 'flex'
                            }`}
                            style={{
                              display: u.profilePicture ? 'none' : 'flex',
                            }}
                          >
                            {u.firstName?.charAt(0) || ''}
                            {u.lastName?.charAt(0) || ''}
                          </div>
                        </div>
                        <span className="truncate max-w-[80px] sm:max-w-none">
                          {u.firstName} {u.lastName}
                        </span>
                        {u.role && <span className="text-[8px] sm:text-[10px] opacity-75 hidden sm:inline">({u.role})</span>}
                        <button
                          type="button"
                          className="ml-0.5 text-[10px] sm:text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 touch-manipulation"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRecipient(u._id);
                          }}
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  )}
                  {/* Searchable input for To field */}
                  {composeToGroup !== 'sections' && (
                    <input
                      type="text"
                      id="compose-to-input"
                      name="composeToInput"
                      className="flex-1 min-w-24 outline-none border-none bg-transparent text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder={
                        composeRecipients.length === 0
                          ? user?.role === 'admin'
                            ? 'Type name or email to search users...'
                            : 'Type name or email...'
                          : ''
                      }
                      value={composeToInput}
                      onChange={(e) => {
                        setComposeToInput(e.target.value);
                        setShowGroupDropdown(false);
                      }}
                      onFocus={() => {
                        setShowGroupDropdown(false);
                      }}
                    />
                  )}
                </div>
                {/* Icon to open group dropdown */}
                <button
                  type="button"
                  className="ml-1 sm:ml-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 touch-manipulation flex-shrink-0"
                  tabIndex={-1}
                  aria-label="Choose group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGroupDropdown((v) => !v);
                  }}
                >
                  <CheckSquare2 size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
              {/* Group dropdown only when icon is clicked - Hide for admins or show modified options */}
              {showGroupDropdown && !composeToGroup && (
                <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20">
                  {user?.role === 'admin' ? (
                    <>
                      <div
                        className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          setComposeToGroup('teachers');
                          setShowGroupDropdown(false);
                        }}
                      >
                        All Teachers
                      </div>
                      <div
                        className="px-4 py-2 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          setComposeToGroup('students');
                          setShowGroupDropdown(false);
                        }}
                      >
                        All Students
                      </div>
                      <div
                        className="px-4 py-2 text-purple-600 dark:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          setComposeToGroup('admins');
                          setShowGroupDropdown(false);
                        }}
                      >
                        All Admins
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          setComposeToGroup('teachers');
                          setShowGroupDropdown(false);
                        }}
                      >
                        Teachers
                      </div>
                      <div
                        className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          setComposeToGroup('students');
                          setShowGroupDropdown(false);
                        }}
                      >
                        Students
                      </div>
                      <div
                        className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          setComposeToGroup('sections');
                          setShowGroupDropdown(false);
                          setComposeCourse('');
                        }}
                      >
                        Course Sections
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* User search results dropdown */}
              {composeToInput.length >= 2 && composeUserResults.length > 0 && (
                <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                  {composeUserResults.map((u: any) => (
                    <div
                      key={u._id}
                      className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer flex items-center gap-3"
                      onClick={() => {
                        handleAddRecipient(u);
                        setComposeToInput('');
                        setComposeUserResults([]);
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full overflow-hidden ${u.profilePicture ? '' : 'bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center'} ${isUserOnline(u._id) ? 'online-pulse' : 'border-2 border-transparent'}`}
                        >
                          {u.profilePicture ? (
                            <img
                              src={u.profilePicture.startsWith('http') ? u.profilePicture : getImageUrl(u.profilePicture)}
                              alt={`${u.firstName} ${u.lastName}`}
                              className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          {/* Fallback avatar with initials */}
                          <div
                            className={`w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                              u.profilePicture ? 'hidden' : 'flex'
                            }`}
                            style={{
                              display: u.profilePicture ? 'none' : 'flex',
                            }}
                          >
                            {u.firstName?.charAt(0) || ''}
                            {u.lastName?.charAt(0) || ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {u.email} {u.role && `• ${u.role}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Dropdown for users in group (for Teachers/Students/Admins) */}
              {composeToGroup && composeToGroup !== 'sections' && composeGroupUsers.length > 0 && !composeToInput && (
                <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                  <div
                    className="flex items-center px-2 py-2 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setComposeToGroup('')}
                  >
                    <ChevronLeft size={18} />
                    <span className="ml-2 text-gray-600 dark:text-gray-400 text-sm">Back</span>
                  </div>
                  {composeGroupUsers.map((u: any) => (
                    <div
                      key={u._id}
                      className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer flex items-center gap-3"
                      onClick={() => {
                        handleAddRecipient(u);
                        setComposeToGroup('');
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full overflow-hidden ${u.profilePicture ? '' : 'bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center'} ${isUserOnline(u._id) ? 'online-pulse' : 'border-2 border-transparent'}`}
                        >
                          {u.profilePicture ? (
                            <img
                              src={u.profilePicture.startsWith('http') ? u.profilePicture : getImageUrl(u.profilePicture)}
                              alt={`${u.firstName} ${u.lastName}`}
                              className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          {/* Fallback avatar with initials */}
                          <div
                            className={`w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                              u.profilePicture ? 'hidden' : 'flex'
                            }`}
                            style={{
                              display: u.profilePicture ? 'none' : 'flex',
                            }}
                          >
                            {u.firstName?.charAt(0) || ''}
                            {u.lastName?.charAt(0) || ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {u.email} {u.role && `• ${u.role}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Dropdown for course selection when Course Sections is selected - Hide for admins */}
              {user?.role !== 'admin' && composeToGroup === 'sections' && !composeCourse && (
                <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                  <div
                    className="flex items-center px-2 py-2 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setComposeToGroup('')}
                  >
                    <ChevronLeft size={18} />
                    <span className="ml-2 text-gray-600 dark:text-gray-400 text-sm">Back</span>
                  </div>
                  {composeCourseOptions.map((c: any) => (
                    <div
                      key={c._id}
                      className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer text-gray-900 dark:text-gray-100"
                      onClick={() => setComposeCourse(c._id)}
                    >
                      {c.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Subject */}
          <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
            <label htmlFor="compose-subject" className="w-full sm:w-20 text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm">
              Subject
            </label>
            <input
              id="compose-subject"
              name="subject"
              type="text"
              className="border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 flex-1"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              disabled={composeLoading}
            />
          </div>
          {/* Send individually checkbox */}
          <div className="mb-3 sm:mb-4 flex items-start sm:items-center gap-3 sm:gap-2">
            <input
              id="send-individually"
              name="sendIndividually"
              type="checkbox"
              className="mt-0.5 sm:mt-0 mr-0 sm:mr-2 w-4 h-4 touch-manipulation"
              checked={sendIndividually}
              onChange={(e) => setSendIndividually(e.target.checked)}
              disabled={composeLoading}
            />
            <label htmlFor="send-individually" className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm select-none">
              Send an individual message to each recipient
            </label>
          </div>
          {/* Message */}
          <div className="mb-3 sm:mb-4">
            <label htmlFor="compose-message" className="block text-gray-700 dark:text-gray-300 font-medium mb-1 text-xs sm:text-sm">
              Message
            </label>
            <textarea
              id="compose-message"
              name="message"
              className="w-full border border-gray-200 dark:border-gray-700 rounded p-2 resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs sm:text-sm"
              rows={6}
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              disabled={composeLoading}
            />
          </div>
          {composeAttachments.length > 0 && (
            <FileAttachmentPanel
              files={composeAttachments}
              onChange={setComposeAttachments}
              category="temporary"
              className="mb-3"
              label="Add more attachments"
            />
          )}
          <div className="flex items-center justify-between gap-3 sm:gap-2">
            {composeAttachments.length === 0 ? (
              <FileAttachmentPanel
                files={[]}
                onChange={setComposeAttachments}
                category="temporary"
                className="flex-1"
                label="Attach files"
                multiple
              />
            ) : (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Paperclip size={14} /> {composeAttachments.length} attached
              </span>
            )}
            <div className="flex gap-3 sm:gap-2">
              <button
                type="button"
                className="min-h-[44px] px-4 sm:px-4 py-2.5 sm:py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm sm:text-sm touch-manipulation active:scale-95 transition-transform"
                onClick={onClose}
                disabled={composeLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-4 sm:px-4 py-2.5 sm:py-2 rounded bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 text-sm sm:text-sm touch-manipulation active:scale-95 transition-transform"
                disabled={
                  composeLoading ||
                  (!composeRecipients.length && (composeToGroup !== 'sections' || !composeCourse)) ||
                  !composeSubject.trim() ||
                  !composeBody.trim()
                }
              >
                {composeLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
          {composeError && <div className="text-red-500 dark:text-red-400 mt-2">{composeError}</div>}
        </form>
      </div>
    </div>
  );
};

export default ComposeModal;
