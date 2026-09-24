/* ---------------------------------------------------------------------------
   The ACNC registers, as data.

   One definition per register drives everything about it: the columns on the
   compliance portal's table, the fields in its form, the CSV export, and the
   server's validation. Adding a field to a register is one line here and
   nothing else — the server stores register entries as `fields` against the
   register's key (server/models/RegisterEntry.ts) and checks them against
   this file.

   The standards each register answers to are the ACNC Governance Standards
   (GS) and External Conduct Standards (ECS). The map is the platform's
   reading of where the evidence usually sits — it is not advice, and the
   proposal is explicit that nothing here is legal, tax or audit advice.
--------------------------------------------------------------------------- */

export type FieldType = 'text' | 'textarea' | 'date' | 'select' | 'number' | 'money' | 'email' | 'boolean'

export type RegisterField = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: Record<string, string>
  /** shown on the table, in this order */
  column?: boolean
  help?: string
  /** half-width in the form on wide screens */
  half?: boolean
}

export type RegisterDef = {
  key: string
  label: string
  singular: string
  blurb: string
  /** the field shown as the entry's title */
  titleField: string
  /** the date that, once passed, makes the entry "due for review" */
  reviewField?: string
  standards: string[]
  fields: RegisterField[]
}

const RISK_SCALE = { '1': '1 · Rare', '2': '2 · Unlikely', '3': '3 · Possible', '4': '4 · Likely', '5': '5 · Almost certain' }
const IMPACT_SCALE = { '1': '1 · Minor', '2': '2 · Moderate', '3': '3 · Serious', '4': '4 · Major', '5': '5 · Severe' }

