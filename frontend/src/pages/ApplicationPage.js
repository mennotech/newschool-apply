import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ApplicationProgress from '../components/ApplicationProgress';
import StudentInfoStep from '../components/steps/StudentInfoStep';
import HealthInfoStep from '../components/steps/HealthInfoStep';
import ParentInfoStep from '../components/steps/ParentInfoStep';
import AdditionalSupportStep from '../components/steps/AdditionalSupportStep';
import QuestionnaireStep from '../components/steps/QuestionnaireStep';
import CommitmentStep from '../components/steps/CommitmentStep';
import { createApplication, fetchApplicationById, patchDraftApplication } from '../store/slices/applicationSlice';

const STEPS = ['student-info', 'health-info', 'parent-info', 'additional-support', 'questionnaire', 'commitment'];

const STEP_LABELS = {
  'student-info': 'Student Info',
  'health-info': 'Health Information',
  'parent-info': 'Parent / Guardian Information',
  'additional-support': 'Additional Support',
  questionnaire: 'Questionnaire',
  commitment: 'Commitment',
};

const SUBMIT_REQUIRED_STEPS = ['student-info', 'health-info', 'parent-info', 'additional-support', 'questionnaire'];

const REQUIRED_BY_STEP = {
  'student-info': [
    'student_first_name',
    'student_last_name',
    'student_birth_date',
    'student_applying_for_grade',
    'primary_home_phone',
    'physical_address_line_1',
    'physical_city',
    'physical_state_province',
    'physical_postal_zip',
    'student_gender',
    'citizenship_status',
    'mailing_address_differs',
    'attended_mb_school_before',
  ],
  'health-info': [
    'mb_health_number_9_digit',
    'mb_health_number_6_digit',
    'emergency_contact_name',
    'emergency_contact_phone',
  ],
  'parent-info': [
    'parents_relationship_status',
    'student_lives_with',
    'custody_description',
  ],
  questionnaire: [
    'parent_name',
    'christian_testimony',
    'school_interest_reason',
  ],
  'additional-support': ['support_declaration_reviewed'],
};

// Maps form field keys to Drupal field names (used for autosave)
const FORM_TO_DRUPAL = {
  student_first_name: 'field_student_first_name',
  student_middle_name: 'field_student_middle_name',
  student_last_name: 'field_student_last_name',
  student_preferred_name: 'field_student_preferred_name',
  student_gender: 'field_student_gender',
  student_birth_date: 'field_student_birth_date',
  student_current_grade: 'field_student_current_grade',
  student_applying_for_grade: 'field_student_applying_for_grade',
  primary_home_phone: 'field_primary_home_phone',
  physical_address_line_1: 'field_physical_address_line_1',
  physical_address_line_2: 'field_physical_address_line_2',
  physical_city: 'field_physical_city',
  physical_state_province: 'field_physical_state_province',
  physical_postal_zip: 'field_physical_postal_zip',
  mailing_address_differs: 'field_mailing_address_differs',
  citizenship_status: 'field_citizenship_status',
  attended_mb_school_before: 'field_attended_mb_school_before',
  church_attending: 'field_church_attending',
  denomination: 'field_denomination',
  mb_health_number_9_digit: 'field_mb_health_number_9_digit',
  mb_health_number_6_digit: 'field_mb_health_number_6_digit',
  emergency_contact_name: 'field_emergency_contact_name',
  emergency_contact_phone: 'field_emergency_contact_phone',
  allergies: 'field_allergies',
  medications_used_frequently: 'field_medications_used_fr_2b9881',
  medical_restrictions: 'field_medical_restrictions',
  father_surname: 'field_father_surname',
  father_given_name: 'field_father_given_name',
  father_address_same_as_student: 'field_father_address_same_a45c44',
  father_workplace: 'field_father_workplace',
  father_work_number: 'field_father_work_number',
  father_cell_number: 'field_father_cell_number',
  father_email: 'field_father_email',
  mother_surname: 'field_mother_surname',
  mother_given_name: 'field_mother_given_name',
  mother_address_same_as_student: 'field_mother_address_same_afa04c',
  mother_workplace: 'field_mother_workplace',
  mother_work_number: 'field_mother_work_number',
  mother_cell_number: 'field_mother_cell_number',
  mother_email: 'field_mother_email',
  parents_relationship_status: 'field_parents_relationshi_456f4f',
  student_lives_with: 'field_student_lives_with',
  custody_description: 'field_custody_description',
  academic_support_details: 'field_academic_support_details',
  diagnosis_assessments_details: 'field_diagnosis_assessmen_18b9ab',
  psychological_support_details: 'field_psychological_suppo_e92629',
  support_declaration_reviewed: 'field_support_declaration_265eb8',
  parent_name: 'field_parent_name',
  christian_testimony: 'field_christian_testimony',
  school_interest_reason: 'field_school_interest_reason',
};

