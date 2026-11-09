// Learner-facing text for the marketing pages. Copy follows docs/design/Landing.dc.html and Pricing.dc.html.
// Prices, the saving and hour estimates are placeholders until product decides (docs/product.md, "Still to decide").

export const nav = {
  howItWorks: "How it works",
  hosts: "Hosts",
  pricing: "Pricing",
  logIn: "Log in",
  start: "Start watching free",
} as const;

export const footer = {
  say: "Say it: in-STICK",
  about: "About",
  hosts: "Hosts",
  pricing: "Pricing",
  privacy: "Privacy",
} as const;

export const landing = {
  hero: {
    badge: (languageName: string) => `Now teaching ${languageName}`,
    title: "Your scroll time, but it counts.",
    body: (languageName: string) =>
      `Watch real people speak ${languageName}, at your level, and see every hour add up. No drills. No pressure.`,
    waitlistHint: "More languages coming. Join the waitlist for yours.",
    sample: {
      hostLabel: "[Host on camera]",
      /** Arabic with tashkeel; the highlighted word is `highlight`. */
      before: "القَهْوَة",
      highlight: "سُخْنَة",
      after: ".",
      transliteration: "il-ahwa sokhna.",
      translation: "The coffee is hot.",
      hoursBadge: (languageName: string) => `12 hours of ${languageName} so far. Nice.`,
    },
  },
  pillarsLabel: "Why Instik",
  pillars: [
    {
      title: "Real people",
      body: "Native-speaker hosts you can see and name. No synthetic voices, no stock footage.",
      link: "Meet the hosts",
    },
    {
      title: "At your level",
      body: "Every video is levelled, so you understand almost everything and pick up the rest from context.",
    },
    {
      title: "Counted",
      body: "Every honest minute of watching counts toward your roadmap. Only real watching. We say so on your dashboard.",
    },
  ],
  how: {
    title: "Pick it up the way you got your first language",
    body: "By understanding. Not by drills, tests or streak panic.",
    steps: [
      { title: "Start where you are", body: "Tell us how much you know. A level check is there if you want it, never required." },
      { title: "Watch real hosts", body: "Slow, friendly videos with drawings and gestures. Tap any word in the transcript." },
      { title: "See the hours add up", body: "Your hours move you along a roadmap. When you've had enough, we tell you." },
    ],
  },
  stages: {
    label: "Roadmap",
    title: "Four stages. Honest estimates.",
    body: "Hours are estimates, not promises. Everyone moves at their own pace.",
    items: [
      { name: "Hear it", body: () => "Get used to the sounds and first words." },
      { name: "Follow it", body: (languageName: string) => `Follow slow, everyday ${languageName}.` },
      { name: "Understand it", body: () => "Understand natural speech on familiar topics." },
      { name: "Join in", body: () => "Start speaking when it comes naturally." },
    ],
  },
  isThisAi: {
    title: "Is this AI?",
    body: "No. Every video is made with real native speakers. We use technology to help you understand, not to replace the people you learn from.",
  },
  finalCta: { title: "Same thumb. Different outcome." },
} as const;

export const waitlist = {
  title: "Want another language?",
  body: (languageName: string) => `${languageName} is first. Tell us yours and we'll write when it's ready.`,
  languageLabel: "Language",
  languagePlaceholder: "Choose a language",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  button: "Join the waitlist",
  sending: "Joining…",
  note: "We'll only use this to tell you when your language is ready.",
  privacyLink: "Privacy",
  success: "Thank you. We'll write when your language is ready.",
  errors: {
    "invalid-email": "That email doesn't look right. Could you check it?",
    "invalid-language": "Please pick a language.",
    "too-many": "That's a lot of tries. Please wait a little and try again.",
    failed: "Something went wrong on our side. Please try again.",
  },
} as const;

export const pricing = {
  title: "Start free. Stay because it works.",
  body: "No ads, no streak pressure, no tricks. Cancel any time.",
  periodLabel: "Billing period",
  periods: ["Monthly", "Yearly"] as const,
  free: {
    name: "Free",
    price: "0",
    per: "forever",
    cta: "Start watching free",
    items: [
      "A starter set of Hear it and Follow it videos",
      "Hours counter and roadmap",
      "Interactive transcripts",
      "Your rhythm view",
    ],
  },
  full: {
    name: "Full access",
    /** Placeholders until prices are decided. */
    priceMonthly: "[PRICE]",
    priceYearly: "[PRICE]",
    saving: "[Save X%]",
    perMonthly: "per month",
    perYearly: "per year",
    cta: "Get full access",
    items: [
      "Every video at every stage",
      "New videos every week",
      "Every host",
      "Interactive transcripts with word meanings",
      "Add time you spend outside Instik",
    ],
  },
  faqTitle: "Questions",
  faqs: [
    { q: "Can I cancel any time?", a: "Yes. Cancel from your account in two clicks. Your hours stay with you." },
    {
      q: "Is this AI?",
      a: "No. Every video is made with real native speakers. We use technology to help you understand, not to replace the people you learn from.",
    },
    {
      q: "How long until I understand?",
      a: "Everyone is different. Our roadmap shows estimated hours for each stage, and your own hours show where you are.",
    },
    {
      q: "Which languages are coming?",
      a: "Egyptian Arabic is first. Join the waitlist and tell us which language you want next.",
      link: "Join the waitlist",
    },
  ],
} as const;

export const about = {
  title: "About Instik",
  description:
    "How to say Instik, how we help you pick up a language by understanding, and the promise we make about our hosts.",
  say: {
    title: "How to say it",
    body: "Instik is said in-STICK, with the stress on the second part.",
  },
  method: {
    title: "The method, in plain words",
    paragraphs: [
      "You pick up a language by understanding it. So you watch real people talk, in videos made for your level, until most of it makes sense. Context, gestures and drawings do the rest.",
      "There are no drills, no tests you have to pass and no streak panic. A listening check is there if you want one, and it never gets in your way.",
      "Every honest minute of watching counts. Only time with a video playing and the page open is added to your hours, and your roadmap shows where you are. Hours are estimates, not promises.",
    ],
  },
  hosts: {
    title: "Our promise about hosts",
    paragraphs: [
      "Every video is made with a real native speaker, and you can see and name them. There are no synthetic voices and no stock footage.",
      "We use technology to help you understand, not to replace the people you learn from.",
    ],
    link: "Meet the hosts",
  },
  cta: "Start watching free",
} as const;

export const privacy = {
  title: "Privacy",
  description: "A short, plain note on what Instik stores today. A full privacy policy is coming.",
  intro: "This is a short note, not the full policy. A full policy is coming before we open to everyone.",
  listTitle: "What we keep today",
  items: [
    "Your email address, and your name if you sign in with Google.",
    "Your language profiles: your stage and your usual minutes per day.",
    "Your watching: the hours you have counted, where you stopped in each video, and your answers to the optional “Did you follow this?” check.",
    "Waitlist emails. If you join the waitlist, we keep your email and the language you chose, and use them only to tell you when that language is ready.",
    "A scrambled form of your network address, kept for a short time and used only to limit how often sign-in links and waitlist sign-ups can be sent.",
  ],
  closing: "If you have a question about your data, tell us and we'll answer plainly.",
} as const;
