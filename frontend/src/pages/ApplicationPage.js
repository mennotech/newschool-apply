import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ApplicationProgress from '../components/ApplicationProgress';
import StudentInfoStep from '../components/steps/StudentInfoStep';
import DocumentsStep from '../components/steps/DocumentsStep';
import ReviewStep from '../components/steps/ReviewStep';
import { createApplication } from '../store/slices/applicationSlice';

const STEPS = ['student-info', 'documents', 'review'];

function ApplicationPage() {
  const { step } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const currentStepIndex = step ? STEPS.indexOf(step) : 0;
  const activeStep = currentStepIndex >= 0 ? currentStepIndex : 0;

  // Local draft state shared across steps (submitted to Drupal per step)
  const [studentInfo, setStudentInfo] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [stepError, setStepError] = useState(null);

  function goToStep(index) {
    navigate(`/apply/${STEPS[index]}`);
  }

  async function handleStudentInfoComplete(data) {
    setStudentInfo(data);
    setStepError(null);
    // Await application creation so applicationId is in Redux before Documents step mounts
    const result = await dispatch(createApplication(data.id));
    if (createApplication.rejected.match(result)) {
      setStepError(result.payload || 'Failed to create application. Please try again.');
      return;
    }
    goToStep(1);
  }

  function handleDocumentsComplete(uploadedDocs) {
    setDocuments(uploadedDocs);
    goToStep(2);
  }

  return (
    <main className="application-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-header__title">Application</h1>
        </div>
        <ApplicationProgress steps={STEPS} activeStep={activeStep} />

        {stepError && (
          <div className="form-alert form-alert--error" role="alert">
            {stepError}
          </div>
        )}

        <div className="application-step-card">
          {activeStep === 0 && (
            <StudentInfoStep onComplete={handleStudentInfoComplete} />
          )}
          {activeStep === 1 && (
            <DocumentsStep onComplete={handleDocumentsComplete} />
          )}
          {activeStep === 2 && (
            <ReviewStep studentInfo={studentInfo} documents={documents} />
          )}
        </div>
      </div>
    </main>
  );
}

export default ApplicationPage;
