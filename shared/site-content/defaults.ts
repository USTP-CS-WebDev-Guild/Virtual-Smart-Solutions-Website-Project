export interface ServiceContent {
  id: string;
  title: string;
  description: string;
  image: string;
  examples: string[];
  published: boolean;
}

export interface FaqContent {
  id: string;
  question: string;
  answer: string;
  published: boolean;
}

export interface SiteSettings {
  businessName: string;
  shortName: string;
  eyebrow: string;
  email: string;
  privacyEmail: string;
  location: string;
  privacyNoticeVersion: string;
  homeEyebrow: string;
  homeHeadline: string;
  homeEmphasis: string;
  homeLede: string;
  homePrimaryCta: string;
  homeSecondaryCta: string;
  servicesEyebrow: string;
  servicesHeadline: string;
  servicesEmphasis: string;
  servicesLead: string;
  aboutEyebrow: string;
  aboutHeadline: string;
  aboutEmphasis: string;
  aboutLead: string;
  approachEyebrow: string;
  approachHeadline: string;
  approachEmphasis: string;
  approachLead: string;
  contactEyebrow: string;
  contactHeadline: string;
  contactEmphasis: string;
  contactLead: string;
  footerTagline: string;
  pricingNote: string;
  portfolioLead: string;
}

export interface PublicSiteContent {
  settings: SiteSettings;
  services: ServiceContent[];
  faqs: FaqContent[];
  plans: PlanContent[];
  portfolio: PortfolioContent[];
  team: TeamContent[];
}

export interface PlanContent {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  featured: boolean;
  published: boolean;
}
export interface PortfolioContent {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
  outcome: string;
  kind: 'example' | 'case-study';
  approved: boolean;
  published: boolean;
}
export interface TeamContent {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
  published: boolean;
}

