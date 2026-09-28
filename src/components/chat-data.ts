import { BANK, GIVE_FAQ, MIN_GIFT } from './give-data'
import { ORG } from './org-data'
import { QUICK_CONTACT } from './contact-data'
import { RAMADAN } from './season-data'
import { FAQ as ZAKAT_FAQ, FITR, NISAB } from './zakat-data'

/* ---------------------------------------------------------------------------
   What the help chat knows (HelpChat.tsx). No AI and no API key: every
   answer is written here, and the chat only picks the one whose keywords best
   match what was typed (matchAnswer, below).

   WHERE THE WORDS COME FROM. Where the site already answers a question — the
   zakat FAQ, the give FAQ, the Ramadan FAQ — the answer is looked up from
   there by its question, so the chat and the page cannot drift apart. `pick`
   falls back to the text written beside it if that question is ever cut or
   reworded, rather than answering nothing. Answers only the chat gives are
   written out here, and follow the same rule as the zakat page: where the
   scholars differ it says so and does not choose.

   WHEN NOTHING MATCHES the chat says so plainly and offers a short form that
   files the question in Admin → Enquiries (the same /api/public/enquiries the
   contact form uses, subject "Chat question"), plus email and WhatsApp. A
   chat that guesses at a religious ruling is worse than one that says "ask
   us", which is why the match has a floor (MIN_SCORE).

   TODO before launch: the office reads every answer here with the rest of
   the site copy, and an imam reads the zakat ones with the zakat page's.
--------------------------------------------------------------------------- */

export type ChatAnswer = {
  id: string
  /** the question as a chip shows it and as the chat echoes it */
  q: string
  a: string
  /** words and short phrases that point at this answer; lower case */
  keys: string[]
  /** a page that says more */
  link?: { label: string; href: string }
}

const findIn = (list: { q: string; a: string }[], q: string) => list.find((f) => f.q === q)?.a
/** An answer the site already gives, by its question, or the fallback. */
const pick = (list: { q: string; a: string }[], q: string, fallback: string) => findIn(list, q) ?? fallback

// The same wa.me chat link as the contact page's WhatsApp button, not the
// channel in SOCIALS, so a question can be sent straight to the team.
const whatsapp = QUICK_CONTACT.whatsapp.href

export const CHAT = {
  title: 'Questions? We can help',
  launch: 'Help and questions',
  close: 'Close help',
  greeting: 'Assalamu alaikum. Ask about zakat, your donations, receipts or regular giving, or pick a question below.',
  placeholder: 'Type your question…',
  send: 'Ask',
  suggestedHead: 'Common questions',
  /** the chips shown under the greeting, by answer id */
  suggested: ['nisab', 'zakat-who', 'fitr', 'tax', 'cancel-monthly', 'where-money'],
  related: 'You might also want:',
  noMatch:
    'I’m not sure I have a good answer to that. Leave your question and email below and someone from the team will reply, usually within two working days.',
  askForm: {
    head: 'Ask the team',
    name: 'Your name',
    email: 'Email',
    question: 'Your question',
    submit: 'Send question',
    sending: 'Sending…',
    sent: 'Thank you. Your question has reached the team, and the reply will come to your email.',
    failed: 'That didn’t send. Please email us instead.',
    needName: 'Please add your name.',
    needEmail: 'We need an email address to reply to.',
    needQuestion: 'Please write your question.',
    subject: 'Chat question',
  },
  orReach: 'Or reach us directly:',
  email: ORG.email,
  whatsapp,
  contactPage: '/contact',
}

/* Words that carry no meaning for matching. Kept short: "give", "pay" and
   "zakat" are left in because they are what most questions are about. */
export const STOPWORDS = new Set(
  'a an and are as at be by can could do does for from have how i if in is it its me my of on or should the this to what when where which who why will with you your we our am was about much many there their them'.split(
    ' ',
  ),
)

/** The fewest points an answer needs before the chat offers it. One keyword
 *  hit is worth 2, so a single stray word is not enough on its own unless it
 *  is a specific term (see matchAnswer). */
export const MIN_SCORE = 3

/* Words so common in questions here that they say little about which answer
   is wanted: worth 1 as a key, not 2 or 3. Without this "how much is zakat al
   fitr" landed on "who has to pay zakat" (28 September 2026). */
const GENERIC = new Set(['zakat', 'give', 'gift', 'donation', 'donate', 'pay', 'money', 'much'])

