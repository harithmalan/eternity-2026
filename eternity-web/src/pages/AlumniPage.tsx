import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useCenters } from '../hooks/useEternityData';
import PassCard from '../components/PassCard';
import type { Pass, Registration } from '../lib/database.types';

const NIC_RE = /^(?:\d{9}[VX]|\d{12})$/;
const PHONE_RE = /^(?:0|\+94)7\d{8}$/;
const ALUMNI_SIGN_IN_LEDE = 'Sign in to register for free alumni entry.';

function normalizeNic(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

export default function AlumniPage() {
  const { user, profile, loading: authLoading, openSignIn, saveProfile } = useAuth();
  const { centers, loading: centersLoading } = useCenters();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [pass, setPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nic, setNic] = useState('');
  const [center, setCenter] = useState('Colombo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nicTouched, setNicTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const loadRegistration = useCallback(async () => {
    if (!user) return;
    const { data, error: registrationError } = await supabase
      .from('registrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('kind', 'alumni_rsvp')
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
      setNic(data.nic);
      setCenter(data.center);
      if (data.status === 'approved' && data.pass_id) {
        const { data: passRow } = await supabase.from('passes').select('*').eq('id', data.pass_id).maybeSingle();
        setPass(passRow ?? null);
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
      openSignIn(ALUMNI_SIGN_IN_LEDE);
      return;
    }
    loadRegistration();
  }, [authLoading, user, loadRegistration, openSignIn]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`alumni-rsvp-${user.id}`)
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedNic = normalizeNic(nic);
    if (!fullName.trim() || !center) {
      setError('Fill in every field before registering.');
      return;
    }
    if (!normalizedNic) {
      setNicTouched(true);
      setError('Enter your NIC to register as an alumnus.');
      return;
    }
    if (!NIC_RE.test(normalizedNic)) {
      setNicTouched(true);
      setError('Enter a valid NIC - 9 digits + V/X, or 12 digits.');
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setPhoneTouched(true);
      setError('Enter a valid Sri Lankan mobile number.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    await saveProfile({ full_name: fullName.trim(), phone: phone.trim(), center });

    if (!registration) {
      const { data: existing, error: existingError } = await supabase
        .from('registrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('kind', 'alumni_rsvp')
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.error('Error checking existing registration:', existingError);
        setError('Could not verify existing RSVP. Please try again.');
        setSubmitting(false);
        return;
      }
      if (existing) {
        setRegistration(existing);
        if (existing.status === 'approved' && existing.pass_id) {
          const { data: passRow } = await supabase.from('passes').select('*').eq('id', existing.pass_id).maybeSingle();
          setPass(passRow ?? null);
        }
        setSubmitting(false);
        return;
      }
    }

    const values = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      nic: normalizedNic,
      center,
      email: user.email ?? profile?.email ?? null,
    };
    const result = registration?.status === 'rejected'
      ? await supabase.from('registrations').update({ ...values, status: 'pending', rejection_reason: null }).eq('id', registration.id)
      : await supabase.from('registrations').insert({ ...values, user_id: user.id, kind: 'alumni_rsvp' });

    if (result.error) {
      console.error('Registration insert error:', result.error);
      if (result.error.code === '23505') {
        setError('An RSVP for this alumnus is already pending or approved.');
      } else {
        setError('Could not complete registration. Please try again or contact the committee.');
      }
      setSubmitting(false);
      return;
    }
    await loadRegistration();
    setSubmitting(false);
  };

  if (authLoading || loading || centersLoading) return <AlumniShell><p className="page-note">Loading your RSVP...</p></AlumniShell>;
  if (!user) {
    return (
      <AlumniShell>
        <p className="eyebrow">Alumni entry</p>
        <h1 className="sec-title">Come back to <i>ETERNITY.</i></h1>
        <p className="alumni-copy">Sign in to register for free alumni entry.</p>
        <button className="btn btn-gold" onClick={() => openSignIn(ALUMNI_SIGN_IN_LEDE)}>Sign in</button>
      </AlumniShell>
    );
  }

  if (registration?.status === 'pending') {
    return <AlumniShell><RegistrationStatus /></AlumniShell>;
  }
  if (registration?.status === 'approved' && pass) {
    return <AlumniShell><PassCard pass={pass} holderName={registration.full_name} orderCode={registration.code || `ALM-${registration.id.slice(0, 6).toUpperCase()}`} /></AlumniShell>;
  }
  if (registration?.status === 'approved') {
    return <AlumniShell><p className="page-note">Your pass is being issued...</p></AlumniShell>;
  }

  return (
    <AlumniShell>
      <p className="eyebrow">Free alumni entry</p>
      <h1 className="sec-title">Your place in <i>ETERNITY.</i></h1>
      <p className="alumni-copy">ETERNITY is free to attend. This form confirms your identity as an SCU alumnus so we can issue your entry pass. You do not need to buy anything to come.</p>
      {registration?.status === 'rejected' && (
        <div className="alumni-rejected"><strong>We need one correction.</strong> {registration.rejection_reason || 'Review the details below and submit again.'}</div>
      )}
      <form className="alumni-form" onSubmit={submit}>
        <div className="field"><label>Full name <span className="req">*</span></label><input required value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></div>
        <div className="field"><label>Phone <span className="req">*</span></label><input required value={phone} onChange={(event) => setPhone(event.target.value)} onBlur={() => setPhoneTouched(true)} inputMode="tel" autoComplete="tel" />{phoneTouched && phone && !PHONE_RE.test(phone.trim()) && <p className="avail-warn">Enter a valid Sri Lankan mobile number.</p>}</div>
        <div className="field"><label>NIC <span className="req">*</span></label><input required value={nic} onChange={(event) => setNic(event.target.value)} onBlur={() => setNicTouched(true)} autoComplete="off" />{nicTouched && nic && !NIC_RE.test(normalizeNic(nic)) && <p className="avail-warn">Enter a valid NIC - 9 digits + V/X, or 12 digits.</p>}</div>
        <div className="field"><label>Center <span className="req">*</span></label><select required value={center} onChange={(event) => setCenter(event.target.value)}>{centers.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select></div>
        {error && <p className="order-error">{error}</p>}
        <button type="submit" className="btn btn-gold" disabled={submitting}>{submitting ? 'Submitting...' : registration?.status === 'rejected' ? 'Resubmit RSVP' : 'Register for free entry'}</button>
      </form>
    </AlumniShell>
  );
}

function AlumniShell({ children }: { children: React.ReactNode }) {
  return <section className="band alumni-page"><div className="shell alumni-inner">{children}</div></section>;
}

function RegistrationStatus() {
  return (
    <div className="alumni-status">
      <p className="eyebrow">Pending</p>
      <h1 className="sec-title">We have your <i>details.</i></h1>
      <p className="alumni-copy">We've got your details. The committee will review them within a day or two - check back here.</p>
    </div>
  );
}
