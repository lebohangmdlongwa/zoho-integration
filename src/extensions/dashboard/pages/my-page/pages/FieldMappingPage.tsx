import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';

const APP_DEFINITION_ID = '1742b6a3-e4ad-4381-a2bc-961133180800';

function openEditor(url: string | undefined | null) {
  if (!url) return;
  try {
    const u = new URL(url);
    u.searchParams.set('appDefinitionId', APP_DEFINITION_ID);
    window.open(u.toString(), '_blank');
  } catch {
    window.open(url, '_blank');
  }
}
import { httpClient } from '@wix/essentials';
import {
  AutoComplete,
  Box,
  Button,
  Card,
  Cell,
  Divider,
  Dropdown,
  EmptyState,
  Layout,
  Loader,
  Text,
  Tooltip,
} from '@wix/design-system';
import { PremiumFilled } from '@wix/wix-ui-icons-common';

import type { FieldType } from './fieldDefs';
import {
  ZOHO_FIELD_DEFS,
  WIX_FIELD_DEFS,
  getZohoFieldOptions,
  getWixFieldOptions,
} from './fieldDefs';

function checkTypeCompatibility(wixField: string, zohoProp: string): string | null {
  if (!wixField || !zohoProp) return null;

  const wixDef = WIX_FIELD_DEFS.find((f) => f.id === wixField);
  const zDef = ZOHO_FIELD_DEFS.find((f) => f.id === zohoProp);

  const wixType: FieldType = wixDef?.type ?? 'custom';
  const zType: FieldType = zDef?.type ?? 'custom';
  if (wixType === 'custom' || zType === 'custom') return null;

  const wixLabel = wixDef?.label ?? wixField;
  const zLabel = zDef?.label ?? zohoProp;

  if (wixType === 'email' && zType !== 'email') {
    return `"${wixLabel}" is an email field — it can only map to an email Zoho field (e.g. Email), not "${zLabel}".`;
  }
  if (zType === 'email' && wixType !== 'email') {
    return `"${zLabel}" is an email field — it can only map to a Wix email field, not "${wixLabel}".`;
  }
  if (wixType === 'date' && zType !== 'date') {
    return `"${wixLabel}" is a date field — it cannot map to "${zLabel}" which is not a date field.`;
  }
  if (zType === 'date' && wixType !== 'date') {
    return `"${zLabel}" is a date field — it cannot map to "${wixLabel}" which is not a date field.`;
  }
  if (wixType === 'number' && zType !== 'number') {
    return `"${wixLabel}" is a numeric field — it cannot map to "${zLabel}" which is not a number field.`;
  }
  if (zType === 'number' && wixType !== 'number') {
    return `"${zLabel}" is a number field — it cannot map to "${wixLabel}" which is not a numeric field.`;
  }

  const phoneCompatible: FieldType[] = ['phone', 'text', 'name'];
  if (wixType === 'phone' && !phoneCompatible.includes(zType)) {
    return `"${wixLabel}" is a phone field — mapping it to "${zLabel}" (${zType}) will likely cause sync errors.`;
  }
  if (zType === 'phone' && !phoneCompatible.includes(wixType)) {
    return `"${zLabel}" is a phone field — mapping it to "${wixLabel}" (${wixType}) will likely cause sync errors.`;
  }

  return null;
}

type RowError = { message: string; field: 'wix' | 'hs' | 'both' } | null;

function computeRowErrors(mappings: FieldMapping[]): RowError[] {
  const typeErrors = mappings.map((m) =>
    checkTypeCompatibility(m.wixField, m.zohoProp),
  );

  const zohoPropCounts = new Map<string, number>();
  for (const m of mappings) {
    if (m.zohoProp) {
      zohoPropCounts.set(m.zohoProp, (zohoPropCounts.get(m.zohoProp) ?? 0) + 1);
    }
  }

  return mappings.map((m, i) => {
    if (typeErrors[i]) return { message: typeErrors[i]!, field: 'both' };
    if (m.zohoProp && (zohoPropCounts.get(m.zohoProp) ?? 0) > 1) {
      const zLabel = ZOHO_FIELD_DEFS.find((f) => f.id === m.zohoProp)?.label ?? m.zohoProp;
      return {
        message: `"${zLabel}" is mapped in multiple rows — this will cause unpredictable sync behavior.`,
        field: 'hs',
      };
    }
    return null;
  });
}

