import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

function ReviewField({ label, value }) {
  if (!value && value !== 0 && value !== false) return null;
  return (
    <div className="review-field">
      <span className="review-field-label">{label}</span>
      <span className="review-field-value">{String(value)}</span>
    </div>
  );
}

function ReviewStep() {
  const navigate = useNavigate();
  const currentApplication = useSelector((s) => s.application.currentApplication);
  const attrs = currentApplication?.attributes || {};

  if (!currentApplication) {
    return (
      <div className="step-content">
        <p>No application loaded. <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Return to Dashboard</button></p>
      </div>
    );
  }

  return (
    <div className="step-content">
      <h1 className="step-title">Review Your Application</h1>
      <p className="step-description">
        Please review all information below. Use the edit buttons to return to any section.
      </p>

      {/* Student Info */}
      <div className="review-section">
        <div className="review-section-header">
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Student Information</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/apply/student-info')}>
            Edit
          </button>
        </div>
        <ReviewField label="First Name" value={attrs.field_student_first_name} />
        <ReviewField label="Middle Name" value={attrs.field_student_middle_name} />
        <ReviewField label="Last Name" value={attrs.field_student_last_name} />
        <ReviewField label="Preferred Name" value={attrs.field_student_preferred_name || attrs.field_preferred_name} />
        <ReviewField label="Gender" value={attrs.field_student_gender || attrs.field_gender} />
        <ReviewField label="Date of Birth" value={attrs.field_student_birth_date || attrs.field_date_of_birth} />
        <ReviewField label="Current Grade" value={attrs.field_student_current_grade || attrs.field_current_grade} />
        <ReviewField label="Applying for Grade" value={attrs.field_student_applying_for_grade || attrs.field_applying_grade} />
        <ReviewField label="Phone" value={attrs.field_primary_home_phone || attrs.field_phone} />
        <ReviewField label="Citizenship" value={attrs.field_citizenship_status || attrs.field_citizenship} />
        <ReviewField label="Previous MB School" value={attrs.field_attended_mb_school_before || attrs.field_previous_mb_school} />
        <ReviewField label="Church" value={attrs.field_church_attending || attrs.field_church} />
        <ReviewField label="Denomination" value={attrs.field_denomination} />
      </div>

      {/* Health Info */}
      <div className="review-section">
        <div className="review-section-header">
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Health Information</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/apply/health-info')}>
            Edit
          </button>
        </div>
        <ReviewField label="MB Health Number (9 Digit)" value={attrs.field_mb_health_number_9_digit || attrs.field_health_number} />
        <ReviewField label="MB Health Number (6 Digit)" value={attrs.field_mb_health_number_6_digit} />
        <ReviewField label="Emergency Contact" value={attrs.field_emergency_contact_name} />
        <ReviewField label="Emergency Phone" value={attrs.field_emergency_contact_phone} />
        <ReviewField label="Allergies" value={attrs.field_allergies} />
        <ReviewField label="Medications" value={attrs.field_medications_used_fr_2b9881 || attrs.field_medications} />
        <ReviewField label="Medical Restrictions" value={attrs.field_medical_restrictions} />
      </div>

      {/* Guardian Info */}
      <div className="review-section">
        <div className="review-section-header">
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Guardian Information</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/apply/guardian-info')}>
            Edit
          </button>
        </div>
        <ReviewField label="Primary Guardian" value={attrs.field_primary_guardian_name} />
        <ReviewField label="Primary Phone" value={attrs.field_primary_guardian_phone} />
        <ReviewField label="Primary Email" value={attrs.field_primary_guardian_email} />
        <ReviewField label="Secondary Guardian" value={attrs.field_secondary_guardian_name} />
        <ReviewField label="Household Status" value={attrs.field_household_relations_e12444 || attrs.field_household_status} />
        <ReviewField label="Student Lives With" value={attrs.field_student_lives_with} />
      </div>

      {/* Additional Support */}
      <div className="review-section">
        <div className="review-section-header">
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Additional Support</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/apply/additional-support')}>
            Edit
          </button>
        </div>
        <ReviewField label="Academic Support" value={attrs.field_academic_support_details || attrs.field_academic_support} />
        <ReviewField label="Diagnoses / Assessments" value={attrs.field_diagnosis_assessmen_18b9ab || attrs.field_diagnosis_assessments} />
        <ReviewField label="Psychological Support" value={attrs.field_psychological_suppo_e92629 || attrs.field_psychological_support} />
        <ReviewField label="Reviewed" value={(attrs.field_support_declaration_265eb8 || attrs.field_additional_support_reviewed) ? 'Yes' : undefined} />
      </div>

      {/* Questionnaire */}
      <div className="review-section">
        <div className="review-section-header">
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Questionnaire</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/apply/questionnaire')}>
            Edit
          </button>
        </div>
        <ReviewField label="Parent Name" value={attrs.field_parent_name} />
        <ReviewField label="Christian Testimony" value={attrs.field_christian_testimony || attrs.field_parent_testimony} />
        <ReviewField label="Reason for Interest" value={attrs.field_school_interest_reason || attrs.field_reason_for_interest} />
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/apply/documents')}
        >
          ← Back to Documents
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/apply/commitment')}
        >
          Proceed to Commitment & Submit
        </button>
      </div>
    </div>
  );
}

export default ReviewStep;