export const REGISTERS: RegisterDef[] = [
  {
    key: 'responsible-people',
    label: 'Responsible people',
    singular: 'responsible person',
    blurb: 'Directors and board members, when they were appointed, and the checks each one has had.',
    titleField: 'name',
    reviewField: 'nextCheck',
    standards: ['GS2', 'GS4', 'GS5'],
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true, column: true },
      { key: 'position', label: 'Position', type: 'select', required: true, column: true, half: true,
        options: { chair: 'Chair', secretary: 'Secretary', treasurer: 'Treasurer', director: 'Director', public_officer: 'Public officer' } },
      { key: 'email', label: 'Email', type: 'email', half: true },
      { key: 'appointed', label: 'Appointed', type: 'date', required: true, column: true, half: true },
      { key: 'ceased', label: 'Ceased', type: 'date', half: true, help: 'Leave empty while they serve.' },
      { key: 'acncNotified', label: 'ACNC notified', type: 'date', column: true, half: true,
        help: 'Changes must be notified to the ACNC within 28 days.' },
      { key: 'declarationSigned', label: 'Suitability declaration signed', type: 'date', half: true },
      { key: 'disqualifiedCheck', label: 'Disqualified persons register checked', type: 'date', column: true, half: true },
      { key: 'nextCheck', label: 'Next check due', type: 'date', half: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'overseas-partners',
    label: 'Overseas partners',
    singular: 'overseas partner',
    blurb: 'Who delivers the work abroad, the agreement with them, the diligence done and the reports received.',
    titleField: 'name',
    reviewField: 'nextReview',
    standards: ['ECS1', 'ECS2', 'ECS3'],
    fields: [
      { key: 'name', label: 'Partner name', type: 'text', required: true, column: true },
      { key: 'country', label: 'Country', type: 'select', required: true, column: true, half: true,
        options: { gaza: 'Gaza', yemen: 'Yemen', lebanon: 'Lebanon', syria: 'Syria', gambia: 'The Gambia', bangladesh: 'Bangladesh' } },
      { key: 'contact', label: 'Contact person', type: 'text', half: true },
      { key: 'activities', label: 'What they deliver', type: 'textarea', required: true },
      { key: 'agreementSigned', label: 'Agreement signed', type: 'date', column: true, half: true },
      { key: 'dueDiligence', label: 'Due diligence completed', type: 'date', column: true, half: true },
      { key: 'sanctionsCheck', label: 'Sanctions and terrorism list check', type: 'date', half: true,
        help: 'DFAT consolidated list and the national security listed-terrorist organisations.' },
      { key: 'risk', label: 'Risk rating', type: 'select', column: true, half: true,
        options: { low: 'Low', medium: 'Medium', high: 'High' } },
      { key: 'lastReport', label: 'Last report received', type: 'date', column: true, half: true },
      { key: 'nextReview', label: 'Next review', type: 'date', half: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'policies',
    label: 'Policies',
    singular: 'policy',
    blurb: 'Each policy the board has adopted, who owns it and when it next needs reviewing.',
    titleField: 'name',
    reviewField: 'nextReview',
    standards: ['GS1', 'GS3', 'GS5', 'ECS1', 'ECS2'],
    fields: [
      { key: 'name', label: 'Policy', type: 'text', required: true, column: true },
      { key: 'owner', label: 'Owner', type: 'text', column: true, half: true },
      { key: 'version', label: 'Version', type: 'text', column: true, half: true },
      { key: 'approved', label: 'Board approved', type: 'date', column: true, half: true },
      { key: 'nextReview', label: 'Next review', type: 'date', column: true, half: true },
      { key: 'summary', label: 'What it covers', type: 'textarea' },
    ],
  },
  {
    key: 'risks',
    label: 'Risks',
    singular: 'risk',
    blurb: 'What could go wrong, how likely and how bad, and what is being done about it.',
    titleField: 'title',
    reviewField: 'nextReview',
    standards: ['GS5', 'ECS3'],
    fields: [
      { key: 'title', label: 'Risk', type: 'text', required: true, column: true },
      { key: 'category', label: 'Category', type: 'select', column: true, half: true,
        options: { financial: 'Financial', overseas: 'Overseas and partners', safeguarding: 'Safeguarding', fraud: 'Fraud', reputational: 'Reputational', operational: 'Operational', compliance: 'Compliance', cyber: 'Cyber and data' } },
      { key: 'owner', label: 'Owner', type: 'text', half: true },
      { key: 'likelihood', label: 'Likelihood', type: 'select', required: true, half: true, options: RISK_SCALE },
      { key: 'impact', label: 'Impact', type: 'select', required: true, half: true, options: IMPACT_SCALE },
      { key: 'controls', label: 'Controls in place', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', column: true, half: true,
        options: { open: 'Open', treating: 'Being treated', accepted: 'Accepted', closed: 'Closed' } },
      { key: 'nextReview', label: 'Next review', type: 'date', column: true, half: true },
    ],
  },
  {
    key: 'conflicts',
    label: 'Conflicts of interest',
    singular: 'conflict of interest',
    blurb: 'Every interest declared by a responsible person or staff member, and how it was managed.',
    titleField: 'person',
    standards: ['GS5'],
    fields: [
      { key: 'person', label: 'Declared by', type: 'text', required: true, column: true },
      { key: 'declared', label: 'Declared on', type: 'date', required: true, column: true, half: true },
      { key: 'kind', label: 'Kind', type: 'select', column: true, half: true,
        options: { actual: 'Actual', potential: 'Potential', perceived: 'Perceived' } },
      { key: 'nature', label: 'The interest', type: 'textarea', required: true },
      { key: 'action', label: 'How it is managed', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', column: true, half: true,
        options: { open: 'Open', managed: 'Managed', resolved: 'Resolved' } },
    ],
  },
]

export const registerByKey = (key: string | undefined) => REGISTERS.find((r) => r.key === key)

/** Risk rating is likelihood times impact, 1 to 25. */
export function riskScore(fields: Record<string, unknown>): number | null {
  const l = Number(fields.likelihood)
  const i = Number(fields.impact)
  return l && i ? l * i : null
}
export function riskBand(score: number | null): 'low' | 'medium' | 'high' | 'extreme' | null {
  if (score == null) return null
  if (score >= 17) return 'extreme'
  if (score >= 10) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

/* ---------- the standards ---------- */
export const STANDARDS: { code: string; title: string; ask: string; evidence: string[] }[] = [
  { code: 'GS1', title: 'Purposes and not-for-profit nature', ask: 'Be run for your charitable purposes, and be able to show it.',
    evidence: ['policies', 'documents:governance'] },
  { code: 'GS2', title: 'Accountability to members', ask: 'Give members the chance to raise concerns about how the charity is run.',
    evidence: ['responsible-people', 'calendar:governance'] },
  { code: 'GS3', title: 'Compliance with Australian laws', ask: 'Do not commit a serious offence or breach a law that attracts a serious penalty.',
    evidence: ['policies', 'calendar:ato', 'calendar:fundraising'] },
  { code: 'GS4', title: 'Suitability of responsible people', ask: 'Check that directors are not disqualified, and remove any who are.',
    evidence: ['responsible-people'] },
  { code: 'GS5', title: 'Duties of responsible people', ask: 'Directors act with care, in good faith, disclose conflicts and keep the charity solvent.',
    evidence: ['conflicts', 'risks', 'policies'] },
  { code: 'ECS1', title: 'Activities and control of resources overseas', ask: 'Know what your overseas partners do with the money, and keep records of it.',
    evidence: ['overseas-partners', 'documents:agreement'] },
  { code: 'ECS2', title: 'Annual review of overseas activities', ask: 'Review overseas activities and the controls on them every year.',
    evidence: ['overseas-partners', 'policies'] },
  { code: 'ECS3', title: 'Anti-fraud and anti-corruption', ask: 'Take reasonable steps to manage fraud and corruption risk.',
    evidence: ['risks', 'overseas-partners'] },
  { code: 'ECS4', title: 'Protection of vulnerable individuals', ask: 'Protect the people your overseas work reaches, especially children.',
    evidence: ['policies', 'risks'] },
]
