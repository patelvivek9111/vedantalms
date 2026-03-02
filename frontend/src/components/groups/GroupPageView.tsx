import React from 'react';
import { useParams } from 'react-router-dom';
import PageView from '../PageView';

const GroupPageView: React.FC = () => {
  // PageView will get pageId from useParams
  return <PageView />;
};

export default GroupPageView;