// Starting content from the supplied VSS prototype. Owner-published revisions
// take precedence. Case-study claims require explicit owner approval.
export const DEFAULT_SITE_CONTENT: PublicSiteContent = {
  settings: {
    businessName: 'Virtual Smart Solutions',
    shortName: 'VSS',
    eyebrow: 'VIRTUAL ASSISTANT SERVICES · PHILIPPINES',
    email: 'virtualsmartsolutions@gmail.com',
    privacyEmail: 'virtualsmartsolutions@gmail.com',
    location: 'Philippines · Remote Worldwide',
    privacyNoticeVersion: 'vss-draft-2026-10',
    homeEyebrow: 'PHILIPPINE TALENT. GLOBAL POSSIBILITIES.',
    homeHeadline: 'Your business.',
    homeEmphasis: 'In capable hands.',
    homeLede:
      'Build a little more space into your day. Our Filipino virtual assistants take care of the details, from daily operations to your next customer conversation.',
    homePrimaryCta: 'Find your support',
    homeSecondaryCta: 'Explore services',
    servicesEyebrow: 'THE SUPPORT BEHIND YOUR NEXT CHAPTER',
    servicesHeadline: 'Less on your list.',
    servicesEmphasis: 'More room to grow.',
    servicesLead:
      'One recurring task or a wider operational role: find practical support that fits the way your business works.',
    aboutEyebrow: 'BASED IN THE PHILIPPINES. BUILT AROUND YOU.',
    aboutHeadline: 'Real people.',
    aboutEmphasis: 'Shared ambition.',
    aboutLead:
      'Virtual Smart Solutions connects businesses with Filipino virtual assistants for administration, customer coordination, social media, bookkeeping, and appointment setting.',
    approachEyebrow: 'A CLEAR START, A STEADIER EVERYDAY',
    approachHeadline: 'Good work starts',
    approachEmphasis: 'with a good handoff.',
    approachLead:
      'We get to know your workload, agree what success looks like, and put clear communication around the work before it begins.',
    contactEyebrow: 'LET’S TALK ABOUT YOUR NEXT CHAPTER',
    contactHeadline: 'What can we take',
    contactEmphasis: 'off your plate?',
    contactLead:
      'Tell us what is keeping you busy. We’ll discuss the right support, a practical scope, and the next steps for working together.',
    footerTagline: 'Philippines-based virtual assistants helping businesses worldwide grow smarter, faster, and leaner — 100% remote.',
    pricingNote:
      'Packages are a starting point. Scope, availability, hours, fees, and any additional charges are confirmed in writing before work begins. This inquiry is not a purchase or a subscription.',
    portfolioLead:
      'A closer look at the work we can take off your hands. Illustrative engagements are clearly marked; client case studies are published only after permission and results are verified.',
  },
  services: [
    {
      id: 'virtual-assistant',
      title: 'Virtual Assistant',
      description:
        'Keep the everyday moving. Delegate inboxes, calendars, research, and coordination to a dedicated pair of hands.',
      image: '/images/service-admin.webp',
      examples: [
        'Inbox and calendar management',
        'Meeting and travel coordination',
        'Research and report preparation',
        'CRM updates and follow-through',
      ],
      published: true,
    },
    {
      id: 'data-entry',
      title: 'Data Entry',
      description:
        'Give your information a reliable home. We organize, check, and maintain the records your team depends on.',
      image: '/images/service-data.webp',
      examples: [
        'Spreadsheet management',
        'Database cleanup',
        'Product and catalog updates',
        'Invoice and form processing',
      ],
      published: true,
    },
    {
      id: 'social-media',
      title: 'Social Media Marketing',
      description:
        'Show up with purpose. Get thoughtful content, consistent scheduling, and reporting that makes the next step clearer.',
      image: '/images/service-social.webp',
      examples: [
        'Content calendars',
        'Graphics and captions',
        'Scheduling and community replies',
        'Performance reporting',
      ],
      published: true,
    },
    {
      id: 'bookkeeping',
      title: 'Bookkeeping',
      description:
        'Keep your numbers organized and your records up to date, with a clear monthly view of the business.',
      image: '/images/service-books.webp',
      examples: [
        'Transaction recording',
        'Bank reconciliation',
        'Accounts payable and receivable',
        'QuickBooks and Xero support',
      ],
      published: true,
    },
    {
      id: 'appointment-setting',
      title: 'Appointment Setting',
      description:
        'Turn customer interest into a clear next conversation, with inbound coordination and approved outbound follow-up.',
      image: '/images/service-calls.webp',
      examples: [
        'Lead qualification',
        'Appointment coordination',
        'CRM tracking and reminders',
        'Call activity reports',
      ],
      published: true,
    },
  ],
  faqs: [
    {
      id: 'getting-started',
      question: 'How do we get started?',
      answer:
        'Send an inquiry with a little context about your workload. We follow up to understand your tools, priorities, and expected volume, then agree the scope, fee, and onboarding steps in writing.',
      published: true,
    },
    {
      id: 'choosing-plan',
      question: 'Do I need to choose a package now?',
      answer:
        'No. You can share a package preference, or choose “Not sure yet”. We confirm the workload, availability, and actual arrangement together before work starts. Sending an inquiry creates no subscription.',
      published: true,
    },
    {
      id: 'working-hours',
      question: 'What about time zones and working hours?',
      answer:
        'Coverage depends on the service and the arrangement we agree. We confirm working hours, response expectations, time zone, and any handover process before onboarding.',
      published: true,
    },
    {
      id: 'business-access',
      question: 'How do you handle access to my accounts?',
      answer:
        'We agree on the minimum access needed, use client-approved tools, and document decision boundaries. An NDA can be discussed before access is shared. Never include account passwords or sensitive records in an inquiry.',
      published: true,
    },
    {
      id: 'bookkeeping-scope',
      question: 'Does bookkeeping include professional advice?',
      answer:
        'Bookkeeping covers the agreed record-keeping and coordination work. Legal, tax, medical, and regulated financial advice must come from an appropriately qualified professional.',
      published: true,
    },
  ],
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      price: '₱8,000',
      period: '/ month',
      description: 'A focused start for independent business owners.',
      features: [
        '20 hours per month',
        'One dedicated VA',
        'One service area',
        'Email coordination',
        'Weekly progress update',
      ],
      featured: false,
      published: true,
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '₱18,000',
      period: '/ month',
      description: 'Steady support for a growing workload.',
      features: [
        '50 hours per month',
        'One dedicated VA',
        'Up to two service areas',
        'Priority coordination',
        'Agreed reporting schedule',
      ],
      featured: true,
      published: true,
    },
    {
      id: 'business',
      name: 'Business',
      price: '₱32,000',
      period: '/ month',
      description: 'Broader operational support for growing teams.',
      features: [
        'Two dedicated VAs',
        'Multiple service areas',
        'Hours agreed in written scope',
        'Agreed support coverage',
        'Weekly progress review',
      ],
      featured: false,
      published: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Let’s talk',
      period: '',
      description: 'A working arrangement shaped around your team.',
      features: [
        'Tailored team and workload',
        'Dedicated coordination',
        'Agreed service levels',
        'Custom reporting',
        'White-label options by agreement',
      ],
      featured: false,
      published: true,
    },
  ],
  portfolio: [
    {
      id: 'organized-operations',
      title: 'A calmer working week',
      category: 'Administration',
      description:
        'Inbox priorities, a coordinated calendar, and a follow-up list your team can trust.',
      image: '/images/service-admin.webp',
      outcome: 'Example scope: documented inbox rules, meeting preparation, and a weekly handoff.',
      kind: 'example',
      approved: false,
      published: true,
    },
    {
      id: 'consistent-presence',
      title: 'A more consistent presence',
      category: 'Social media',
      description:
        'A repeatable rhythm for planning, preparing, and scheduling the content your audience needs.',
      image: '/images/service-social.webp',
      outcome:
        'Example scope: a content calendar, approved assets, community coordination, and reporting.',
      kind: 'example',
      approved: false,
      published: true,
    },
    {
      id: 'clearer-records',
      title: 'A clearer view of the numbers',
      category: 'Bookkeeping',
      description:
        'Day-to-day records organized so your business and its accountant can work from a clearer picture.',
      image: '/images/service-books.webp',
      outcome:
        'Example scope: transaction recording, reconciliation, and an agreed reporting handoff.',
      kind: 'example',
      approved: false,
      published: true,
    },
  ],
  team: [
    {
      id: 'vanessa',
      name: 'Vanessa Clo Zaisa E. Aricayos',
      role: 'Chief Executive Officer',
      bio: 'Founder of Virtual Smart Solutions, bringing a practical approach to connecting Filipino remote talent with businesses around the world.',
      image: '/images/founder.jpg',
      published: true,
    },
    {
      id: 'ric',
      name: 'Ric A. Aricayos',
      role: 'Chief Marketing Officer',
      bio: 'Leading marketing and client development at VSS, helping businesses find a working arrangement that fits their next stage.',
      image: '/images/marketing-lead.jpg',
      published: true,
    },
  ],
};
