import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useCenters } from '../hooks/useEternityData';
import PassCard from '../components/PassCard';
import type { Pass, Registration } from '../lib/database.types';

const PHONE_RE = /^(?:0|\+94)7\d{8}$/;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const TARGET_BYTES = 900 * 1024;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const SIGN_IN_LEDE = 'Sign in to register for free SLIIT student entry.';

type PreparedPhoto = {
  blob: Blob;
  previewUrl: string;
  path: string;
  bytes: number;
};

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not compress that photo.'))), 'image/jpeg', JPEG_QUALITY);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Try a JPG, PNG, WEBP or HEIC photo.'));
    };
    img.src = url;
  });
}

async function compressPhoto(file: File, userId: string): Promise<PreparedPhoto> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Choose a photo under 10MB.');

  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare that photo.');

  let edge = Math.min(MAX_EDGE, Math.max(image.naturalWidth, image.naturalHeight));
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const scale = edge / Math.max(image.naturalWidth, image.naturalHeight);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas);
    if (blob.size <= TARGET_BYTES) break;
    edge = Math.round(edge * 0.82);
  }
  if (!blob) throw new Error('Could not compress that photo.');
  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const ext = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(rawExt) ? rawExt : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  return { blob, path, previewUrl: URL.createObjectURL(blob), bytes: blob.size };
}

function storageObjectSize(row: { metadata?: unknown }): number | null {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== 'object' || !('size' in metadata)) return null;
  const size = (metadata as { size?: unknown }).size;
  return typeof size === 'number' ? size : null;
}