// Fields stored as { value, format } text_long in Drupal
const TEXT_LONG_FIELDS = new Set([
  'allergies', 'medications_used_frequently', 'medical_restrictions',
  'academic_support_details', 'diagnosis_assessments_details', 'psychological_support_details',
  'christian_testimony', 'school_interest_reason',
]);

// Extract plain string from a Drupal attribute (handles text_long objects)
function plain(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.value !== undefined) return v.value;
  return String(v);
}

// Map Drupal application attributes back to the form's stepData shape
function mapDrupalToStepData(attrs) {
  const section1Reviewed = plain(attrs.field_section_1_reviewed) === 'yes';
  const section2Reviewed = plain(attrs.field_section_2_reviewed) === 'yes';
  const section3Reviewed = plain(attrs.field_section_3_reviewed) === 'yes';
  const section4Reviewed = plain(attrs.field_section_4_reviewed) === 'yes';
  const section5Reviewed = plain(attrs.field_section_5_reviewed) === 'yes';
  const section6Reviewed = plain(attrs.field_section_6_reviewed) === 'yes';

  return {
    studentInfo: {
      student_first_name: plain(attrs.field_student_first_name),
      student_middle_name: plain(attrs.field_student_middle_name),
      student_last_name: plain(attrs.field_student_last_name),
      student_preferred_name: plain(attrs.field_student_preferred_name),
      student_gender: plain(attrs.field_student_gender),
      student_birth_date: plain(attrs.field_student_birth_date),
      student_current_grade: plain(attrs.field_student_current_grade),
      student_applying_for_grade: plain(attrs.field_student_applying_for_grade),
      primary_home_phone: plain(attrs.field_primary_home_phone),
      physical_address_line_1: plain(attrs.field_physical_address_line_1),
      physical_address_line_2: plain(attrs.field_physical_address_line_2),
      physical_city: plain(attrs.field_physical_city),
      physical_state_province: plain(attrs.field_physical_state_province),
      physical_postal_zip: plain(attrs.field_physical_postal_zip),
      mailing_address_differs: plain(attrs.field_mailing_address_differs),
      citizenship_status: plain(attrs.field_citizenship_status),
      attended_mb_school_before: plain(attrs.field_attended_mb_school_before),
      church_attending: plain(attrs.field_church_attending),
      denomination: plain(attrs.field_denomination),
    },
    healthInfo: {
      mb_health_number_9_digit: plain(attrs.field_mb_health_number_9_digit),
      mb_health_number_6_digit: plain(attrs.field_mb_health_number_6_digit),
      emergency_contact_name: plain(attrs.field_emergency_contact_name),
      emergency_contact_phone: plain(attrs.field_emergency_contact_phone),
      allergies: plain(attrs.field_allergies),
      medications_used_frequently: plain(attrs.field_medications_used_fr_2b9881),
      medical_restrictions: plain(attrs.field_medical_restrictions),
    },
    parentInfo: {
      father_surname: plain(attrs.field_father_surname),
      father_given_name: plain(attrs.field_father_given_name),
      father_address_same_as_student: plain(attrs.field_father_address_same_a45c44),
      father_workplace: plain(attrs.field_father_workplace),
      father_work_number: plain(attrs.field_father_work_number),
      father_cell_number: plain(attrs.field_father_cell_number),
      father_email: plain(attrs.field_father_email),
      mother_surname: plain(attrs.field_mother_surname),
      mother_given_name: plain(attrs.field_mother_given_name),
      mother_address_same_as_student: plain(attrs.field_mother_address_same_afa04c),
      mother_workplace: plain(attrs.field_mother_workplace),
      mother_work_number: plain(attrs.field_mother_work_number),
      mother_cell_number: plain(attrs.field_mother_cell_number),
      mother_email: plain(attrs.field_mother_email),
      parents_relationship_status: plain(attrs.field_parents_relationshi_456f4f),
      student_lives_with: plain(attrs.field_student_lives_with),
      custody_description: plain(attrs.field_custody_description),
    },
    additionalSupport: {
      academic_support_details: plain(attrs.field_academic_support_details),
      diagnosis_assessments_details: plain(attrs.field_diagnosis_assessmen_18b9ab),
      psychological_support_details: plain(attrs.field_psychological_suppo_e92629),
      support_declaration_reviewed: plain(attrs.field_support_declaration_265eb8) === 'yes',
    },
    questionnaire: {
      parent_name: plain(attrs.field_parent_name),
      christian_testimony: plain(attrs.field_christian_testimony),
      school_interest_reason: plain(attrs.field_school_interest_reason),
    },
    validation: {
      section_1_reviewed: section1Reviewed,
      section_2_reviewed: section2Reviewed,
      section_3_reviewed: section3Reviewed,
      section_4_reviewed: section4Reviewed,
      section_5_reviewed: section5Reviewed,
      section_6_reviewed: section6Reviewed,
    },
  };
}

