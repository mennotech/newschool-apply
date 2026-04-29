import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import StepIndicator from '../components/StepIndicator';
import StudentInfoStep from './apply/StudentInfoStep';
import HealthInfoStep from './apply/HealthInfoStep';
import GuardianInfoStep from './apply/GuardianInfoStep';
import AdditionalSupportStep from './apply/AdditionalSupportStep';
import QuestionnaireStep from './apply/QuestionnaireStep';
import CommitmentStep from './apply/CommitmentStep';
import DocumentsStep from './apply/DocumentsStep';
import ReviewStep from './apply/ReviewStep';

const STEP_ROUTES = [
  { key: 'student-info', path: 'student-info', component: StudentInfoStep },
  { key: 'health-info', path: 'health-info', component: HealthInfoStep },
  { key: 'guardian-info', path: 'guardian-info', component: GuardianInfoStep },
  { key: 'additional-support', path: 'additional-support', component: AdditionalSupportStep },
  { key: 'questionnaire', path: 'questionnaire', component: QuestionnaireStep },
  { key: 'commitment', path: 'commitment', component: CommitmentStep },
  { key: 'documents', path: 'documents', component: DocumentsStep },
  { key: 'review', path: 'review', component: ReviewStep },
];

function ApplicationLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentApplication = useSelector((state) => state.application.currentApplication);

  // Determine current step from URL
  const pathParts = location.pathname.split('/');
  const currentStep = pathParts[pathParts.length - 1] || 'student-info';

  // Determine completed steps from application data
  const attrs = currentApplication?.attributes || {};
  const completedSteps = [];
  if (attrs.field_student_first_name) completedSteps.push('student-info');
  if (attrs.field_mb_health_number_9_digit) completedSteps.push('health-info');
  if (attrs.field_student_lives_with) completedSteps.push('guardian-info');
  if (attrs.field_support_declaration_265eb8) completedSteps.push('additional-support');
  if (attrs.field_christian_testimony) completedSteps.push('questionnaire');
  if (attrs.field_parent_guardian_signature) completedSteps.push('commitment');

  const step1Complete = completedSteps.includes('student-info') || attrs.field_student_first_name;

  function handleStepClick(stepKey) {
    navigate(`/apply/${stepKey}`);
  }

  return (
    <div className="apply-layout">
      <StepIndicator
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
        step1Complete={!!step1Complete}
      />
      <Routes>
        {STEP_ROUTES.map(({ path, component: Component }) => (
          <Route
            key={path}
            path={path}
            element={<Component />}
          />
        ))}
        <Route
          path="*"
          element={<StudentInfoStep />}
        />
      </Routes>
    </div>
  );
}

export default ApplicationLayout;
