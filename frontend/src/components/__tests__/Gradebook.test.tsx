import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GradebookView from '../grades/GradebookView';

vi.mock('../../services/api', () => ({
  getImageUrl: vi.fn((v: string) => v)
}));

vi.mock('../../utils/gradeUtils', () => ({
  calculateFinalGradeWithWeightedGroups: vi.fn(() => 95),
  getLetterGrade: vi.fn(() => 'A')
}));

vi.mock('../grades/AssignmentGroupsModal', () => ({
  default: () => null
}));

vi.mock('../grades/GradeScaleModal', () => ({
  default: () => null
}));

describe('Gradebook replacement coverage', () => {
  it('renders modern GradebookView header and stats', () => {
    render(
      <MemoryRouter>
        <GradebookView
          course={{ gradeSettings: { groupWeights: [] } }}
          courseId="course-1"
          gradebookData={{
            students: [{ _id: 's1', firstName: 'Jane', lastName: 'Doe' }],
            assignments: [{ _id: 'a1', title: 'Quiz 1', totalPoints: 10 }],
            grades: { s1: { a1: 9 } }
          }}
          submissionMap={{}}
          studentSubmissions={[]}
          isInstructor
          isAdmin={false}
          expandedStudents={new Set()}
          setExpandedStudents={vi.fn()}
          editingGrade={null}
          setEditingGrade={vi.fn()}
          editingValue=""
          setEditingValue={vi.fn()}
          savingGrade={null}
          handleGradeCellClick={vi.fn()}
          handleGradeUpdate={vi.fn(async () => {})}
          handleExportGradebookCSV={vi.fn()}
          handleOpenGradeScaleModal={vi.fn()}
          handleOpenGroupModal={vi.fn()}
          showGroupModal={false}
          editGroups={[]}
          handleGroupChange={vi.fn()}
          handleAddGroupRow={vi.fn()}
          handleRemoveGroupRow={vi.fn()}
          handleResetToDefaults={vi.fn()}
          handleSaveGroups={vi.fn(async () => {})}
          savingGroups={false}
          groupError=""
          setShowGroupModal={vi.fn()}
          showGradeScaleModal={false}
          editGradeScale={[]}
          handleGradeScaleChange={vi.fn()}
          handleRemoveGradeScaleRow={vi.fn()}
          handleSaveGradeScale={vi.fn(async () => {})}
          savingGradeScale={false}
          gradeScaleError=""
          setShowGradeScaleModal={vi.fn()}
          setGradeScaleError={vi.fn()}
          setEditGradeScale={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Gradebook')).toBeInTheDocument();
    expect(screen.getByText('Students')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });
});