function isFilled(value) {
  return typeof value === 'string' ? value.trim().length > 0 : !!value;
}

function hasRequiredFields(data, keys) {
  return keys.every((k) => isFilled(data?.[k]));
}

function ApplicationPage() {
  const { step } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentApplication = useSelector((s) => s.application.currentApplication);

  const currentStepIndex = step ? STEPS.indexOf(step) : 0;
  const activeStep = currentStepIndex >= 0 ? currentStepIndex : 0;

  // Capture the application ID at mount time to distinguish resume vs new application
  const resumeIdRef = useRef(currentApplication?.id ?? null);
  const createInFlightRef = useRef(null);

  // Accumulated data from each step; passed as initialData to each step
  const [stepData, setStepData] = useState({
    studentInfo: {},
    healthInfo: {},
    parentInfo: {},
    additionalSupport: {},
    questionnaire: {},
    validation: {
      section_1_reviewed: false,
      section_2_reviewed: false,
      section_3_reviewed: false,
      section_4_reviewed: false,
      section_5_reviewed: false,
      section_6_reviewed: false,
    },
  });
  const [stepError, setStepError] = useState(null);
  // True while fetching draft data on resume — defer rendering until hydration is ready
  const [hydrating, setHydrating] = useState(!!resumeIdRef.current);

  const isResumingDraft = !!resumeIdRef.current;

  // On mount, if resuming a draft, fetch the application and hydrate all step data
  useEffect(() => {
    if (resumeIdRef.current) {
      dispatch(fetchApplicationById(resumeIdRef.current)).then((action) => {
        if (fetchApplicationById.fulfilled.match(action)) {
          setStepData(mapDrupalToStepData(action.payload.attributes || {}));
        }
        setHydrating(false);
      });
      return;
    }

    // Start new applications with a draft node immediately so step 1 can autosave on blur.
    dispatch(createApplication()).then((action) => {
      if (createApplication.rejected.match(action)) {
        setStepError(action.payload || 'Failed to start application. Please try again.');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function ensureApplicationId() {
    if (currentApplication?.id) return currentApplication.id;

    if (createInFlightRef.current) {
      return createInFlightRef.current;
    }

    createInFlightRef.current = dispatch(createApplication()).then((action) => {
      createInFlightRef.current = null;
      if (createApplication.fulfilled.match(action)) {
        return action.payload.id;
      }
      throw new Error(action.payload || 'Failed to start application.');
    });

    return createInFlightRef.current;
  }

  function goToStep(index) {
    navigate(`/apply/${STEPS[index]}`);
  }

  const completedSteps = {
    'student-info': stepData.validation.section_1_reviewed || hasRequiredFields(stepData.studentInfo, REQUIRED_BY_STEP['student-info']),
    'health-info': stepData.validation.section_2_reviewed || hasRequiredFields(stepData.healthInfo, REQUIRED_BY_STEP['health-info']),
    'parent-info': stepData.validation.section_3_reviewed || hasRequiredFields(stepData.parentInfo, REQUIRED_BY_STEP['parent-info']),
    'additional-support': stepData.validation.section_4_reviewed || hasRequiredFields(stepData.additionalSupport, REQUIRED_BY_STEP['additional-support']),
    questionnaire: stepData.validation.section_5_reviewed || hasRequiredFields(stepData.questionnaire, REQUIRED_BY_STEP.questionnaire),
    commitment: stepData.validation.section_6_reviewed || currentApplication?.attributes?.field_status === 'submitted',
  };

  const canJumpAround = completedSteps['student-info'];
  const incompleteRequiredSections = SUBMIT_REQUIRED_STEPS
    .filter((stepId) => !completedSteps[stepId])
    .map((stepId) => STEP_LABELS[stepId]);

  function handleStepperClick(index) {
    if (index === 0 || canJumpAround) {
      goToStep(index);
    }
  }

  // Autosave a single field to the draft application whenever a field loses focus
  async function handleAutosave(fieldKey, value) {
    if (value === undefined) return;
    const drupalField = FORM_TO_DRUPAL[fieldKey];
    if (!drupalField) return;

    let applicationId;
    try {
      applicationId = await ensureApplicationId();
    } catch (err) {
      setStepError(err.message || 'Failed to start application. Please try again.');
      return;
    }

    const attrValue = TEXT_LONG_FIELDS.has(fieldKey)
      ? { value: value || '', format: 'plain_text' }
      : value;
    dispatch(patchDraftApplication({ applicationId, attributes: { [drupalField]: attrValue } }));
  }

  async function handleStudentInfoComplete({ profile, formData }) {
    setStepData((prev) => ({
      ...prev,
      studentInfo: formData,
      validation: { ...prev.validation, section_1_reviewed: true },
    }));
    setStepError(null);
    let applicationId;
    try {
      applicationId = await ensureApplicationId();
    } catch (err) {
      setStepError(err.message || 'Failed to create application. Please try again.');
      return;
    }

    const relationships = profile?.id
      ? {
        field_student_profile: {
          data: { type: 'node--student_profile', id: profile.id },
        },
      }
      : undefined;

    dispatch(
      patchDraftApplication({
        applicationId,
        attributes: { field_section_1_reviewed: 'yes' },
        relationships,
      })
    );
    goToStep(1);
  }

  function handleHealthInfoComplete(data) {
    setStepData((prev) => ({
      ...prev,
      healthInfo: data,
      validation: { ...prev.validation, section_2_reviewed: true },
    }));
    if (currentApplication?.id) {
      dispatch(
        patchDraftApplication({
          applicationId: currentApplication.id,
          attributes: { field_section_2_reviewed: 'yes' },
        })
      );
    }
    goToStep(2);
  }

  function handleParentInfoComplete(data) {
    setStepData((prev) => ({
      ...prev,
      parentInfo: data,
      validation: { ...prev.validation, section_3_reviewed: true },
    }));
    if (currentApplication?.id) {
      dispatch(
        patchDraftApplication({
          applicationId: currentApplication.id,
          attributes: { field_section_3_reviewed: 'yes' },
        })
      );
    }
    goToStep(3);
  }

  function handleAdditionalSupportComplete(data) {
    setStepData((prev) => ({
      ...prev,
      additionalSupport: data,
      validation: { ...prev.validation, section_4_reviewed: true },
    }));
    if (currentApplication?.id) {
      dispatch(
        patchDraftApplication({
          applicationId: currentApplication.id,
          attributes: {
            field_section_4_reviewed: 'yes',
            field_support_declaration_265eb8: data.support_declaration_reviewed ? 'yes' : 'no',
          },
        })
      );
    }
    goToStep(4);
  }

  function handleQuestionnaireComplete(data) {
    setStepData((prev) => ({
      ...prev,
      questionnaire: data,
      validation: { ...prev.validation, section_5_reviewed: true },
    }));
    if (currentApplication?.id) {
      dispatch(
        patchDraftApplication({
          applicationId: currentApplication.id,
          attributes: { field_section_5_reviewed: 'yes' },
        })
      );
    }
    goToStep(5);
  }

  return (
    <main className="application-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-header__title">Home School Partial Programming Application</h1>
        </div>
        <ApplicationProgress
          steps={STEPS}
          activeStep={activeStep}
          completedSteps={completedSteps}
          canJumpAround={canJumpAround}
          onStepClick={handleStepperClick}
        />

        {stepError && (
          <div className="form-alert form-alert--error" role="alert">
            {stepError}
          </div>
        )}

        <div className="application-step-card">
          {hydrating ? (
            <div className="loading-state" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              Loading draft…
            </div>
          ) : (
            <>
              {activeStep === 0 && (
                <StudentInfoStep
                  onComplete={handleStudentInfoComplete}
                  initialData={stepData.studentInfo}
                  applicationId={currentApplication?.id}
                  isResume={isResumingDraft}
                  onFieldBlur={handleAutosave}
                />
              )}
              {activeStep === 1 && (
                <HealthInfoStep
                  onComplete={handleHealthInfoComplete}
                  onBack={() => goToStep(0)}
                  initialData={stepData.healthInfo}
                  onFieldBlur={handleAutosave}
                />
              )}
              {activeStep === 2 && (
                <ParentInfoStep
                  onComplete={handleParentInfoComplete}
                  onBack={() => goToStep(1)}
                  initialData={stepData.parentInfo}
                  onFieldBlur={handleAutosave}
                />
              )}
              {activeStep === 3 && (
                <AdditionalSupportStep
                  onComplete={handleAdditionalSupportComplete}
                  onBack={() => goToStep(2)}
                  initialData={stepData.additionalSupport}
                  onFieldBlur={handleAutosave}
                />
              )}
              {activeStep === 4 && (
                <QuestionnaireStep
                  onComplete={handleQuestionnaireComplete}
                  onBack={() => goToStep(3)}
                  initialData={stepData.questionnaire}
                  onFieldBlur={handleAutosave}
                />
              )}
              {activeStep === 5 && (
                <CommitmentStep
                  allStepData={stepData}
                  incompleteSections={incompleteRequiredSections}
                  onBack={() => goToStep(4)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default ApplicationPage;