export const ANSWERS: ChatAnswer[] = [
  /* ---------------- zakat ---------------- */
  {
    id: 'zakat-who',
    q: 'Who has to pay zakat?',
    a: `Every adult, sane Muslim whose wealth has stayed at or above the nisab for a full lunar year. It is ${NISAB.rate * 100}% of that wealth, paid once a year. If your wealth falls below the nisab during the year, scholars differ on whether the year starts again, so ask one you trust.`,
    keys: ['who pays', 'who has to', 'obligatory', 'fard', 'must i pay', 'have to pay', 'due', 'eligible to pay', 'owe zakat', 'zakat', 'lunar year', 'hawl'],
    link: { label: 'About zakat', href: '/zakat' },
  },
  {
    id: 'nisab',
    q: 'What is the nisab?',
    a: `The nisab is the least wealth on which zakat is due: the value of ${NISAB.goldGrams}g of gold or ${NISAB.silverGrams}g of silver. Silver gives the lower figure, so more people pay and more people are helped; gold gives the higher one. Both are followed by scholars. Our calculator works out both from today’s price.`,
    keys: ['nisab', 'nisaab', 'threshold', 'minimum', 'how much before', 'limit', 'gold', 'silver', 'grams'],
    link: { label: 'Zakat calculator', href: '/zakat/calculator' },
  },
  {
    id: 'gold-silver',
    q: 'Do I pay zakat on gold and silver?',
    a: `Yes, on gold and silver kept as savings: coins, bars, and jewellery you don’t wear, at ${NISAB.rate * 100}% of today’s value. ${pick(ZAKAT_FAQ, 'Does gold jewellery I wear count?', 'On jewellery you wear, scholars differ. Follow the scholar you trust.')}`,
    keys: ['gold', 'silver', 'jewellery', 'jewelry', 'bullion', 'coins', 'bars', 'wear'],
    link: { label: 'Zakat calculator', href: '/zakat/calculator' },
  },
  {
    id: 'what-counts',
    q: 'What counts towards zakat?',
    a: 'Cash and bank balances, gold and silver kept as savings, shares and crypto held to sell or for their value, business stock, and money people owe you that you expect back. Take off debts falling due now. Your home, car, furniture and the things you use every day don’t count.',
    keys: ['what counts', 'include', 'assets', 'cash', 'savings', 'shares', 'stocks', 'crypto', 'business', 'property', 'house', 'home', 'car', 'debts', 'calculate', 'work out', 'how much zakat'],
    link: { label: 'Work it out', href: '/zakat/calculator' },
  },
  {
    id: 'super',
    q: 'Do I pay zakat on superannuation?',
    a: pick(ZAKAT_FAQ, 'What about my superannuation?', 'Scholars differ. Ask a scholar you trust.'),
    keys: ['super', 'superannuation', 'retirement', 'pension'],
  },
  {
    id: 'fitr',
    q: 'How much is zakat al-Fitr?',
    a: `$${FITR.perHead} for each person in your household, paid by the head of the house, including children. ${pick(RAMADAN.faq, 'When should I give zakat al-Fitr?', 'Give it before the Eid prayer.')}`,
    keys: ['fitr', 'fitrah', 'fitra', 'fitrana', 'al fitr', 'eid', 'per person', 'per head', 'ramadan'],
    link: { label: 'Give zakat al-Fitr', href: '/give?designation=zakat-fitr' },
  },
  {
    id: 'kaffarah',
    q: 'What is kaffarah and how much is it?',
    a: `${pick(RAMADAN.faq, 'What is the difference between fidyah and kaffarah?', 'Kaffarah is for a fast broken on purpose without a valid reason.')} We give it as meals at $10 each: $600 feeds sixty people for one fast, and $100 feeds ten people for a broken oath.`,
    keys: ['kaffarah', 'kaffara', 'kafarah', 'kaffarat', 'broken fast', 'broke my fast', 'oath', 'expiation', 'sixty'],
    link: { label: 'Give kaffarah', href: '/give?designation=kaffarah' },
  },
  {
    id: 'fidyah',
    q: 'What is fidyah and how much is it?',
    a: 'Fidyah is for a fast you cannot make up, through long illness or old age: one person fed for each day missed. We give it as a meal at $10 a day, so a whole Ramadan is $300.',
    keys: ['fidyah', 'fidya', 'fidia', 'missed fast', 'cannot fast', 'can’t fast', 'cant fast', 'illness', 'elderly', 'old age', 'pregnant'],
    link: { label: 'Give fidyah', href: '/give?designation=fidyah' },
  },
  {
    id: 'zakat-fees',
    q: 'Do you take anything out of my zakat?',
    a: pick(ZAKAT_FAQ, 'Do you take anything out of my zakat?', 'No. None of your zakat pays for running the charity.'),
    keys: ['take out', 'cut', 'deduct', 'zakat admin', 'zakat fee', '100%', 'full', 'zakat policy'],
    link: { label: 'Our zakat policy', href: '/zakat' },
  },
  {
    id: 'instalments',
    q: 'Can I pay zakat in instalments?',
    a: pick(ZAKAT_FAQ, 'Can I pay it in instalments?', 'Yes, as long as the full amount is paid by the time it is owed.'),
    keys: ['instalments', 'installments', 'split', 'in parts', 'spread'],
  },
  {
    id: 'family',
    q: 'Can I give zakat to my family?',
    a: pick(ZAKAT_FAQ, 'Can I give my zakat to my own family?', 'Not to people you are already obliged to support.'),
    keys: ['family', 'relatives', 'parents', 'brother', 'sister', 'cousin', 'spouse'],
  },
  {
    id: 'missed',
    q: 'I missed zakat in past years. What do I do?',
    a: pick(ZAKAT_FAQ, 'I missed zakat in past years. What do I do?', 'It is still owed. Work out each year as carefully as you can and pay it.'),
    keys: ['missed', 'past years', 'previous years', 'forgot', 'late', 'owed from'],
  },

  /* ---------------- giving ---------------- */
  {
    id: 'tax',
    q: 'Is my donation tax deductible?',
    a: pick(GIVE_FAQ, 'Is my donation tax deductible?', `Yes. Donations of $${MIN_GIFT} and over are tax deductible.`),
    keys: ['tax', 'deductible', 'deduction', 'claim', 'ato', 'tax return', 'eofy'],
  },
  {
    id: 'registered',
    q: 'Are you a registered charity?',
    a: `Yes. ${ORG.name} (ABN ${ORG.abn}) has been on the ACNC charity register since ${ORG.registered}, and is endorsed as a deductible gift recipient (DGR), which is why donations of $${MIN_GIFT} and over can be claimed. Our annual reports are on the ACNC register and on our Where it goes page.`,
    keys: ['acnc', 'dgr', 'registered', 'legit', 'legitimate', 'abn', 'charity status', 'pbi', 'trust', 'real charity'],
    link: { label: 'Where it goes', href: '/where-it-goes' },
  },
  {
    id: 'receipt',
    q: 'When does my receipt arrive?',
    a: `${pick(GIVE_FAQ, 'When does my receipt arrive?', 'By email, as soon as the payment goes through.')} You can also download every receipt and a yearly tax statement from your account.`,
    keys: ['receipt', 'receipts', 'invoice', 'statement', 'tax statement', 'proof', 'confirmation', 'didn’t get', 'didnt get'],
    link: { label: 'My account', href: '/account' },
  },
  {
    id: 'monthly',
    q: 'Can I give monthly?',
    a: 'Yes, on the voluntary funds: sadaqah, education, water, food and the emergency fund. Choose Monthly on the first step of the give form and it is charged to your card on the same date each month. Zakat, zakat al-Fitr, kaffarah and fidyah are given once, not monthly.',
    keys: ['monthly', 'regular', 'recurring', 'every month', 'subscription', 'direct debit', 'standing', 'weekly'],
    link: { label: 'Give monthly', href: '/give' },
  },
  {
    id: 'cancel-monthly',
    q: 'How do I change or cancel my regular donation?',
    a: 'Sign in to your account with your email (we send you a six-digit code, no password) and open Regular donations. There you can change the amount or the card, pause it, or cancel it, and nothing more is taken. There is no minimum number of months and no fee. If you’d rather, write to us and we’ll do it for you.',
    keys: ['cancel', 'stop', 'change', 'monthly', 'cancel my', 'stop my', 'pause', 'update card', 'new card', 'amount', 'end', 'unsubscribe', 'manage', 'regular gift', 'monthly gift', 'regular donation', 'monthly donation'],
    link: { label: 'Sign in to my account', href: '/account' },
  },
  {
    id: 'where-money',
    q: 'Where does my money go?',
    a: 'To the appeal or fund you choose, and nowhere else. Zakat is kept in a ledger of its own and spent only on the people zakat is owed to. We publish what each fund has done, country by country, on our Where it goes page.',
    keys: ['where does', 'money go', 'where it goes', 'spent', 'spend', 'how is', 'used', 'impact', 'countries', 'transparency', 'reports'],
    link: { label: 'Where it goes', href: '/where-it-goes' },
  },
  {
    id: 'needed-most',
    q: 'What does “Where needed most” mean?',
    a: 'It is general sadaqah: we put it where the need is greatest at the time, which is often an emergency before a dedicated appeal has opened. It also covers the charity’s running costs, which is how zakat and appeal donations reach people in full.',
    keys: ['needed most', 'most needed', 'general', 'general sadaqah', 'sadaqah', 'sadaqa', 'anywhere', 'not sure', 'unrestricted'],
    link: { label: 'Give where needed most', href: '/give' },
  },
  {
    id: 'admin-fees',
    q: 'How much goes on admin fees?',
    a: 'None of your zakat. There are no salaries here, and what running the charity does cost comes out of general sadaqah. At checkout you can choose to cover the card fee (about 2.6%) so the whole donation arrives.',
    keys: ['admin', 'administration', 'fees', 'fee', 'overheads', 'costs', 'salaries', 'percentage', 'how much goes', 'card fee'],
    link: { label: 'Where it goes', href: '/where-it-goes' },
  },
  {
    id: 'refund',
    q: 'I made a mistake with my donation. Can I get a refund?',
    a: pick(GIVE_FAQ, 'I made a mistake with my donation. Can I get a refund?', 'Tell us within 30 days and we will refund it.'),
    keys: ['refund', 'mistake', 'wrong amount', 'charged twice', 'double', 'money back', 'error'],
  },
  {
    id: 'bank',
    q: 'Can I give by bank transfer?',
    a: `Yes. Our account is ${BANK.name}, BSB ${BANK.bsb}, account ${BANK.account}. Put your name and what the donation is for in the reference, and email us if you need a receipt.`,
    keys: ['bank', 'transfer', 'bsb', 'account number', 'eft', 'deposit', 'paypal', 'card', 'pay'],
  },
  {
    id: 'anonymous',
    q: 'Can I give anonymously?',
    a: 'Yes. Tick “Give anonymously” on the details step of the give form and your name is left off the recent donations shown on the site and on any fundraiser page. We still need your name and email for your receipt; they are never shown publicly.',
    keys: ['anonymous', 'anonymously', 'hide my name', 'private', 'privacy', 'name shown'],
  },

  /* ---------------- getting in touch ---------------- */
  {
    id: 'contact',
    q: 'How do I contact you?',
    a: `Email ${ORG.email}, or use the form on our contact page. Our office is at ${ORG.street}, ${ORG.suburb}. We usually reply within two working days.`,
    keys: ['contact', 'email', 'phone', 'call', 'address', 'office', 'speak', 'talk', 'human', 'person', 'reach', 'whatsapp'],
    link: { label: 'Contact us', href: '/contact' },
  },
  {
    id: 'volunteer',
    q: 'How can I volunteer?',
    a: 'We’d love the help: packing, events, and skills like design or accounts. Tell us what you can do on the volunteer page and the team will be in touch.',
    keys: ['volunteer', 'volunteering', 'help out', 'get involved', 'join'],
    link: { label: 'Volunteer', href: '/volunteer' },
  },
  {
    id: 'fundraise',
    q: 'Can I start my own fundraiser?',
    a: 'Yes. Pick an appeal, set a target and tell people why it matters to you. Your page goes live once the team has checked it, usually within a day.',
    keys: ['fundraiser', 'fundraise', 'fundraising', 'my own page', 'raise money', 'birthday', 'challenge'],
    link: { label: 'Start a fundraiser', href: '/fundraisers/start' },
  },
]

