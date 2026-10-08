import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Circle, Coins, Eye, EyeOff, Loader2, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { skillsCatalog, universities } from '../data/catalog';
import { getPasswordRequirements, validateEmail, validatePassword } from '../lib/validation';
import { DEFAULT_VERIFIED_EMAIL_DOMAINS, getVerifiedEmailDomains, isUniversityEmail } from '../lib/firestoreService';
import logoImg from '../assets/logo.webp';
import './AuthPages.css';

export function SignUpPage() {
  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', studentNumber: '', university: '', email: '', mobileNumber: '', password: '', confirmPassword: '' });
  const [skillsTeach, setSkillsTeach] = useState<string[]>([]);
  const [skillsLearn, setSkillsLearn] = useState<string[]>([]);
  const [studentConfirmed, setStudentConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  // University email domains allowed to sign up (admin setting); the rules enforce the same list.
  const [universityDomains, setUniversityDomains] = useState<string[]>(DEFAULT_VERIFIED_EMAIL_DOMAINS);
  useEffect(() => {
    getVerifiedEmailDomains().then(setUniversityDomains).catch(() => undefined);
  }, []);
  const update = (name: keyof typeof form, value: string) => { setForm(current => ({ ...current, [name]: value })); setErrors(current => ({ ...current, [name]: '' })); };
  const fieldError = (name: string) => errors[name] ? <span className="field-error" role="alert">{errors[name]}</span> : null;
  const emailError = (email: string) => {
    if (!validateEmail(email.trim())) return 'Enter a valid university email address.';
    if (!isUniversityEmail(email, universityDomains)) return 'Wrong email. Use your university email address, not a personal email such as Gmail or Outlook.';
    return '';
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'Enter your first name.';
    if (!form.lastName.trim()) next.lastName = 'Enter your last name.';
    if (!form.studentNumber.trim()) next.studentNumber = 'Enter your student number.';
    else if (!/^\d{9}$/.test(form.studentNumber.trim())) next.studentNumber = 'Student number must be exactly 9 digits.';
    if (!form.university) next.university = 'Select your university.';
    if (emailError(form.email)) next.email = emailError(form.email);
    if (form.mobileNumber.trim() && !/^\+?[0-9\s()-]{7,20}$/.test(form.mobileNumber.trim())) next.mobileNumber = 'Enter a valid mobile number.';
    const passwordCheck = validatePassword(form.password);
    if (!passwordCheck.valid) next.password = passwordCheck.message || 'Enter a valid password.';
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    if (!skillsTeach.length) next.skillsTeach = 'Choose at least one skill you can teach.';
    if (!skillsLearn.length) next.skillsLearn = 'Choose at least one skill you want to learn.';
    if (!studentConfirmed) next.studentConfirmed = 'Confirm that you are currently a university student.';
    if (!termsAccepted) next.termsAccepted = 'You must agree before creating an account.';
    setErrors(next); setError('');
    if (Object.keys(next).length) return;
    const result = await signup({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), studentNumber: form.studentNumber.trim(), email: form.email.trim(), mobileNumber: form.mobileNumber.trim(), password: form.password, university: form.university, skillsTeach, skillsLearn });
    if (result) setError(result); else navigate('/explore?welcome=1&verifyEmail=1');
  };

  const toggleSkill = (skill: string, selection: string[], updateSelection: (skills: string[]) => void) => {
    updateSelection(selection.includes(skill) ? selection.filter(item => item !== skill) : [...selection, skill]);
  };

  const recommendedSkills = [...skillsCatalog].sort((first, second) => second.userCount - first.userCount).slice(0, 10);
  const passwordRequirements = getPasswordRequirements(form.password);

  return <div className="auth-page signup-page">
    <div className="auth-bg-effects"><div className="auth-orb orb-1" /><div className="auth-orb orb-2" /></div>
    <div className="auth-container auth-container-wide signup-container animate-scale-in">
      <aside className="auth-brand">
        <div className="auth-logo"><img src={logoImg} alt="EduSwap" /></div><h1>EduSwap</h1><p className="auth-tagline">Exchange skills, grow together</p>
        <div className="signup-benefits"><div><Users size={18} /><span><strong>Learn with students</strong>Connect with university students who share your goals.</span></div><div><ShieldCheck size={18} /><span><strong>Trusted community</strong>Complete your student verification after joining.</span></div><div><Coins size={18} /><span><strong>Credits included</strong>Your starting credits are created automatically.</span></div></div>
      </aside>
      <form className="auth-form student-registration-form" onSubmit={handleSubmit} noValidate>
        <span className="registration-eyebrow">Student registration</span><h2>Create Your Student Account</h2><p className="auth-subtitle">Join EduSwap and connect with other university students.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <div className="form-row"><Field id="first-name" label="First name" value={form.firstName} error={errors.firstName} onChange={value => update('firstName', value)} autoComplete="given-name" /><Field id="last-name" label="Last name" value={form.lastName} error={errors.lastName} onChange={value => update('lastName', value)} autoComplete="family-name" /></div>
        <Field id="student-number" label="Student number" value={form.studentNumber} error={errors.studentNumber} onChange={value => update('studentNumber', value.replace(/\D/g, '').slice(0, 9))} inputMode="numeric" maxLength={9} placeholder="9 digits" />
        <div className="form-group"><label htmlFor="signup-university">University</label><select id="signup-university" value={form.university} onChange={event => update('university', event.target.value)} className={errors.university ? 'input-error' : ''}><option value="">Select your university</option>{universities.map(university => <option key={university.id} value={university.name}>{university.name}</option>)}</select>{fieldError('university')}</div>
        <Field id="student-email" label="University email address" type="email" placeholder="student@university.ac.za" value={form.email} error={errors.email} onChange={value => update('email', value)} onBlur={() => { if (form.email.trim()) setErrors(current => ({ ...current, email: emailError(form.email) })); }} autoComplete="email" />
        <Field id="mobile-number" label="Mobile number" optional type="tel" placeholder="+27 00 000 0000" value={form.mobileNumber} error={errors.mobileNumber} onChange={value => update('mobileNumber', value)} autoComplete="tel" />
        <div className="signup-skill-picks">
          <p className="field-hint">Popular starter skills. Choose at least one in each group; you can change these later.</p>
          <SkillChoices label="I can teach" skills={recommendedSkills.map(skill => skill.name)} selected={skillsTeach} onToggle={skill => toggleSkill(skill, skillsTeach, setSkillsTeach)} error={errors.skillsTeach} />
          <SkillChoices label="I want to learn" skills={recommendedSkills.map(skill => skill.name)} selected={skillsLearn} onToggle={skill => toggleSkill(skill, skillsLearn, setSkillsLearn)} error={errors.skillsLearn} />
        </div>
        <div className="form-row signup-password-row">
          <div className="form-group">
            <label htmlFor="signup-password">Password</label>
            <div className="input-with-icon">
              <input type={showPassword ? 'text' : 'password'} id="signup-password" value={form.password} onChange={e => update('password', e.target.value)} autoComplete="new-password" className={errors.password ? 'input-error' : ''} aria-invalid={Boolean(errors.password)} aria-describedby="signup-password-guidance" />
              <button type="button" className="input-icon-btn" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {fieldError('password')}
            <ul className="password-guidance" id="signup-password-guidance" aria-label="Password requirements">
              {passwordRequirements.map(requirement => <li key={requirement.label} className={requirement.met ? 'met' : ''} aria-label={`${requirement.label}: ${requirement.met ? 'met' : 'not met'}`}>
                {requirement.met ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                <span>{requirement.label}</span>
              </li>)}
            </ul>
          </div>
          <Field id="confirm-password" label="Confirm password" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} error={errors.confirmPassword} onChange={value => update('confirmPassword', value)} autoComplete="new-password" />
        </div>
        <div className="registration-consents"><label className={errors.studentConfirmed ? 'has-error' : ''}><input type="checkbox" checked={studentConfirmed} onChange={e => { setStudentConfirmed(e.target.checked); setErrors(current => ({ ...current, studentConfirmed: '' })); }} /><span>I confirm that I am currently a university student.</span></label>{fieldError('studentConfirmed')}<label className={errors.termsAccepted ? 'has-error' : ''}><input type="checkbox" checked={termsAccepted} onChange={e => { setTermsAccepted(e.target.checked); setErrors(current => ({ ...current, termsAccepted: '' })); }} /><span>I agree to the Terms and Conditions and Privacy Policy.</span></label>{fieldError('termsAccepted')}</div>
        <button type="submit" className="auth-submit" disabled={isLoading}>{isLoading ? <Loader2 size={20} className="spinner" /> : <>Create Student Account <ArrowRight size={18} /></>}</button>
        <p className="post-registration-note">Complete your university, profile picture, verification document, skills, and availability inside the app.</p><p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  </div>;
}

