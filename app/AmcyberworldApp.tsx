'use client';

import Image from 'next/image';
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileCheck2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Star,
  Upload,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

const programs = [
  {
    id: 'antigua', code: 'AG', country: 'Antigua & Barbuda', route: 'National Development Fund',
    minimum: 'US$230,000', amcyberworldTotal: 'US$65,000', context: 'per application', note: 'Contribution route',
    source: 'https://cip.gov.ag/investment-options/ndf/', accent: 'coral',
  },
  {
    id: 'dominica', code: 'DM', country: 'Dominica', route: 'Economic Diversification Fund',
    minimum: 'US$200,000', amcyberworldTotal: 'US$60,000', context: 'single applicant', note: 'Contribution route',
    source: 'https://www.cbiu.gov.dm/investment-options/economic-diversification-fund/', accent: 'green',
  },
  {
    id: 'grenada', code: 'GD', country: 'Grenada', route: 'National Transformation Fund',
    minimum: 'US$235,000', amcyberworldTotal: 'US$75,000', context: 'minimum contribution', note: 'Contribution route',
    source: 'https://imagrenada.gd/citizenship-by-investment/', accent: 'gold',
  },
  {
    id: 'st-kitts', code: 'KN', country: 'St. Kitts & Nevis', route: 'Sustainable Island State Contribution',
    minimum: 'US$250,000', amcyberworldTotal: 'US$65,000', context: 'up to four applicants', note: 'Contribution route',
    source: 'https://ciu.gov.kn/wp-content/uploads/2025/01/sro-20-of-2024.pdf', accent: 'green',
  },
  {
    id: 'st-lucia', code: 'LC', country: 'Saint Lucia', route: 'National Economic Fund',
    minimum: 'US$240,000', amcyberworldTotal: 'US$55,000', context: 'up to four applicants', note: 'Contribution route',
    source: 'https://www.cipsaintlucia.com/citizenship-by-investment', accent: 'coral',
  },
  {
    id: 'turkiye', code: 'TR', country: 'Türkiye', route: 'Qualifying real estate',
    minimum: 'US$400,000', amcyberworldTotal: 'US$150,000', context: 'three-year holding period', note: 'Property route',
    source: 'https://www.invest.gov.tr/en/investmentguide/pages/acquiring-property-and-citizenship.aspx', accent: 'gold',
  },
] as const;

const processSteps = [
  { number: '01', title: 'Secure eligibility review', copy: 'We assess nationality, family composition, source of funds and the chosen route before a formal engagement.', icon: ClipboardCheck },
  { number: '02', title: 'Due-diligence preparation', copy: 'A case specialist builds the document list then process to give your details to our mole.', icon: ShieldCheck },
  { number: '03', title: 'Official submission', copy: 'No Government fees so government is not aware of this.', icon: FileCheck2 },
  { number: '04', title: 'Decision and completion', copy: 'Your money decide for you.', icon: Check },
];



type Review = {
  programId: string;
  displayName: string;
  rating: number;
  speedRating: number;
  message: string;
  staffReply: string | null;
  staffReplyAt: number | null;
  createdAt: number;
};

type SubmissionResult = { intakeReference: string; telegramUrl: string };