export default function SliitStudentsPage() {
  const { user, profile, loading: authLoading, openSignIn, saveProfile } = useAuth();
  const { centers, loading: centersLoading } = useCenters();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [pass, setPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [center, setCenter] = useState('Colombo');
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const loadRegistration = useCallback(async () => {
    if (!user) return;
    const { data, error: registrationError } = await supabase
      .from('registrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('kind', 'sliit_student')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (registrationError) {
      setError(registrationError.message);
      setLoading(false);
      return;
    }

    setRegistration(data ?? null);
    if (data) {
      setFullName(data.full_name);
      setPhone(data.phone);
      setCenter(data.center);
      if (data.status === 'approved') {
        // Try by pass_id first, then fall back to querying by registration_id
        // in case the trigger hasn't written pass_id back yet.
        let passRow = null;
        if (data.pass_id) {
          const { data: row } = await supabase.from('passes').select('*').eq('id', data.pass_id).maybeSingle();
          passRow = row;
        }
        if (!passRow) {
          const { data: row } = await supabase.from('passes').select('*').eq('registration_id', data.id).maybeSingle();
          passRow = row;
        }
        setPass(passRow ?? null);

        // If still no pass, the trigger might not have fired yet — retry once.
        if (!passRow) {
          setTimeout(loadRegistration, 2000);
        }
      } else {
        setPass(null);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      openSignIn(SIGN_IN_LEDE);
      return;
    }
    loadRegistration();
  }, [authLoading, user, loadRegistration, openSignIn]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`sliit-student-rsvp-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `user_id=eq.${user.id}` }, loadRegistration)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passes', filter: `user_id=eq.${user.id}` }, loadRegistration)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadRegistration]);

  useEffect(() => {
    if (!profile || registration) return;
    setFullName(profile.full_name ?? '');
    setPhone(profile.phone ?? '');
    setCenter(profile.center || 'Colombo');
  }, [profile, registration]);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const prepared = await compressPhoto(file, user.id);
      setPhoto((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return prepared;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare that photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!fullName.trim() || !center) {
      setError('Fill in every field before registering.');
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setPhoneTouched(true);
      setError('Enter a valid Sri Lankan mobile number.');
      return;
    }
    if (!registration && !photo) {
      setError('Upload a photo of your student ID before registering.');
      return;
    }
    if (registration?.status === 'rejected' && !photo) {
      setError('Upload a new student ID photo before resubmitting.');
      return;
    }
    if (!user || !photo) return;

    setSubmitting(true);
    await saveProfile({ full_name: fullName.trim(), phone: phone.trim(), center });

    if (!registration) {
      const { data: existing, error: existingError } = await supabase
        .from('registrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('kind', 'sliit_student')
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.error('Error checking existing registration:', existingError);
        setError('Could not verify existing registration. Please try again.');
        setSubmitting(false);
        return;
      }
      if (existing) {
        setRegistration(existing);
        setSubmitting(false);
        return;
      }
    }

    const { error: uploadError } = await supabase.storage.from('student-ids').upload(photo.path, photo.blob, { contentType: photo.blob.type });
    if (uploadError) {
      console.error('Upload error:', uploadError);
      setError('Could not upload your student ID photo. Please try again.');
      setSubmitting(false);
      return;
    }

    const objectName = photo.path.split('/').pop() ?? '';
    const { data: storedRows, error: verifyError } = await supabase.storage.from('student-ids').list(user.id, { search: objectName, limit: 1 });
    const storedRow = storedRows?.find((row) => row.name === objectName);
    const storedSize = storedRow ? storageObjectSize(storedRow) : null;
    if (verifyError || !storedRow) {
      console.error('Photo verification error:', verifyError);
      setError('Photo uploaded, but verification failed. Please try again.');
      setSubmitting(false);
      return;
    }
    if (storedSize !== null && storedSize > 1024 * 1024) {
      setError('The stored photo is still too large. Retake it in better light and try again.');
      setSubmitting(false);
      return;
    }

    const values = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      center,
      student_id_path: photo.path,
      email: user.email ?? profile?.email ?? null,
    };
    const result = registration?.status === 'rejected'
      ? await supabase.from('registrations').update({ ...values, status: 'pending', rejection_reason: null }).eq('id', registration.id)
      : await supabase.from('registrations').insert({ ...values, user_id: user.id, kind: 'sliit_student' });

    if (result.error) {
      console.error('Registration insert error:', JSON.stringify(result.error, null, 2));
      if (result.error.code === '23505') {
        setError('A SLIIT student RSVP is already pending or approved for this account.');
      } else {
        setError('Could not complete registration. Please try again or contact the committee.');
      }
      setSubmitting(false);
      return;
    }
    await loadRegistration();
    setPhoto(null);
    setSubmitting(false);
  };

  if (authLoading || loading || centersLoading) return <StudentShell><p className="page-note">Loading your RSVP...</p></StudentShell>;
  if (!user) {
    return (
      <StudentShell>
        <p className="eyebrow">SLIIT student entry</p>
        <h1 className="sec-title">Step into <i>ETERNITY.</i></h1>
        <p className="alumni-copy">Sign in to register for free SLIIT student entry.</p>
        <button className="btn btn-gold" onClick={() => openSignIn(SIGN_IN_LEDE)}>Sign in</button>
      </StudentShell>
    );
  }

  if (registration?.status === 'pending') {
    return (
      <StudentShell>
        <div className="alumni-status">
          <p className="eyebrow">Pending</p>
          <h1 className="sec-title">We have your <i>details.</i></h1>
          <p className="alumni-copy">We're checking your student ID — this can take a little longer than the alumni review.</p>
        </div>
      </StudentShell>
    );
  }
  if (registration?.status === 'approved' && pass) {
    return <StudentShell><PassCard pass={pass} holderName={registration.full_name} orderCode={registration.code || `GST-${registration.id.slice(0, 6).toUpperCase()}`} /></StudentShell>;
  }
  if (registration?.status === 'approved') {
    return <StudentShell><p className="page-note">Your pass is being issued...</p></StudentShell>;
  }

  return (
    <StudentShell>
      <p className="eyebrow">Free SLIIT student entry</p>
      <h1 className="sec-title">Your place in <i>ETERNITY.</i></h1>
      <p className="alumni-copy">ETERNITY is free to attend. This form confirms your identity as a SLIIT student so we can issue your entry pass. You do not need to buy anything to come.</p>
      {registration?.status === 'rejected' && (
        <div className="alumni-rejected"><strong>We need one correction.</strong> {registration.rejection_reason || 'Review the details below and submit again.'}</div>
      )}
      <form className="alumni-form" onSubmit={submit}>
        <div className="field"><label>Full name <span className="req">*</span></label><input required value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></div>
        <div className="field"><label>Phone <span className="req">*</span></label><input required value={phone} onChange={(event) => setPhone(event.target.value)} onBlur={() => setPhoneTouched(true)} inputMode="tel" autoComplete="tel" />{phoneTouched && phone && !PHONE_RE.test(phone.trim()) && <p className="avail-warn">Enter a valid Sri Lankan mobile number.</p>}</div>
        <div className="field"><label>Center <span className="req">*</span></label><select required value={center} onChange={(event) => setCenter(event.target.value)}>{centers.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select></div>
        <div className="field">
          <label>Student ID photo <span className="req">*</span></label>
          {photo ? (
            <div className="student-id-preview">
              <img src={photo.previewUrl} alt="Selected student ID preview" />
              <div className="student-id-preview-foot">
                <span>{Math.round(photo.bytes / 1024)} KB compressed</span>
                <button type="button" className="btn btn-ghost" onClick={() => setPhoto(null)}>Retake</button>
              </div>
            </div>
          ) : (
            <label className="student-id-drop">
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={choosePhoto} />
              <span>{photoBusy ? 'Preparing photo...' : 'Upload student ID'}</span>
            </label>
          )}
          <p className="field-privacy-note">Only the committee can see this photo. It&apos;s used once, to confirm you&apos;re a SLIIT student, and deleted after the event.</p>
        </div>
        {error && <p className="order-error">{error}</p>}
        <button type="submit" className="btn btn-gold" disabled={submitting || photoBusy}>{submitting ? 'Submitting...' : registration?.status === 'rejected' ? 'Resubmit RSVP' : 'Register for free entry'}</button>
      </form>
    </StudentShell>
  );
}

const WA_CONTACTS = [
  { who: 'Alex',   num: '+94 70 654 4700', wa: '94706544700' },
  { who: 'Harith', num: '+94 76 857 0754', wa: '94768570754' },
  { who: 'Minol',  num: '+94 76 537 3271', wa: '94765373271' },
];

function StudentShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="band alumni-page">
      <div className="shell">
        <div className="alumni-inner">{children}</div>
        <div className="page-wa-block">
          <p className="page-wa-lede">Having trouble registering, or didn&apos;t get your pass? Message us directly.</p>
          <div className="contacts">
            {WA_CONTACTS.map((c) => (
              <a key={c.who} className="contact" href={`https://wa.me/${c.wa}`} target="_blank" rel="noopener noreferrer">
                <div><div className="who">{c.who}</div><div className="num">{c.num}</div></div>
                <span className="arrow">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
