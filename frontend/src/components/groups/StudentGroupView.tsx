import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import { getUserPreferences } from '../../services/api';
import GroupCard from './GroupCard';

interface GroupSet {
  _id: string;
  name: string;
  course: string;
  allowSelfSignup: boolean;
}

interface Group {
  _id: string;
  name: string;
  groupSet: string;
  members: User[];
  leader: User;
  groupId: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface StudentGroupViewProps {
  courseId: string;
  userId: string;
}

const StudentGroupView: React.FC<StudentGroupViewProps> = ({ courseId, userId }) => {
  const [enrolledGroups, setEnrolledGroups] = useState<{ groupSet: GroupSet; group: Group }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCourseColors, setUserCourseColors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { user } = useAuth();
  const { courses } = useCourse();

  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const response = await getUserPreferences();
        if (response.data.success && response.data.preferences?.courseColors) {
          setUserCourseColors(response.data.preferences.courseColors || {});
        }
      } catch {
        // preferences are optional
      }
    };
    loadUserPreferences();
  }, [user?._id]);

  useEffect(() => {
    const fetchEnrolledGroups = async () => {
      try {
        const token = localStorage.getItem('token');

        const groupSetsResponse = await axios.get(`${API_URL}/api/groups/sets/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const groupSets = groupSetsResponse.data;
        const enrolledGroupsData: { groupSet: GroupSet; group: Group }[] = [];

        for (const groupSet of groupSets) {
          try {
            const groupsResponse = await axios.get(`${API_URL}/api/groups/sets/${groupSet._id}/groups`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const groups = groupsResponse.data;
            const studentGroups = groups.filter((group: Group) =>
              group.members.some((member) => member._id === userId)
            );

            studentGroups.forEach((group: Group) => {
              enrolledGroupsData.push({ groupSet, group });
            });
          } catch {
            // skip failed group set
          }
        }

        setEnrolledGroups(enrolledGroupsData);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading enrolled groups');
      } finally {
        setLoading(false);
      }
    };

    fetchEnrolledGroups();
  }, [courseId, userId]);

  const getCourseColor = (id: string) => {
    const course = courses.find((c) => c._id === id);
    if (userCourseColors[id]) {
      return userCourseColors[id];
    }
    return course?.defaultColor || '#556B2F';
  };

  const accentColor = getCourseColor(courseId);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      <div className="mb-5 sm:mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl">
          My Groups
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Groups you are enrolled in for this course
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:px-4 sm:py-3">
          {error}
        </div>
      )}

      {enrolledGroups.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <Users className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">No groups enrolled</h3>
          <p className="text-gray-500 dark:text-gray-400">
            You are not enrolled in any groups for this course.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {enrolledGroups.map(({ groupSet, group }) => (
            <GroupCard
              key={group._id}
              group={group}
              subtitle={groupSet.name}
              accentColor={accentColor}
              onClick={() => navigate(`/groups/${group._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentGroupView;