const ALL_DIRECTION_OPTIONS = [
  { id: 'bidirectional',  value: 'Bidirectional ↔' },
  { id: 'wix_to_zoho',   value: 'Wix → Zoho' },
  { id: 'zoho_to_wix',   value: 'Zoho → Wix' },
];

const FREE_LOCKED_IDS = new Set(['bidirectional', 'wix_to_zoho']);

const TRANSFORM_OPTIONS = [
  { id: 'none',      value: 'None' },
  { id: 'trim',      value: 'Trim' },
  { id: 'lowercase', value: 'Lowercase' },
  { id: 'uppercase', value: 'Uppercase' },
];

const DEFAULT_ROW: FieldMapping = {
  wixField: '',
  zohoProp: '',
  direction: 'bidirectional',
  transform: 'none',
};

const SkeletonRow: FC = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.2fr 1fr 40px', gap: 12, padding: '14px 4px' }}>
    {[1, 2, 3, 4].map((k) => (
      <div
        key={k}
        style={{
          height: 32,
          borderRadius: 6,
          background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
          backgroundSize: '400px 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    ))}
    <div />
  </div>
);

const SavedBadge: FC = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: '#f0faf3', border: '1px solid #b6e6c3' }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#3ba755">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
    <Text size="tiny">
      <span style={{ color: '#3ba755', fontWeight: 600 }}>Saved</span>
    </Text>
  </div>
);

const fieldLabel = (path: string) => {
  const predefined = WIX_FIELD_DEFS.find((f) => f.id === path);
  if (predefined) return predefined.label;
  if (path.startsWith('extendedFields.custom.'))
    return `Custom: ${path.replace('extendedFields.custom.', '')}`;
  return path;
};

interface FieldMappingPageProps {
  onMappingsSaved?: () => void;
  editorUrl?: string | null;
  isPremium?: boolean;
  upgradeUrl?: string;
}

const FieldMappingPage: FC<FieldMappingPageProps> = ({
  onMappingsSaved,
  editorUrl,
  isPremium = false,
  upgradeUrl,
}) => {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [wixDisplays, setWixDisplays] = useState<string[]>([]);
  const [zohoDisplays, setZohoDisplays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState('Saving…');
  const [saved, setSaved] = useState(false);
  const [provisionErrors, setProvisionErrors] = useState<string[]>([]);
  const [showEditorPrompt, setShowEditorPrompt] = useState(false);

  const directionOptions = useMemo(() =>
    isPremium
      ? ALL_DIRECTION_OPTIONS
      : ALL_DIRECTION_OPTIONS.map((opt) =>
          FREE_LOCKED_IDS.has(opt.id) ? { ...opt, disabled: true } : opt,
        ),
  [isPremium]);

  const rowErrors = useMemo((): RowError[] => {
    const base = computeRowErrors(mappings);
    return base.map((err, i) => {
      if (err) return err;
      const m = mappings[i];
      if (m.wixField && !WIX_FIELD_DEFS.find((f) => f.id === m.wixField)) {
        return {
          message: `"${wixDisplays[i] || m.wixField}" is not a recognised Wix field — please select one from the list.`,
          field: 'wix',
        };
      }
      if (m.zohoProp && !ZOHO_FIELD_DEFS.find((f) => f.id === m.zohoProp)) {
        return {
          message: `"${zohoDisplays[i] || m.zohoProp}" is not a recognised Zoho CRM field — please select one from the list.`,
          field: 'hs',
        };
      }
      return null;
    });
  }, [mappings, wixDisplays, zohoDisplays]);

  const errorCount = useMemo(() => rowErrors.filter(Boolean).length, [rowErrors]);
  const hasErrors = errorCount > 0;

  const wixStatus = (i: number) =>
    (rowErrors[i] && rowErrors[i]!.field !== 'hs' ? 'error' : undefined) as 'error' | undefined;
  const zohoStatus = (i: number) =>
    (rowErrors[i] && rowErrors[i]!.field !== 'wix' ? 'error' : undefined) as 'error' | undefined;

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await httpClient
        .fetchWithAuth('/api/zoho/field-mapping')
        .then((r) => r.json());
      let fetched: FieldMapping[] = data.mappings ?? [];
      if (!isPremium) {
        fetched = fetched.map((m) =>
          FREE_LOCKED_IDS.has(m.direction)
            ? { ...m, direction: 'zoho_to_wix' as FieldMapping['direction'] }
            : m,
        );
      }
      setMappings(fetched);
      setWixDisplays(fetched.map((m) => fieldLabel(m.wixField)));
      setZohoDisplays(
        fetched.map((m) => {
          const found = ZOHO_FIELD_DEFS.find((f) => f.id === m.zohoProp);
          return found ? found.label : m.zohoProp;
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [isPremium]);

  useEffect(() => { void fetchMappings(); }, [fetchMappings]);

  const addRow = () => {
    const defaultDirection = isPremium ? 'bidirectional' : 'zoho_to_wix';
    setMappings((prev) => [...prev, { ...DEFAULT_ROW, direction: defaultDirection }]);
    setWixDisplays((prev) => [...prev, '']);
    setZohoDisplays((prev) => [...prev, '']);
  };

  const update = (i: number, patch: Partial<FieldMapping>) =>
    setMappings((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const updateWixDisplay = (i: number, text: string) =>
    setWixDisplays((prev) => prev.map((d, idx) => (idx === i ? text : d)));

  const updateZohoDisplay = (i: number, text: string) =>
    setZohoDisplays((prev) => prev.map((d, idx) => (idx === i ? text : d)));

  const remove = (i: number) => {
    setMappings((prev) => prev.filter((_, idx) => idx !== i));
    setWixDisplays((prev) => prev.filter((_, idx) => idx !== i));
    setZohoDisplays((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (hasErrors) return;
    setSaving(true);
    setProvisionErrors([]);

    try {
      setSavingLabel('Creating custom fields…');
      const ensureRes = await httpClient.fetchWithAuth('/api/zoho/ensure-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      });
      const ensureData = (await ensureRes.json()) as {
        mappings: FieldMapping[];
        provisioned: string[];
        errors: string[];
      };

      if (ensureData.errors?.length) {
        setProvisionErrors(ensureData.errors);
      }

      const normalized: FieldMapping[] = ensureData.mappings ?? mappings;
      setMappings(normalized);
      setWixDisplays(normalized.map((m) => fieldLabel(m.wixField)));
      setZohoDisplays(
        normalized.map((m) => {
          const found = ZOHO_FIELD_DEFS.find((f) => f.id === m.zohoProp);
          return found ? found.label : m.zohoProp;
        }),
      );

      setSavingLabel('Saving…');
      await httpClient.fetchWithAuth('/api/zoho/field-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: normalized }),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      const alreadyMapped = (() => { try { return localStorage.getItem('zoho_fields_mapped') === '1'; } catch { return false; } })();
      try { localStorage.setItem('zoho_fields_mapped', '1'); } catch { /* ignore */ }
      onMappingsSaved?.();
      if (!alreadyMapped) setShowEditorPrompt(true);
    } finally {
      setSaving(false);
      setSavingLabel('Saving…');
    }
  };

  return (
    <div style={{ padding: '20px 32px', background: '#f4f5f7', minHeight: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        [data-hook="dropdownLayout-wrapper"]{overflow-x:hidden !important;}
        [data-hook="dropdownLayout-item"],[data-hook="dropdownLayout-item"] *{white-space:normal !important;word-break:break-word !important;height:auto !important;min-height:36px !important;line-height:1.4 !important;}
      `}</style>
      <Layout>
        {/* Info banner */}
        <Cell span={12}>
          <div style={{ background: '#fff3ee', border: '1px solid #ffd4c2', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF7A59" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            <div>
              <Text size="small" weight="bold">About Field Mapping</Text>
              <div style={{ marginTop: 4 }}>
                <Text size="small" secondary>
                  Map Wix contact fields to Zoho CRM fields. Choose a sync direction and optional
                  transform for each row. Select from the suggested fields or type a custom field
                  name. Changes only take effect after saving.
                </Text>
              </div>
            </div>
          </div>
        </Cell>

        {/* Provision errors */}
        {provisionErrors.length > 0 && (
          <Cell span={12}>
            <div style={{ background: '#fff8f8', border: '1px solid #f5c6c6', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#d63b3b" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <div>
                <Text size="small" weight="bold">Some custom fields could not be created</Text>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {provisionErrors.map((e, i) => (
                    <Text key={i} size="small" secondary>{e}</Text>
                  ))}
                </div>
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#fff8f8', border: '1px solid #f5c6c6' }}>
                  <Text size="tiny" secondary>
                    <span style={{ color: '#6b7280' }}>
                      For Zoho CRM custom fields, use the API name found in{' '}
                      <strong>Zoho CRM → Setup → Fields</strong> (e.g.{' '}
                      <code>Custom_Field__c</code>). For Wix custom fields use the path format{' '}
                      <code>extendedFields.custom.myField</code>.
                    </span>
                  </Text>
                </div>
              </div>
            </div>
          </Cell>
        )}

        {/* Mapping table card */}
        <Cell span={12}>
          <Card>
            <Card.Header
              title="Field Mapping"
              subtitle={loading ? '' : `${mappings.length} mapping${mappings.length !== 1 ? 's' : ''} configured`}
              suffix={
                <Box direction="horizontal" gap="SP2" verticalAlign="middle">
                  {saved && <SavedBadge />}
                  <Button size="small" priority="secondary" onClick={addRow} disabled={loading}>
                    + Add Row
                  </Button>
                  <Button
                    size="small"
                    onClick={handleSave}
                    disabled={saving || loading || hasErrors}
                    prefixIcon={saving ? <Loader size="tiny" /> : undefined}
                    skin={hasErrors ? 'destructive' : 'standard'}
                  >
                    {saving
                      ? savingLabel
                      : hasErrors
                        ? `Fix ${errorCount} error${errorCount !== 1 ? 's' : ''} to save`
                        : 'Save Mapping'}
                  </Button>
                </Box>
              }
            />
            <Card.Divider />
            <Card.Content>
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : mappings.length === 0 ? (
                <EmptyState
                  skin="page"
                  title="No field mappings yet"
                  subtitle="Click '+ Add Row' to create your first field mapping between Wix and Zoho CRM."
                >
                  <Button size="small" onClick={addRow}>+ Add Row</Button>
                </EmptyState>
              ) : (
                <div>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.2fr 1fr 40px', gap: 12, padding: '0 4px 12px', alignItems: 'center' }}>
                    {['Wix Field', 'Zoho Field'].map((h) => (
                      <Text key={h} size="small" weight="bold">{h}</Text>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text size="small" weight="bold">Direction</Text>
                      {!isPremium && upgradeUrl && (
                        <Button
                          size="tiny"
                          skin="premium"
                          prefixIcon={<PremiumFilled />}
                          onClick={() => window.open(upgradeUrl, '_blank')}
                        >
                          Upgrade
                        </Button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Text size="small" weight="bold">Transform</Text>
                      <Tooltip
                        maxWidth={420}
                        content={
                          <div style={{ lineHeight: 1.7 }}>
                            <div><strong>None</strong> — synced as-is, no change applied.</div>
                            <div style={{ marginTop: 6 }}><strong>Trim</strong> — removes leading/trailing spaces. {'" John " → "John"'}</div>
                            <div style={{ marginTop: 6 }}><strong>Lowercase</strong> — converts to lower case. {"'JOHN' → 'john'"}</div>
                            <div style={{ marginTop: 6 }}><strong>Uppercase</strong> — converts to upper case. {"'john' → 'JOHN'"}</div>
                          </div>
                        }
                        placement="top"
                      >
                        <span style={{ cursor: 'help', color: '#9ca3af', fontSize: 13, lineHeight: 1 }}>ⓘ</span>
                      </Tooltip>
                    </div>
                    <div />
                  </div>
                  <Divider />

                  {/* Rows */}
                  {mappings.map((m, i) => {
                    const rowError = rowErrors[i];
                    return (
                      <div key={i} style={{ borderBottom: i < mappings.length - 1 ? '1px solid #f0f4f7' : 'none', borderRadius: 6 }}>
                        <div
                          style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.2fr 1fr 40px', gap: 12, padding: rowError?.message ? '14px 4px 6px' : '14px 4px', alignItems: 'center', transition: 'background 0.15s ease' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#fafbfc'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <AutoComplete
                            size="small"
                            value={wixDisplays[i] ?? ''}
                            options={getWixFieldOptions(wixDisplays[i] ?? '')}
                            status={wixStatus(i)}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const text = e.target.value;
                              updateWixDisplay(i, text);
                              const match = WIX_FIELD_DEFS.find((f) => f.label.toLowerCase() === text.toLowerCase());
                              update(i, { wixField: match ? match.id : text });
                            }}
                            onSelect={(o: any) => {
                              updateWixDisplay(i, String(o.value));
                              update(i, { wixField: String(o.id) });
                            }}
                            placeholder="Search and select a Wix field"
                          />
                          <AutoComplete
                            size="small"
                            value={zohoDisplays[i] ?? ''}
                            options={getZohoFieldOptions(zohoDisplays[i] ?? '')}
                            status={zohoStatus(i)}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const text = e.target.value;
                              updateZohoDisplay(i, text);
                              const match = ZOHO_FIELD_DEFS.find((f) => f.label.toLowerCase() === text.toLowerCase());
                              update(i, { zohoProp: match ? match.id : text });
                            }}
                            onSelect={(o: any) => {
                              updateZohoDisplay(i, String(o.value));
                              update(i, { zohoProp: String(o.id) });
                            }}
                            placeholder="Search and select a Zoho CRM field"
                          />
                          <Dropdown
                            size="small"
                            selectedId={m.direction}
                            options={directionOptions}
                            onSelect={(o) => update(i, { direction: o.id as FieldMapping['direction'] })}
                          />
                          <Dropdown
                            size="small"
                            selectedId={m.transform}
                            options={TRANSFORM_OPTIONS}
                            onSelect={(o) => update(i, { transform: o.id as FieldMapping['transform'] })}
                          />
                          <button
                            onClick={() => remove(i)}
                            title="Remove row"
                            style={{ width: 32, height: 32, border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d63b3b', fontSize: 16, transition: 'background 0.15s ease', flexShrink: 0 }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fff0f0'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            ✕
                          </button>
                        </div>

                        {rowError && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '0 4px 10px' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#d63b3b" style={{ flexShrink: 0, marginTop: 1 }}>
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                            <Text size="tiny" skin="error">{rowError.message}</Text>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Content>
          </Card>
        </Cell>

        {/* Tips card */}
        <Cell span={12}>
          <Card>
            <Card.Header title="Mapping Tips" />
            <Card.Divider />
            <Card.Content>
              <Box direction="vertical" gap="SP3">
                {[
                  { icon: '↔', tip: 'Bidirectional keeps both Wix and Zoho CRM in sync whenever either changes.' },
                  { icon: '→', tip: 'Wix → Zoho pushes contact updates from your site into Zoho CRM only.' },
                  { icon: '←', tip: 'Zoho → Wix imports Zoho CRM contact changes back into your Wix contacts.' },
                  { icon: 'Aa', tip: 'Use Trim, Lowercase, or Uppercase transforms to normalise field values before syncing.' },
                  { icon: '✎', tip: 'Search by typing in the field selector. Only predefined Wix fields and Zoho CRM fields are accepted.' },
                ].map(({ icon, tip }) => (
                  <div key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f4f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#FF7A59' }}>
                      {icon}
                    </div>
                    <div style={{ paddingTop: 4 }}>
                      <Text size="small" secondary>{tip}</Text>
                    </div>
                  </div>
                ))}
              </Box>
            </Card.Content>
          </Card>
        </Cell>
      </Layout>

      {/* Post-save: Open in Editor prompt */}
      {showEditorPrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', maxWidth: 460, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#2D6BDA">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </div>
              <Text size="medium" weight="bold">Field mapping saved!</Text>
            </div>
            <Text size="small">
              <span style={{ color: '#667085', lineHeight: 1.75, display: 'block' }}>
                Your field mappings are set. Zoho CRM will now sync contact data according to
                these rules on the next sync or when a contact is updated.
              </span>
            </Text>
            <div style={{ marginTop: 18, padding: '12px 16px', borderRadius: 10, background: '#f4f5f7', border: '1px solid #e8ecf1', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#667085" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              <Text size="small">
                <span style={{ color: '#344054', lineHeight: 1.65, display: 'block' }}>
                  Go to the <strong>Dashboard</strong> and click{' '}
                  <strong>"Sync Now"</strong> to apply your field mappings immediately.
                </span>
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              {editorUrl && (
                <button
                  onClick={() => { openEditor(editorUrl); setShowEditorPrompt(false); }}
                  style={{ flex: 1, height: 42, borderRadius: 10, border: 'none', background: '#2D6BDA', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                  Open in Editor
                </button>
              )}
              <button
                onClick={() => setShowEditorPrompt(false)}
                style={{ height: 42, padding: '0 20px', borderRadius: 10, border: '1.5px solid #e8ecf1', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#667085', flex: editorUrl ? undefined : 1 }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldMappingPage;
