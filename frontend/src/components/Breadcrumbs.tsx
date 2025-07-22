import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  // State for group and groupset names
  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupSetName, setGroupSetName] = useState<string | null>(null);
  const [groupTab, setGroupTab] = useState<string | null>(null);

  useEffect(() => {
    // If the path includes /groups/:groupId, fetch group and groupset names
    const groupIdx = pathnames.findIndex(seg => seg === 'groups');
    if (groupIdx !== -1 && pathnames[groupIdx + 1]) {
      const groupId = pathnames[groupIdx + 1];
      api.get(`/groups/${groupId}`)
        .then(res => {
          setGroupName(res.data.name || groupId);
          if (res.data.groupSet) {
            api.get(`/groups/sets/${res.data.groupSet}`)
              .then(gsRes => setGroupSetName(gsRes.data.name || res.data.groupSet))
              .catch(() => setGroupSetName(res.data.groupSet));
          }
        })
        .catch(() => {
          setGroupName(groupId);
          setGroupSetName(null);
        });
      // If there is a tab after groupId, use it
      setGroupTab(pathnames[groupIdx + 2] ? pathnames[groupIdx + 2] : null);
    } else {
      setGroupName(null);
      setGroupSetName(null);
      setGroupTab(null);
    }
  }, [location.pathname]);

  // Capitalize and prettify segment
  const prettify = (segment: string) => {
    if (!segment) return '';
    // Replace dashes/underscores, capitalize first letter
    return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Special case: inside a group
  const groupIdx = pathnames.findIndex(seg => seg === 'groups');
  if (groupIdx !== -1 && groupName) {
    return (
      <nav className="flex items-center gap-2 text-sm text-gray-500 px-8 py-3 bg-transparent">
        <Link to="/" className="hover:underline text-gray-700 font-medium">Dashboard</Link>
        <span className="mx-1 text-gray-300">/</span>
        <Link to="/groups" className="hover:underline text-gray-700">Groups</Link>
        {groupSetName && (
          <>
            <span className="mx-1 text-gray-300">/</span>
            <span className="text-gray-700">{groupSetName}</span>
          </>
        )}
        <span className="mx-1 text-gray-300">/</span>
        <span className="text-gray-700 font-semibold">{groupName}</span>
        {groupTab && (
          <>
            <span className="mx-1 text-gray-300">/</span>
            <span className="text-gray-700 font-semibold">{prettify(groupTab)}</span>
          </>
        )}
      </nav>
    );
  }

  // Default: show prettified segments
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 px-8 py-3 bg-transparent">
      <Link to="/" className="hover:underline text-gray-700 font-medium">Dashboard</Link>
      {pathnames.map((value, idx) => {
        const to = '/' + pathnames.slice(0, idx + 1).join('/');
        const isLast = idx === pathnames.length - 1;
        return (
          <span key={to} className="flex items-center gap-2">
            <span className="mx-1 text-gray-300">/</span>
            {isLast ? (
              <span className="text-gray-700 font-semibold">{prettify(value)}</span>
            ) : (
              <Link to={to} className="hover:underline text-gray-700">{prettify(value)}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs; 