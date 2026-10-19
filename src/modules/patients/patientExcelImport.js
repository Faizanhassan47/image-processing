import { readSheet } from 'read-excel-file/browser';

const FIELD_ALIASES = {
  first_name: ['firstname', 'first', 'givenname', 'forename'],
  last_name: ['lastname', 'last', 'surname', 'familyname'],
  full_name: ['name', 'fullname', 'patientname'],
  cnic: ['cnic', 'cnicnumber', 'cnicno', 'nic', 'nationalid', 'nationalidnumber', 'idcardnumber'],
  medical_record_number: ['medicalrecordnumber', 'mrn', 'recordnumber', 'medicalrecordno'],
  external_id: ['externalid', 'externalidentifier', 'externalref', 'referenceid'],
  date_of_birth: ['dateofbirth', 'dob', 'birthdate', 'birthday'],
  sex: ['sex', 'gender'],
  blood_group: ['bloodgroup', 'bloodtype', 'bloodgrp'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'contactnumber', 'telephone'],
  address: ['address', 'residence', 'location'],
  status: ['status', 'patientstatus'],
};

const SEX_VALUES = { f: 'Female', female: 'Female', m: 'Male', male: 'Male', intersex: 'Intersex', unknown: 'Unknown', notstated: 'Not stated' };
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATUS_VALUES = { active: 'Active', inactive: 'Inactive', deceased: 'Deceased' };
const MAX_ROWS = 500;

const ALIAS_LOOKUP = Object.entries(FIELD_ALIASES).reduce((lookup, [field, aliases]) => {
  aliases.forEach((alias) => { lookup[alias] = field; });
  return lookup;
}, {});

export const IMPORT_COLUMNS = ['First name', 'Last name', 'CNIC', 'MRN', 'External ID', 'Date of birth', 'Sex', 'Blood group', 'Phone', 'Address', 'Status'];

const normalizeHeader = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

function toIsoDate(value) {
  if (!value) return { value: '' };
  if (value instanceof Date && !Number.isNaN(value.getTime())) return { value: value.toISOString().slice(0, 10) };
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { value: raw };
  const dayFirst = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dayFirst) return { value: `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}` };
  return { value: '', error: `Unrecognised date "${raw}"` };
}

function splitFullName(fullName) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first_name: parts[0] || '', last_name: '' };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts.at(-1) };
}

export function buildPatientFromRow(row, columnMap) {
  const raw = {};
  Object.entries(columnMap).forEach(([index, field]) => { raw[field] = row[index]; });
  const errors = [];
  const patient = {
    first_name: text(raw.first_name), last_name: text(raw.last_name),
    cnic: text(raw.cnic).replace(/[\s-]/g, ''),
    medical_record_number: text(raw.medical_record_number), external_id: text(raw.external_id),
    phone: text(raw.phone), address: text(raw.address),
  };
  if ((!patient.first_name || !patient.last_name) && raw.full_name) {
    const split = splitFullName(text(raw.full_name));
    patient.first_name = patient.first_name || split.first_name;
    patient.last_name = patient.last_name || split.last_name;
  }
  if (!patient.first_name) errors.push('First name is required');
  if (!patient.last_name) errors.push('Last name is required');
  if (!patient.cnic) errors.push('CNIC is required');
  else if (!/^\d{13}$/.test(patient.cnic)) errors.push('CNIC must be exactly 13 digits');

  const dob = toIsoDate(raw.date_of_birth);
  patient.date_of_birth = dob.value;
  if (dob.error) errors.push(dob.error);
  else if (dob.value && dob.value > new Date().toISOString().slice(0, 10)) errors.push('Date of birth is in the future');

  const sexRaw = text(raw.sex);
  patient.sex = sexRaw ? SEX_VALUES[normalizeHeader(sexRaw)] || '' : '';
  if (sexRaw && !patient.sex) errors.push(`Unrecognised sex "${sexRaw}"`);

  const bloodRaw = text(raw.blood_group).toUpperCase().replace(/\s+/g, '');
  patient.blood_group = bloodRaw && BLOOD_GROUPS.includes(bloodRaw) ? bloodRaw : '';
  if (bloodRaw && !patient.blood_group) errors.push(`Unrecognised blood group "${text(raw.blood_group)}"`);

  const statusRaw = text(raw.status);
  patient.status = statusRaw ? STATUS_VALUES[normalizeHeader(statusRaw)] || '' : 'Active';
  if (statusRaw && !patient.status) errors.push(`Unrecognised status "${statusRaw}"`);

  return { patient, errors };
}

/** Reads the first sheet of an .xlsx file and auto-maps columns by header name. */
export async function parsePatientWorkbook(file) {
  const rows = (await readSheet(file)).filter((row) => row.some((cell) => text(cell) !== ''));
  if (rows.length < 2) throw new Error('The spreadsheet has no data rows');
  if (rows.length - 1 > MAX_ROWS) throw new Error(`Import is limited to ${MAX_ROWS} patients per file`);

  const columnMap = {};
  rows[0].forEach((header, index) => {
    const field = ALIAS_LOOKUP[normalizeHeader(header)];
    if (field && !Object.values(columnMap).includes(field)) columnMap[index] = field;
  });
  const mapped = Object.values(columnMap);
  if (!mapped.includes('full_name') && !(mapped.includes('first_name') && mapped.includes('last_name'))) {
    throw new Error('Could not find name columns. Include "First name" and "Last name" headers in the first row.');
  }
  const unmappedHeaders = rows[0].map(text).filter((header, index) => header && !(index in columnMap));
  const records = rows.slice(1).map((row, index) => ({ rowNumber: index + 2, ...buildPatientFromRow(row, columnMap) }));
  return { records, mappedFields: mapped, unmappedHeaders };
}
