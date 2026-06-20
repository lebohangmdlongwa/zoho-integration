import React, { type FC, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';

const ZOHO_BLUE = '#2D6BDA';

interface FormProps {
  submiturl?: string;
  instanceid?: string;
  mode?: string;
  title?: string;
  subtitle?: string;
  submitlabel?: string;
  successmsg?: string;
  titlefontsize?: string;
  subtitlefontsize?: string;
  submitlabelfontsize?: string;
  primarycolor?: string;
  bgcolor?: string;
  headertextcolor?: string;
  usegradient?: string;
  gradstart?: string;
  gradend?: string;
  borderradius?: string;
  borderwidth?: string;
  formwidth?: string;
  fieldheight?: string;
  fieldgap?: string;
  compressedbgcolor?: string;
  compressedusegradient?: string;
  compressedgradend?: string;
  compressedfontsize?: string;
  compressedwidth?: string;
  compressedborderradius?: string;
  compressedborderwidth?: string;
}

function n(v: string | undefined, fallback: number): number {
  const parsed = Number(v);
  return isNaN(parsed) ? fallback : parsed;
}
function b(v: string | undefined): boolean {
  return v === 'true';
}

const Field: FC<{
  label: string;
  name: string;
  type: string;
  placeholder: string;
  required?: boolean;
  height: number;
  accentColor: string;
}> = ({ label, name, type, placeholder, required, height, accentColor }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <label style={{ fontSize: 10, fontWeight: 500, color: '#344054' }}>
      {label}{required ? ' *' : ''}
    </label>
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      required={!!required}
      style={{
        height, padding: '0 10px',
        border: '0.5px solid #d0d5dd',
        borderRadius: 6, fontSize: 13,
        boxSizing: 'border-box', outline: 'none',
        fontFamily: 'inherit', color: '#1f2836', width: '100%',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = accentColor;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${accentColor}22`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#d0d5dd';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  </div>
);

interface ExpandedFormProps extends FormProps {
  onClose?: () => void;
}

const ExpandedForm: FC<ExpandedFormProps> = (props) => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [btnLabel, setBtnLabel] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const primaryColor = props.primarycolor || ZOHO_BLUE;
  const bgColor = props.bgcolor || '#ffffff';
  const headerText = props.headertextcolor || '#101828';
  const useGradient = b(props.usegradient);
  const gradStart = props.gradstart || bgColor;
  const gradEnd = props.gradend || bgColor;
  const borderRadius = n(props.borderradius, 18);
  const borderWidth = n(props.borderwidth, 2);
  const formWidth = n(props.formwidth, 340);
  const fieldHeight = n(props.fieldheight, 36);
  const fieldGap = n(props.fieldgap, 12);
  const titleFontSize = n(props.titlefontsize, 14);
  const subtitleFontSize = n(props.subtitlefontsize, 10);
  const submitLabelFontSize = n(props.submitlabelfontsize, 13);
  const cardBg = useGradient
    ? `linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%)`
    : bgColor;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setStatus('submitting');
    setErrMsg('');
    const fd = new FormData(e.currentTarget);
    const fields: { label: string; value: string }[] = [];
    fd.forEach((val, key) => { if (val) fields.push({ label: key, value: String(val) }); });

    try {
      const res = await fetch(props.submiturl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: props.instanceid,
          fields,
          pageUrl: window.location.href,
        }),
      });

      if (res.status === 403) {
        setErrMsg('Zoho CRM is not connected. Please complete setup in the app dashboard.');
        setStatus('error');
        return;
      }

      let data: { success?: boolean; error?: string } = {};
      try { data = (await res.json()) as typeof data; } catch { /* non-JSON body */ }

      if (data.success) {
        formEl.reset();
        setBtnLabel(props.successmsg || "Thank you! We'll be in touch soon.");
        setStatus('success');
        setTimeout(() => { setStatus('idle'); setBtnLabel(''); }, 3000);
      } else {
        setErrMsg(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setErrMsg('Network error — could not reach the server. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      maxWidth: formWidth, width: '100%', boxSizing: 'border-box',
      borderRadius, border: borderWidth > 0 ? `${borderWidth}px solid #e8ecf1` : 'none',
      overflow: 'hidden', background: cardBg,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 10px', background: 'rgba(0,0,0,0.04)', borderBottom: '1px solid #e8ecf1', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: titleFontSize, fontWeight: 700, color: headerText }}>{props.title || 'Contact Us'}</div>
          <div style={{ fontSize: subtitleFontSize, color: headerText, opacity: 0.7, marginTop: 2 }}>{props.subtitle || 'Fill in your details below'}</div>
        </div>
        {props.onClose && (
          <button
            type="button"
            ref={(el) => { if (el && props.onClose) el.onclick = props.onClose; }}
            style={{ width: 27, height: 27, borderRadius: '50%', background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, marginLeft: 8 }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <line x1="1" y1="1" x2="10" y2="10" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="10" y1="1" x2="1" y2="10" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 14, background: '#fff' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: fieldGap }}>
          <Field label="First Name" name="firstname" type="text" placeholder="First name" height={fieldHeight} accentColor={primaryColor} />
          <Field label="Last Name" name="lastname" type="text" placeholder="Last name" height={fieldHeight} accentColor={primaryColor} />
          <Field label="Email" name="email" type="email" placeholder="your@email.com" height={fieldHeight} required accentColor={primaryColor} />
          <Field label="Phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" height={fieldHeight} accentColor={primaryColor} />

          {status === 'error' && (
            <div style={{ color: '#d92d20', fontSize: 12 }}>{errMsg}</div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting' || status === 'success'}
            style={{
              width: '100%', padding: '9px 0',
              background: status === 'success' ? '#3ba755' : primaryColor,
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: submitLabelFontSize, fontWeight: 600,
              cursor: status === 'submitting' || status === 'success' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: status === 'submitting' ? 0.6 : 1,
              transition: 'background 0.2s ease, opacity 0.15s',
            }}
          >
            {status === 'submitting' ? 'Submitting…' : btnLabel || props.submitlabel || 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
};

const ZohoFormWidget: FC<FormProps> = (props) => {
  const mode = props.mode || 'expanded';
  const [expanded, setExpanded] = useState(false);
  const [runtimeInstanceId, setRuntimeInstanceId] = useState(props.instanceid || '');
  const showPill = mode === 'compressed' && !expanded;

  useEffect(() => {
    if (props.instanceid) { setRuntimeInstanceId(props.instanceid); return; }
    try {
      // Wix injects window.Wix on all pages with installed apps
      const wix = (window as any).Wix;
      const id: string | undefined =
        wix?.Utils?.getInstanceId?.() ??
        wix?.Utils?.getInstance?.()?.instanceId;
      if (id) setRuntimeInstanceId(id);
    } catch { /* not in Wix context */ }
  }, [props.instanceid]);

  const runtimeSubmitUrl = props.submiturl || `${window.location.origin}/api/zoho/form-submit`;

  if (showPill) {
    const cUseGradient = b(props.compressedusegradient);
    const cBgColor = props.compressedbgcolor || ZOHO_BLUE;
    const cGradEnd = props.compressedgradend || cBgColor;
    const cFontSize = n(props.compressedfontsize, 11);
    const cWidth = n(props.compressedwidth, 340);
    const cRadius = n(props.compressedborderradius, 18);
    const cBorder = n(props.compressedborderwidth, 2);
    const headerText = props.headertextcolor || '#ffffff';
    const pillBg = cUseGradient
      ? `linear-gradient(135deg, ${cBgColor} 0%, ${cGradEnd} 100%)`
      : cBgColor;

    return (
      <div style={{ padding: '24px 28px 32px' }}>
        <div
          onClick={() => setExpanded(true)}
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            width: '100%', maxWidth: cWidth, height: 60,
            borderRadius: cRadius,
            border: cBorder > 0 ? `${cBorder}px solid #e8ecf1` : 'none',
            background: pillBg,
            boxShadow: '0 6px 20px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            cursor: 'pointer', boxSizing: 'border-box', padding: '0 18px', gap: 10,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          {/* Zoho CRM logo */}
          <svg width="22" height="22" viewBox="0 0 512 512" fill="none" style={{ flexShrink: 0 }}>
            <path fill="rgba(255,255,255,0.9)" d="M340.58,399.07a142.19,142.19,0,0,1-100.7-41.4h0l-78.73-78.79a48.34,48.34,0,0,1,34.21-82.57h.11a48.09,48.09,0,0,1,34.11,14.18l72.19,72.23a21.83,21.83,0,0,0,31.7-30q-.41-.44-.84-.84l-78.78-78.71A115.73,115.73,0,0,0,172,139.46h-.27a116.42,116.42,0,1,0,33.34,228.12,13.34,13.34,0,1,1,7.55,25.58h0a143.15,143.15,0,1,1-41-280.33H172a142.25,142.25,0,0,1,100.7,41.25h0l78.71,78.71a48.43,48.43,0,1,1-67.26,69.71c-.42-.41-.83-.82-1.23-1.24l-72.1-72A21.82,21.82,0,1,0,180,260.07l78.69,78.7a116.39,116.39,0,1,0,52.69-195.55c-1.38.34-2.74.74-4.12,1.15a13.33,13.33,0,1,1-8.43-25.3c.27-.09.55-.18.82-.25l5.07-1.43a143.11,143.11,0,1,1,35.9,281.68Z"/>
          </svg>
          <span style={{ fontSize: cFontSize, fontWeight: 600, color: headerText, lineHeight: 1.4 }}>
            Get in touch with us
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', width: '100%', boxSizing: 'border-box' }}>
      <ExpandedForm
        {...props}
        submiturl={runtimeSubmitUrl}
        instanceid={runtimeInstanceId}
        onClose={mode === 'compressed' ? () => setExpanded(false) : undefined}
      />
    </div>
  );
};

const ZohoFormElement = reactToWebComponent(
  ZohoFormWidget,
  React,
  ReactDOM as any,
  {
    props: {
      submiturl: 'string',
      instanceid: 'string',
      mode: 'string',
      title: 'string',
      subtitle: 'string',
      submitlabel: 'string',
      successmsg: 'string',
      titlefontsize: 'string',
      subtitlefontsize: 'string',
      submitlabelfontsize: 'string',
      primarycolor: 'string',
      bgcolor: 'string',
      headertextcolor: 'string',
      usegradient: 'string',
      gradstart: 'string',
      gradend: 'string',
      borderradius: 'string',
      borderwidth: 'string',
      formwidth: 'string',
      fieldheight: 'string',
      fieldgap: 'string',
      compressedbgcolor: 'string',
      compressedusegradient: 'string',
      compressedgradend: 'string',
      compressedfontsize: 'string',
      compressedwidth: 'string',
      compressedborderradius: 'string',
      compressedborderwidth: 'string',
    },
  },
);

export default ZohoFormElement;
