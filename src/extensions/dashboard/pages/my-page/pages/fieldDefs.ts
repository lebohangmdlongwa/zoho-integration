export type FieldType =
  | 'name'
  | 'email'
  | 'phone'
  | 'text'
  | 'url'
  | 'date'
  | 'number'
  | 'enum'
  | 'custom';

export const ZOHO_FIELD_DEFS: { id: string; label: string; type: FieldType }[] = [
  { id: 'First_Name', label: 'First Name', type: 'name' },
  { id: 'Last_Name', label: 'Last Name', type: 'name' },
  { id: 'Email', label: 'Email', type: 'email' },
  { id: 'Phone', label: 'Phone', type: 'phone' },
  { id: 'Mobile', label: 'Mobile Phone', type: 'phone' },
  { id: 'Account_Name', label: 'Company Name', type: 'name' },
  { id: 'Title', label: 'Job Title', type: 'text' },
  { id: 'Department', label: 'Department', type: 'text' },
  { id: 'Lead_Source', label: 'Lead Source', type: 'enum' },
  { id: 'Description', label: 'Description', type: 'text' },
  { id: 'Mailing_Street', label: 'Mailing Street', type: 'text' },
  { id: 'Mailing_City', label: 'City', type: 'text' },
  { id: 'Mailing_State', label: 'State', type: 'text' },
  { id: 'Mailing_Zip', label: 'Zip Code', type: 'text' },
  { id: 'Mailing_Country', label: 'Country', type: 'text' },
  { id: 'Other_Street', label: 'Other Street', type: 'text' },
  { id: 'Other_City', label: 'Other City', type: 'text' },
  { id: 'Other_State', label: 'Other State', type: 'text' },
  { id: 'Other_Zip', label: 'Other Zip', type: 'text' },
  { id: 'Other_Country', label: 'Other Country', type: 'text' },
  { id: 'Fax', label: 'Fax', type: 'phone' },
  { id: 'Home_Phone', label: 'Home Phone', type: 'phone' },
  { id: 'Other_Phone', label: 'Other Phone', type: 'phone' },
  { id: 'Asst_Phone', label: 'Assistant Phone', type: 'phone' },
  { id: 'Date_of_Birth', label: 'Date of Birth', type: 'date' },
  { id: 'Website', label: 'Website URL', type: 'url' },
  { id: 'Twitter', label: 'Twitter Username', type: 'text' },
  { id: 'Skype_ID', label: 'Skype ID', type: 'text' },
  { id: 'Salutation', label: 'Salutation', type: 'enum' },
];

export const WIX_FIELD_DEFS: { id: string; label: string; type: FieldType }[] =
  [
    { id: 'info.name.first', label: 'First Name', type: 'name' },
    { id: 'info.name.last', label: 'Last Name', type: 'name' },
    { id: 'info.emails[0].email', label: 'Email', type: 'email' },
    { id: 'info.phones[0].phone', label: 'Phone', type: 'phone' },
    { id: 'info.company.name', label: 'Company Name', type: 'name' },
    { id: 'info.jobTitle', label: 'Job Title', type: 'text' },
    { id: 'info.addresses[0].addressLine', label: 'Street Address', type: 'text' },
    { id: 'info.addresses[0].city', label: 'City', type: 'text' },
    { id: 'info.addresses[0].subdivision', label: 'State / Region', type: 'text' },
    { id: 'info.addresses[0].postalCode', label: 'Postal Code', type: 'text' },
    { id: 'info.addresses[0].country', label: 'Country', type: 'text' },
  ];

export function getZohoFieldOptions(inputText: string) {
  const lower = inputText.toLowerCase();
  const filtered = lower
    ? ZOHO_FIELD_DEFS.filter(
        (f) =>
          f.label.toLowerCase().includes(lower) ||
          f.id.toLowerCase().includes(lower),
      )
    : ZOHO_FIELD_DEFS;
  return filtered.map((f) => ({ id: f.id, value: f.label }));
}

export function getWixFieldOptions(inputText: string) {
  const lower = inputText.toLowerCase();
  const filtered = lower
    ? WIX_FIELD_DEFS.filter(
        (f) =>
          f.label.toLowerCase().includes(lower) ||
          f.id.toLowerCase().includes(lower),
      )
    : WIX_FIELD_DEFS;
  return filtered.map((f) => ({ id: f.id, value: f.label }));
}
