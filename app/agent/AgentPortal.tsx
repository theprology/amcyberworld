'use client';

import {
  Check,
  ClipboardCopy,
  Download,
  LogIn,
  MessageSquareReply,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

type AgentApplication = {
  intakeReference: string;
  applicationId: string | null;
  programId: string;
  givenName: string;
  familyName: string;
  email: string;
  phone: string;
  nationality: string;
  residenceCountry: string;
  otherNationalities: string;
  familySize: number;
  availableFunds: string;
  timeline: string;
  occupation: string;
  sourceOfFunds: string;
  complianceAnswers: string;
  proofFileName: string;
  status: 'submitted' | 'accepted';
  createdAt: number;
};

type AgentReview = {
  id: number;
  applicationId: string;
  programId: string;
  displayName: string;
  rating: number;
  speedRating: number;
  message: string;
  staffReply: string | null;
  staffReplyAt: number | null;
  createdAt: number;
};

type DeskView = 'submitted' | 'accepted' | 'reviews';

const programNames: Record<string, string> = {
  antigua: 'Antigua & Barbuda',
  dominica: 'Dominica',
  grenada: 'Grenada',
  'st-kitts': 'St. Kitts & Nevis',
  'st-lucia': 'Saint Lucia',
  turkiye: 'Turkiye',
};

export default function AgentPortal() {
  const [accessCode, setAccessCode] = useState('');
  const [applications, setApplications] = useState<AgentApplication[]>([]);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<DeskView>('submitted');
  const [workingKey, setWorkingKey] = useState('');
  const [editingReference, setEditingReference] = useState('');
  const [editDraft, setEditDraft] = useState<AgentApplication | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [reviewEditDraft, setReviewEditDraft] = useState<AgentReview | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});

  const visibleApplications = useMemo(
    () => applications.filter((application) => application.status === view),
    [applications, view],
  );

  async function loadWorkspace(code = accessCode) {
    setLoading(true);
    setError('');
    try {
      const headers = { 'x-agent-code': code };
      const [applicationsResponse, reviewsResponse] = await Promise.all([
        fetch('/api/agent/applications', { headers, cache: 'no-store' }),
        fetch('/api/agent/reviews', { headers, cache: 'no-store' }),
      ]);
      const applicationsPayload = await applicationsResponse.json();
      const reviewsPayload = await reviewsResponse.json();
      if (!applicationsResponse.ok) throw new Error(applicationsPayload.error || 'Agent access failed.');
      if (!reviewsResponse.ok) throw new Error(reviewsPayload.error || 'Reviews could not be loaded.');

      const loadedReviews = Array.isArray(reviewsPayload.reviews) ? reviewsPayload.reviews : [];
      setApplications(Array.isArray(applicationsPayload.applications) ? applicationsPayload.applications : []);
      setReviews(loadedReviews);
      setReplyDrafts(Object.fromEntries(loadedReviews.map((review: AgentReview) => [review.id, review.staffReply ?? ''])));
      setAuthenticated(true);
    } catch (requestError) {
      setAuthenticated(false);
      setError(requestError instanceof Error ? requestError.message : 'Agent access failed.');
    } finally {
      setLoading(false);
    }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadWorkspace();
  }

  async function acceptApplication(intakeReference: string) {
    setWorkingKey(intakeReference);
    setError('');
    try {
      const response = await fetch('/api/agent/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-code': accessCode },
        body: JSON.stringify({ intakeReference }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The intake could not be accepted.');
      setApplications((current) => current.map((application) => (
        application.intakeReference === intakeReference
          ? { ...application, status: 'accepted', applicationId: payload.applicationId }
          : application
      )));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The intake could not be accepted.');
    } finally {
      setWorkingKey('');
    }
  }

  function beginEditing(application: AgentApplication) {
    setEditingReference(application.intakeReference);
    setEditDraft({ ...application });
    setError('');
  }

  function updateDraft<K extends keyof AgentApplication>(field: K, value: AgentApplication[K]) {
    setEditDraft((current) => current ? { ...current, [field]: value } : current);
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editDraft) return;
    setWorkingKey(editDraft.intakeReference);
    setError('');
    try {
      const response = await fetch('/api/agent/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-agent-code': accessCode },
        body: JSON.stringify(editDraft),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The application could not be updated.');
      setApplications((current) => current.map((application) => (
        application.intakeReference === editDraft.intakeReference
          ? { ...application, ...payload.application }
          : application
      )));
      setReviews((current) => current.map((review) => (
        review.applicationId === editDraft.applicationId ? { ...review, programId: editDraft.programId } : review
      )));
      setEditingReference('');
      setEditDraft(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The application could not be updated.');
    } finally {
      setWorkingKey('');
    }
  }

  async function deleteApplication(application: AgentApplication) {
    const confirmed = window.confirm(`Permanently delete ${application.givenName} ${application.familyName}'s application, proof file and linked review?`);
    if (!confirmed) return;

    setWorkingKey(application.intakeReference);
    setError('');
    try {
      const response = await fetch('/api/agent/applications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-agent-code': accessCode },
        body: JSON.stringify({ intakeReference: application.intakeReference }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The application could not be deleted.');
      setApplications((current) => current.filter((item) => item.intakeReference !== application.intakeReference));
      setReviews((current) => current.filter((review) => review.applicationId !== application.applicationId));
      if (editingReference === application.intakeReference) {
        setEditingReference('');
        setEditDraft(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The application could not be deleted.');
    } finally {
      setWorkingKey('');
    }
  }

  async function saveReply(reviewId: number, clear = false) {
    const reply = clear ? '' : (replyDrafts[reviewId] ?? '').trim();
    setWorkingKey(`review-${reviewId}`);
    setError('');
    try {
      const response = await fetch('/api/agent/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-agent-code': accessCode },
        body: JSON.stringify({ action: 'reply', reviewId, reply }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The reply could not be saved.');
      setReviews((current) => current.map((review) => (
        review.id === reviewId
          ? { ...review, staffReply: payload.staffReply, staffReplyAt: payload.staffReplyAt }
          : review
      )));
      if (clear) setReplyDrafts((current) => ({ ...current, [reviewId]: '' }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The reply could not be saved.');
    } finally {
      setWorkingKey('');
    }
  }

  function beginReviewEditing(review: AgentReview) {
    setEditingReviewId(review.id);
    setReviewEditDraft({ ...review });
    setError('');
  }

  function updateReviewDraft<K extends keyof AgentReview>(field: K, value: AgentReview[K]) {
    setReviewEditDraft((current) => current ? { ...current, [field]: value } : current);
  }

  async function saveReviewEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewEditDraft) return;
    setWorkingKey(`review-${reviewEditDraft.id}`);
    setError('');
    try {
      const response = await fetch('/api/agent/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-agent-code': accessCode },
        body: JSON.stringify({
          action: 'edit',
          reviewId: reviewEditDraft.id,
          displayName: reviewEditDraft.displayName,
          rating: reviewEditDraft.rating,
          speedRating: reviewEditDraft.speedRating,
          message: reviewEditDraft.message,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The review could not be updated.');
      setReviews((current) => current.map((review) => (
        review.id === reviewEditDraft.id ? { ...review, ...payload.review } : review
      )));
      setEditingReviewId(null);
      setReviewEditDraft(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The review could not be updated.');
    } finally {
      setWorkingKey('');
    }
  }

  async function deleteReview(review: AgentReview) {
    if (!window.confirm(`Permanently remove ${review.displayName}'s review from the website?`)) return;
    setWorkingKey(`review-${review.id}`);
    setError('');
    try {
      const response = await fetch('/api/agent/reviews', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-agent-code': accessCode },
        body: JSON.stringify({ reviewId: review.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The review could not be deleted.');
      setReviews((current) => current.filter((item) => item.id !== review.id));
      if (editingReviewId === review.id) {
        setEditingReviewId(null);
        setReviewEditDraft(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The review could not be deleted.');
    } finally {
      setWorkingKey('');
    }
  }

  async function downloadProof(application: AgentApplication) {
    setWorkingKey(application.intakeReference);
    setError('');
    try {
      const response = await fetch(`/api/agent/proof?intakeReference=${encodeURIComponent(application.intakeReference)}`, {
        headers: { 'x-agent-code': accessCode },
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'The proof file could not be downloaded.');
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = application.proofFileName;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The proof file could not be downloaded.');
    } finally {
      setWorkingKey('');
    }
  }

  if (!authenticated) {
    return (
      <main className="agent-shell agent-login-shell">
        <section className="agent-login">
          <Link className="brand" href="/"><span className="brand-mark">A</span><span>AMCYBERWORLD</span></Link>
          <span className="agent-shield"><ShieldCheck size={28} /></span>
          <p className="eyebrow">Staff access</p>
          <h1>Application management desk</h1>
          <p>Enter the staff access code to review, edit and accept applications or respond to published reviews.</p>
          <form onSubmit={signIn}>
            <label>Staff access code<input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="current-password" required /></label>
            {error && <p className="agent-error" role="alert">{error}</p>}
            <button className="button" type="submit" disabled={loading}>{loading ? 'Checking...' : 'Open management desk'} <LogIn size={16} /></button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="agent-shell">
      <header className="agent-header">
        <Link className="brand" href="/"><span className="brand-mark">A</span><span>AMCYBERWORLD</span></Link>
        <div><span className="agent-online"><Check size={12} /> Staff verified</span><button type="button" onClick={() => loadWorkspace()} title="Refresh desk" disabled={loading}><RefreshCw size={17} /></button></div>
      </header>

      <section className="agent-workspace">
        <div className="agent-title-row">
          <div><p className="eyebrow">Staff management desk</p><h1>Manage applications and client replies.</h1></div>
          <div className="agent-count"><strong>{applications.filter((application) => application.status === 'submitted').length}</strong><span>awaiting review</span></div>
        </div>

        <div className="agent-tabs" role="tablist" aria-label="Management view">
          <button type="button" role="tab" aria-selected={view === 'submitted'} className={view === 'submitted' ? 'active' : ''} onClick={() => setView('submitted')}>Pending</button>
          <button type="button" role="tab" aria-selected={view === 'accepted'} className={view === 'accepted' ? 'active' : ''} onClick={() => setView('accepted')}>Accepted</button>
          <button type="button" role="tab" aria-selected={view === 'reviews'} className={view === 'reviews' ? 'active' : ''} onClick={() => setView('reviews')}>Reviews</button>
        </div>

        {error && <p className="agent-error agent-workspace-error" role="alert">{error}</p>}

        {view === 'reviews' ? (
          <div className="agent-list">
            {reviews.length === 0 ? <p className="agent-empty">No published reviews.</p> : reviews.map((review) => (
              <article className="agent-review" key={review.id}>
                <div className="agent-review-head">
                  <div><span>{review.applicationId}</span><h2>{review.displayName}</h2><p>{programNames[review.programId] ?? review.programId} / {new Date(review.createdAt).toLocaleDateString()}</p></div>
                  <span className="agent-review-rating">{review.rating}/5 overall / {review.speedRating}/5 speed</span>
                </div>
                {editingReviewId === review.id && reviewEditDraft ? (
                  <form className="agent-edit-form" onSubmit={saveReviewEdit}>
                    <div className="agent-edit-grid agent-review-edit-grid">
                      <label>Display name<input value={reviewEditDraft.displayName} minLength={2} maxLength={60} onChange={(event) => updateReviewDraft('displayName', event.target.value)} required /></label>
                      <label>Overall rating<input type="number" min={1} max={5} value={reviewEditDraft.rating} onChange={(event) => updateReviewDraft('rating', Number(event.target.value))} required /></label>
                      <label>Speed rating<input type="number" min={1} max={5} value={reviewEditDraft.speedRating} onChange={(event) => updateReviewDraft('speedRating', Number(event.target.value))} required /></label>
                      <label className="wide review-message-field">Customer review<textarea rows={5} minLength={30} maxLength={800} value={reviewEditDraft.message} onChange={(event) => updateReviewDraft('message', event.target.value)} required /></label>
                    </div>
                    <div className="agent-actions">
                      <button className="secondary-button" type="button" onClick={() => { setEditingReviewId(null); setReviewEditDraft(null); }}>Cancel <X size={15} /></button>
                      <button className="button" type="submit" disabled={workingKey === `review-${review.id}`}>Save review <Save size={16} /></button>
                    </div>
                  </form>
                ) : (
                  <>
                    <blockquote>{review.message}</blockquote>
                    <label className="agent-reply-field">Official AMCYBERWORLD reply<textarea rows={4} maxLength={1000} value={replyDrafts[review.id] ?? ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Write the public response that will appear below this review." /></label>
                    <div className="agent-actions">
                      <button className="secondary-button" type="button" onClick={() => beginReviewEditing(review)} disabled={workingKey === `review-${review.id}`}>Edit review <Pencil size={15} /></button>
                      <button className="secondary-button danger-text" type="button" onClick={() => deleteReview(review)} disabled={workingKey === `review-${review.id}`}>Delete review <Trash2 size={15} /></button>
                      {review.staffReply && <button className="secondary-button danger-text" type="button" onClick={() => saveReply(review.id, true)} disabled={workingKey === `review-${review.id}`}>Remove reply <X size={15} /></button>}
                      <button className="button" type="button" onClick={() => saveReply(review.id)} disabled={workingKey === `review-${review.id}` || !(replyDrafts[review.id] ?? '').trim()}>Publish reply <MessageSquareReply size={16} /></button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="agent-list">
            {visibleApplications.length === 0 ? <p className="agent-empty">No {view} intakes.</p> : visibleApplications.map((application) => (
              <article className="agent-application" key={application.intakeReference}>
                <div className="agent-application-head">
                  <div><span>{application.intakeReference}</span><h2>{application.givenName} {application.familyName}</h2><p>{programNames[application.programId] ?? application.programId} / {application.nationality}</p></div>
                  <span className={`agent-status ${application.status}`}>{application.status}</span>
                </div>

                {editingReference === application.intakeReference && editDraft ? (
                  <form className="agent-edit-form" onSubmit={saveApplication}>
                    <div className="agent-edit-grid">
                      <label>Program<select value={editDraft.programId} onChange={(event) => updateDraft('programId', event.target.value)}>{Object.entries(programNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
                      <label>Given name<input value={editDraft.givenName} maxLength={80} onChange={(event) => updateDraft('givenName', event.target.value)} required /></label>
                      <label>Family name<input value={editDraft.familyName} maxLength={80} onChange={(event) => updateDraft('familyName', event.target.value)} required /></label>
                      <label>Email<input type="email" value={editDraft.email} maxLength={160} onChange={(event) => updateDraft('email', event.target.value)} required /></label>
                      <label>Phone<input value={editDraft.phone} maxLength={40} onChange={(event) => updateDraft('phone', event.target.value)} required /></label>
                      <label>Nationality<input value={editDraft.nationality} maxLength={100} onChange={(event) => updateDraft('nationality', event.target.value)} required /></label>
                      <label>Residence country<input value={editDraft.residenceCountry} maxLength={100} onChange={(event) => updateDraft('residenceCountry', event.target.value)} required /></label>
                      <label>Other nationalities<input value={editDraft.otherNationalities} maxLength={160} onChange={(event) => updateDraft('otherNationalities', event.target.value)} /></label>
                      <label>Family size<input type="number" min={1} max={20} value={editDraft.familySize} onChange={(event) => updateDraft('familySize', Number(event.target.value))} required /></label>
                      <label>Available funds<input value={editDraft.availableFunds} maxLength={40} onChange={(event) => updateDraft('availableFunds', event.target.value)} required /></label>
                      <label>Timeline<input value={editDraft.timeline} maxLength={40} onChange={(event) => updateDraft('timeline', event.target.value)} required /></label>
                      <label>Occupation<input value={editDraft.occupation} maxLength={120} onChange={(event) => updateDraft('occupation', event.target.value)} required /></label>
                      <label className="wide">Source of funds<input value={editDraft.sourceOfFunds} maxLength={120} onChange={(event) => updateDraft('sourceOfFunds', event.target.value)} required /></label>
                    </div>
                    <div className="agent-actions">
                      <button className="secondary-button" type="button" onClick={() => { setEditingReference(''); setEditDraft(null); }}>Cancel <X size={15} /></button>
                      <button className="button" type="submit" disabled={workingKey === application.intakeReference}>Save changes <Save size={16} /></button>
                    </div>
                  </form>
                ) : (
                  <>
                    <dl>
                      <div><dt>Contact</dt><dd>{application.email}<br />{application.phone}</dd></div>
                      <div><dt>Residence</dt><dd>{application.residenceCountry}</dd></div>
                      <div><dt>Family</dt><dd>{application.familySize} applicant{application.familySize === 1 ? '' : 's'}</dd></div>
                      <div><dt>Funds</dt><dd>{application.availableFunds}</dd></div>
                      <div><dt>Source</dt><dd>{application.sourceOfFunds}</dd></div>
                      <div><dt>Timeline</dt><dd>{application.timeline}</dd></div>
                      <div><dt>Occupation</dt><dd>{application.occupation}</dd></div>
                      <div><dt>Submitted</dt><dd>{new Date(application.createdAt).toLocaleString()}</dd></div>
                    </dl>

                    {application.applicationId && <div className="issued-id"><span>Issued application ID</span><strong>{application.applicationId}</strong><button type="button" onClick={() => navigator.clipboard.writeText(application.applicationId!)} title="Copy application ID"><ClipboardCopy size={16} /></button></div>}

                    <div className="agent-actions agent-management-actions">
                      <button className="secondary-button" type="button" onClick={() => downloadProof(application)} disabled={workingKey === application.intakeReference}>Proof of funds <Download size={15} /></button>
                      <button className="secondary-button" type="button" onClick={() => beginEditing(application)} disabled={workingKey === application.intakeReference}>Edit <Pencil size={15} /></button>
                      <button className="secondary-button danger-text" type="button" onClick={() => deleteApplication(application)} disabled={workingKey === application.intakeReference}>Delete <Trash2 size={15} /></button>
                      {application.status === 'submitted' && <button className="button" type="button" onClick={() => acceptApplication(application.intakeReference)} disabled={workingKey === application.intakeReference}>Accept and generate ID <UserCheck size={16} /></button>}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