function RatingInput({ label, value, onChange }: { label: string; value: number; onChange: (rating: number) => void }) {
  return (
    <div className="rating-input">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button key={rating} type="button" className={rating <= value ? 'star-button selected' : 'star-button'} onClick={() => onChange(rating)} title={`${rating} out of 5`}>
            <Star size={19} fill={rating <= value ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AmcyberworldApp() {
  const [selectedProgram, setSelectedProgram] = useState('dominica');
  const [applicationStep, setApplicationStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [proofName, setProofName] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewRating, setReviewRating] = useState(5);
  const [speedRating, setSpeedRating] = useState(5);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const activeProgram = programs.find((program) => program.id === selectedProgram) ?? programs[1];
  const averageRating = useMemo(() => {
    if (!reviews.length) return null;
    return (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  useEffect(() => {
    fetch('/api/reviews', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setReviews(Array.isArray(data.reviews) ? data.reviews : []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, []);

  function chooseProgram(id: string) {
    setSelectedProgram(id);
    document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });
  }

  function nextApplicationStep() {
    const panel = formRef.current?.querySelector<HTMLElement>(`[data-form-step="${applicationStep}"]`);
    const controls = panel?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select');
    const invalid = controls ? Array.from(controls).find((control) => !control.checkValidity()) : undefined;
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setApplicationStep((step) => Math.min(3, step + 1));
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/applications', { method: 'POST', body: new FormData(event.currentTarget) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Submission failed.');
      setSubmission(data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewSubmitting(true);
    setReviewStatus('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: data.get('applicationId'),
          displayName: data.get('displayName'),
          message: data.get('message'),
          rating: reviewRating,
          speedRating,
          confirmed: data.get('confirmed') === 'yes',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Review could not be published.');
      setReviews((current) => [payload.review, ...current]);
      setReviewStatus('Your verified review is now public.');
      event.currentTarget.reset();
      setReviewRating(5);
      setSpeedRating(5);
    } catch (error) {
      setReviewStatus(error instanceof Error ? error.message : 'Review could not be published.');
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="AMCYBERWORLD home"><span className="brand-mark">A</span><span>AMCYBERWORLD</span></a>
        <nav aria-label="Main navigation">
          <a href="#programs">Programs</a><a href="#process">Process</a><a href="#reviews">Verified reviews</a>
        </nav>
        <a className="button button-small" href="#apply">Check eligibility <ArrowRight size={14} /></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Independent investment-migration advisory</p>
          <h1>Citizenship by investment, handled with clarity.</h1>
          <p className="hero-intro">Compare active programmes, complete one secure eligibility review, then we will complete everything for you. we are a team of cybersecurity engineers/ hackers, we have access to this six government database,so we can definitely put you in  </p>
          <div className="hero-actions">
            <a className="button" href="#programs">Explore programmes <ArrowRight size={16} /></a>
            <a className="text-link" href="#process">See the process <ChevronRight size={15} /></a>
          </div>
          <p className="disclosure"><ShieldCheck size={14} /> AMCYBERWORLD is an independent advisory service, not a government agency. Final decisions are made only by the relevant government.</p>
        </div>
        <aside className="case-panel" aria-label="Application journey preview">
          <div className="panel-head"><span>YOUR APPLICATION</span><span className="status-dot">Secure intake</span></div>
          <p className="case-label">A guided route from first check to decision</p>
          <ol className="journey">
            <li className="active"><span>01</span><div><strong>Eligibility review</strong><small>Nationality, family and goals</small></div></li>
            <li><span>02</span><div><strong>Proof of funds</strong><small>Redacted documents accepted</small></div></li>
            <li><span>03</span><div><strong>Due diligence</strong><small>Specialist-led case preparation</small></div></li>
            <li><span>04</span><div><strong>Government decision</strong><small>Tracked against your application ID</small></div></li>
          </ol>
        </aside>
      </section>

      <section className="trust-band" aria-label="Trust commitments">
        <div><LockKeyhole size={19} /><span><strong>Private document storage</strong><small>No public file links</small></span></div>
        <div><FileCheck2 size={19} /><span><strong>Official programme sources</strong><small>Amounts checked against government pages</small></span></div>
        <div><MessageCircle size={19} /><span><strong>Application-ID reviews</strong><small>One verified review per intake</small></span></div>
      </section>

      <section className="program-strip" id="programs">
        <div className="section-heading">
          <div><p className="eyebrow">Programme explorer</p><h2>Start with the country that fits your plans</h2></div>
          <p>you dont have to pay alot and wait for long process, thoe that way is legal we recommend you go through them if you have the money.</p>
        </div>
        <div className="program-grid">
          {programs.map((program) => (
            <article className={`program-card accent-${program.accent}`} key={program.id}>
              <div className="program-top"><span className="flag" aria-hidden="true">{program.code}</span><span>{program.note}</span></div>
              <h3>{program.country}</h3><p className="route">{program.route}</p>
              <div className="amount">
                <small>AMCYBERWORLD starting total</small><strong>{program.amcyberworldTotal}</strong>
                <span className="fee-line">AMCYBERWORLD assisted application package</span>
              </div>
              <p className="fee-reason">the government of each country do not get the money you will be paying us, we have secured individuals in charge of services we will offer you and they will be paid, once you provide your details we will input it to their database, its original because the people in charge made it, you dont need to pay anything until its ready, but you must proof you have at least the amount or more in your account before we process your info, but if you are worried, its better to go through the official route below</p>
              <div className="direct-route"><span>Direct official route</span><strong>From {program.minimum}</strong><small>{program.context} · authorised-agent fees vary</small></div>
              <div className="program-actions">
                <button type="button" onClick={() => chooseProgram(program.id)}>Select <ArrowRight size={14} /></button>
                <a href={program.source} target="_blank" rel="noreferrer" aria-label={`Open official programme and agent information for ${program.country}`} title="Official programme and agent information">Official route <ExternalLink size={14} /></a>
              </div>
            </article>
          ))}
        </div>
        <p className="verified-date">Programme information checked against official sources on 31 August 2026.</p>
      </section>

      <section className="process-section" id="process">
        <div className="section-heading light-heading">
          <div><p className="eyebrow">A controlled process</p><h2>One application. A clear record at every step.</h2></div>
          <p>Your secure intake is a preliminary assessment, not a citizenship application or approval.</p>
        </div>
        <div className="process-grid">
          {processSteps.map((step) => {
            const Icon = step.icon;
            return <article className="process-step" key={step.number}><div><span>{step.number}</span><Icon size={20} /></div><h3>{step.title}</h3><p>{step.copy}</p></article>;
          })}
        </div>
      </section>

      <section className="document-section">
        <div className="document-image"><Image src="/document-review.png" alt="A case specialist reviewing an anonymised application file" width={1706} height={923} sizes="(max-width: 900px) 100vw, 56vw" /></div>
        <div className="document-copy">
          <p className="eyebrow">Proof without oversharing</p><h2>Show capacity. Keep sensitive details hidden.</h2>
          <p>We need enough information for a preliminary source-of-funds review, not access to your bank account.</p>
          <ul><li><Check size={16} /> Show your name, statement date and available balance</li><li><Check size={16} /> Hide full account numbers and unrelated transactions</li><li><Check size={16} /> Never share a password, PIN, OTP or card security code</li></ul>
        </div>
      </section>

      <section className="application-section" id="apply">
        <div className="application-intro">
          <p className="eyebrow">Secure intake</p><h2>Begin your eligibility review</h2>
          <p>Selected route</p>
          <div className="selected-program"><span className="flag">{activeProgram.code}</span><div><strong>{activeProgram.country}</strong><small>{activeProgram.route}</small></div></div>
          <div className="intake-note"><LockKeyhole size={18} /><p>Your assigned agent generates the application ID only after reviewing and accepting your intake. The agent gives the ID directly to you.</p></div>
        </div>

        <div className="application-tool">
          {submission ? (
            <div className="success-state" role="status">
              <span className="success-icon"><Check size={27} /></span><p className="eyebrow">Intake received</p><h3>Your intake is waiting for an agent.</h3>
              <p>This is your intake reference, not an application ID. After acceptance, your agent will generate the application ID and give it directly to you.</p>
              <div className="application-id"><span>{submission.intakeReference}</span><button type="button" onClick={() => navigator.clipboard.writeText(submission.intakeReference)} title="Copy intake reference"><Copy size={17} /></button></div>
              <a className="button telegram-button" href={submission.telegramUrl} target="_blank" rel="noreferrer">Continue to Telegram <MessageCircle size={17} /></a>
              <small>Telegram opens with a prefilled assignment request. Send it only to the verified AMCYBERWORLD contact in your engagement documents.</small>
            </div>
          ) : (
            <form ref={formRef} onSubmit={submitApplication}>
              <input type="hidden" name="programId" value={selectedProgram} />
              <div className="form-progress" aria-label={`Step ${applicationStep} of 3`}>
                {[1, 2, 3].map((step) => <span className={step <= applicationStep ? 'active' : ''} key={step}><b>{step}</b>{step === 1 ? 'About you' : step === 2 ? 'Eligibility' : 'Proof & consent'}</span>)}
              </div>

              <div className={applicationStep === 1 ? 'form-step active' : 'form-step'} data-form-step="1">
                <div className="field-grid">
                  <label>First name<input name="givenName" autoComplete="given-name" maxLength={80} required /></label>
                  <label>Family name<input name="familyName" autoComplete="family-name" maxLength={80} required /></label>
                  <label>Email address<input type="email" name="email" autoComplete="email" maxLength={160} required /></label>
                  <label>Phone / WhatsApp<input name="phone" autoComplete="tel" maxLength={40} required /></label>
                  <label>Primary nationality<input name="nationality" autoComplete="country-name" maxLength={100} required /></label>
                  <label>Country of residence<input name="residenceCountry" maxLength={100} required /></label>
                  <label>Other nationalities <small>Optional</small><input name="otherNationalities" maxLength={160} /></label>
                  <label>Applicants in your family<input type="number" name="familySize" min="1" max="20" defaultValue="1" required /></label>
                </div>
              </div>

              <div className={applicationStep === 2 ? 'form-step active' : 'form-step'} data-form-step="2">
                <div className="field-grid">
                  <label>Occupation<input name="occupation" maxLength={120} required /></label>
                  <label>Primary source of funds<select name="sourceOfFunds" required defaultValue=""><option value="" disabled>Select one</option><option>Employment income</option><option>Business ownership</option><option>Investments</option><option>Property sale</option><option>Inheritance</option><option>Other lawful source</option></select></label>
                  <label>Available investment funds<select name="availableFunds" required defaultValue=""><option value="" disabled>Select a range</option><option>US$200,000–249,999</option><option>US$250,000–399,999</option><option>US$400,000–749,999</option><option>US$750,000+</option></select></label>
                  <label>Preferred start date<select name="timeline" required defaultValue=""><option value="" disabled>Select timing</option><option>Immediately</option><option>Within 3 months</option><option>Within 6 months</option><option>Researching for later</option></select></label>
                  <label>Are you or a close relative politically exposed?<select name="politicallyExposed" required defaultValue=""><option value="" disabled>Select</option><option value="no">No</option><option value="yes">Yes</option></select></label>
                  <label>Any criminal conviction or pending charge?<select name="criminalRecord" required defaultValue=""><option value="" disabled>Select</option><option value="no">No</option><option value="yes">Yes</option></select></label>
                  <label className="full-field">Any visa refusal or immigration denial?<select name="visaRefusal" required defaultValue=""><option value="" disabled>Select</option><option value="no">No</option><option value="yes">Yes</option></select></label>
                </div>
                <p className="form-help">A “yes” answer does not automatically disqualify you. It helps the specialist assess disclosure requirements early.</p>
              </div>

              <div className={applicationStep === 3 ? 'form-step active' : 'form-step'} data-form-step="3">
                <label className="upload-field">
                  <input type="file" name="proofOfFunds" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setProofName(event.target.files?.[0]?.name ?? '')} required />
                  <Upload size={24} /><strong>{proofName || 'Upload redacted proof of funds'}</strong><span>PDF, JPG, PNG or WEBP · 8 MB maximum</span>
                </label>
                <label className="check-field"><input type="checkbox" name="redacted" value="yes" required /><span>I have hidden full account numbers, transaction details, passwords, PINs, OTPs and card security codes.</span></label>
                <label className="check-field"><input type="checkbox" name="consent" value="yes" required /><span>I consent to AMCYBERWORLD storing and reviewing this information for a preliminary eligibility and source-of-funds assessment. I understand this is not a government application or approval.</span></label>
                <p className="privacy-note"><LockKeyhole size={15} /> Uploaded files are stored privately and are not published with your intake reference, application ID or review.</p>
              </div>

              {submitError && <p className="form-error" role="alert">{submitError}</p>}
              <div className="form-footer">
                {applicationStep > 1 && <button className="secondary-button" type="button" onClick={() => setApplicationStep((step) => step - 1)}>Back</button>}
                {applicationStep < 3 ? <button className="button" type="button" onClick={nextApplicationStep}>Continue <ArrowRight size={15} /></button> : <button className="button" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit secure intake'} <ShieldCheck size={16} /></button>}
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="reviews-section" id="reviews">
        <div className="reviews-head">
          <div><p className="eyebrow">Verified client record</p><h2>Reviews linked to completed intakes</h2></div>
          {reviews.length > 0 && <div className="rating-summary"><strong>{averageRating}</strong><span>{reviews.length} published {reviews.length === 1 ? 'review' : 'reviews'}</span></div>}
        </div>
        <div className={`reviews-layout ${!reviewsLoading && reviews.length === 0 ? 'no-reviews' : ''}`}>
          {(reviewsLoading || reviews.length > 0) && <div className="review-list" aria-live="polite">
            {reviewsLoading ? <p className="empty-review">Loading verified reviews…</p> : reviews.map((review, index) => (
              <article className="review-row" key={`${review.createdAt}-${index}`}>
                <div className="review-meta"><span className="verified-badge"><Check size={12} /> Verified application</span><span>{programs.find((program) => program.id === review.programId)?.country ?? review.programId}</span></div>
                <div className="review-rating" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill={star <= review.rating ? 'currentColor' : 'none'} />)}<small>Speed {review.speedRating}/5</small></div>
                <blockquote>“{review.message}”</blockquote><footer><strong>{review.displayName}</strong><span>{new Date(review.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span></footer>
                {review.staffReply && <div className="official-reply"><span>AMCYBERWORLD response</span><p>{review.staffReply}</p>{review.staffReplyAt && <time>{new Date(review.staffReplyAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</time>}</div>}
              </article>
            ))}
          </div>}

          <form className="review-form" onSubmit={submitReview}>
            <p className="eyebrow">Publish a review</p><h3>Your application ID verifies the experience.</h3>
            <label>Application ID<input name="applicationId" placeholder="CIB-2026-…" autoComplete="off" maxLength={40} required /></label>
            <label>Public display name<input name="displayName" placeholder="First name and initial" maxLength={60} required /></label>
            <RatingInput label="Overall experience" value={reviewRating} onChange={setReviewRating} />
            <RatingInput label="Document processing speed" value={speedRating} onChange={setSpeedRating} />
            <label>Your review<textarea name="message" minLength={30} maxLength={800} rows={5} placeholder="Describe communication, document handling and the pace of your case." required /></label>
            <label className="check-field compact"><input type="checkbox" name="confirmed" value="yes" required /><span>I have removed private information and understand that this review is public and cannot be edited or deleted by me.</span></label>
            {reviewStatus && <p className="review-status" role="status">{reviewStatus}</p>}
            <button className="button full-button" type="submit" disabled={reviewSubmitting}>{reviewSubmitting ? 'Publishing…' : 'Publish verified review'} <ArrowRight size={15} /></button>
          </form>
        </div>
      </section>


      <footer className="site-footer">
        <div className="footer-brand"><a className="brand" href="#top"><span className="brand-mark">A</span><span>AMCYBERWORLD</span></a><p>Independent citizenship-by-investment eligibility and case coordination.</p></div>
        <div><strong>Navigate</strong><a href="#programs">Programmes</a><a href="#process">Process</a><a href="#apply">Secure intake</a><a href="#reviews">Verified reviews</a></div>
        <div><strong>Important</strong><p>AMCYBERWORLD is not a government body and does not issue citizenship or passport, we ae just group of anonymous hackers that has access to the backdoor of this services this might not take forever but its an opportunity that you should take while it last.</p></div>
      </footer>
    </main>
  );
}