function SkillChoices({ label, skills, selected, onToggle, error }: { label: string; skills: string[]; selected: string[]; onToggle: (skill: string) => void; error?: string }) {
  return <fieldset className="signup-skill-group"><legend>{label}</legend><div className="onboarding-skill-grid">{skills.map(skill => <button key={skill} type="button" className={`${selected.includes(skill) ? 'selected' : ''} ${label === 'I want to learn' ? 'learn' : ''}`} aria-pressed={selected.includes(skill)} onClick={() => onToggle(skill)}>{skill}</button>)}</div>{error && <span className="field-error" role="alert">{error}</span>}</fieldset>;
}

function Field({ id, label, value, onChange, onBlur, error, optional, type = 'text', placeholder, autoComplete, inputMode, maxLength }: { id: string; label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; error?: string; optional?: boolean; type?: string; placeholder?: string; autoComplete?: string; inputMode?: 'numeric'; maxLength?: number }) {
  return <div className="form-group"><label htmlFor={id}>{label} {optional && <span className="optional-label">Optional</span>}</label><input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur} inputMode={inputMode} maxLength={maxLength} className={error ? 'input-error' : ''} placeholder={placeholder} autoComplete={autoComplete} />{error && <span className="field-error" role="alert">{error}</span>}</div>;
}