/* ---------------------------------------------------------------------------
   Matching. Deliberately simple: lower-case, strip punctuation, drop the
   stopwords, trim a plural "s", and score each answer by how many of its
   keys appear. A key of two words or more that appears whole is worth more
   (4) than one word (2, or 3 for a word of five letters or more, or 1 for a
   GENERIC one), and a word from the chip's own question is worth 1,
   so "cancel my monthly" lands on cancel-monthly rather than monthly.
--------------------------------------------------------------------------- */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9%\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stem = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)

const tokens = (s: string) =>
  norm(s)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem)

export function matchAnswer(input: string): { best: ChatAnswer | null; others: ChatAnswer[] } {
  const text = ` ${norm(input)} `
  const words = new Set(tokens(input))
  if (!words.size) return { best: null, others: [] }

  const scored = ANSWERS.map((ans) => {
    let score = 0
    for (const key of ans.keys) {
      const k = norm(key)
      if (k.includes(' ')) {
        if (text.includes(` ${k} `)) score += 4
      } else if (words.has(stem(k))) {
        /* a specific term (nisab, kaffarah) is enough on its own */
        score += GENERIC.has(k) ? 1 : k.length >= 5 ? 3 : 2
      }
    }
    for (const w of tokens(ans.q)) if (words.has(w)) score += 1
    return { ans, score }
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  const top = scored[0]
  if (!top || top.score < MIN_SCORE) return { best: null, others: scored.slice(0, 2).map((s) => s.ans) }
  return { best: top.ans, others: scored.slice(1, 3).filter((s) => s.score >= MIN_SCORE).map((s) => s.ans) }
}

export const answerById = (id: string) => ANSWERS.find((a) => a.id === id)
