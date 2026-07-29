export const siteConfig = {
  name: "QCyberIndia",
  domain: "qcyberindia.com",

  tagline: "Your Remote Technology Partner",

  subTagline: "We Manage Technology. You Grow Your Business.",

  promise: "Build. Deploy. Secure. Scale.",

  description:
    "QCyberIndia is your remote technology partner for startups, MSMEs, educational institutions, and growing businesses across India. We take complete ownership of your technology—from cloud infrastructure and networking to cybersecurity, business applications, and day-to-day IT operations—so you can focus on growing your business.",

  city: "Chennai",

  email: {
    info: "info@qcyberindia.com",
    support: "support@qcyberindia.com",
    careers: "careers@qcyberindia.com",
    security: "security@qcyberindia.com",
  },
};

// Outcome-based framing for the homepage/solutions page — what a business
// owner is actually buying. Technology names live one level deeper, in
// serviceCategories below, not in the first message someone sees.
export type OutcomePillar = {
  id: string;
  title: string;
  promise: string;
  includes: string[];
};

export const outcomePillars = [
  {
    id: "operations",
    title: "Keep Your Business Running",
    promise: "Reliable technology that keeps your business running.",
    includes: [
      "Remote IT Support",
      "24×7 Monitoring",
      "Patch Management",
      "Business Continuity",
    ],
  },
  {
    id: "security",
    title: "Protect Your Business",
    promise: "Continuous protection for your people, devices, and data.",
    includes: [
      "Endpoint Protection",
      "Firewall Management",
      "Email Security",
      "Security Reviews",
    ],
  },
  {
    id: "infrastructure",
    title: "Build Your Infrastructure",
    promise: "Modern infrastructure built for performance and growth.",
    includes: [
      "Cloud Infrastructure",
      "Networking",
      "Business Wi-Fi",
      "Secure Remote Access",
    ],
  },
  {
    id: "growth",
    title: "Help Your Business Grow",
    promise: "Technology planning that grows with your business.",
    includes: [
      "Automation",
      "Technology Roadmaps",
      "Virtual CIO",
      "Performance Optimization",
    ],
  },
];

export type Industry = { id: string; name: string; note: string };

export const industries: Industry[] = [
  { id: "startups", name: "Startups", note: "Infrastructure that scales with funding rounds and headcount, without a full-time hire." },
  { id: "msme", name: "MSMEs", note: "Enterprise-grade IT, sized and priced for a growing business." },
  { id: "education", name: "Educational Institutions", note: "Segmented networks for labs, staff, and students, with audit-ready documentation." },
  { id: "manufacturing", name: "Manufacturing", note: "Reliable connectivity and security across office and floor systems." },
  { id: "healthcare", name: "Healthcare", note: "Data protection and uptime for systems that can't afford downtime." },
  { id: "professional-services", name: "Professional Services", note: "Secure client data handling and dependable day-to-day IT support." },
  { id: "retail", name: "Retail", note: "POS, connectivity, and backup systems that keep stores running." },
];

export type ServiceCategory = {
  id: string;
  title: string;
  summary: string;
  services: { name: string; description: string }[];
};

// Organized as a capability pyramid, not a list of technologies —
// a business owner reads this and understands scope, not jargon.
export const serviceCategories: ServiceCategory[] = [
  {
    id: "managed-it",
    title: "Managed IT",
    summary: "The day-to-day layer your employees actually touch.",
    services: [
      {
        name: "Remote Help Desk",
        description:
          "One place to email or call for any IT issue — a laptop, a login, a printer — and it gets handled, without your team having to know who's responsible.",
      },
      {
        name: "Device Management",
        description:
          "Onboarding new hires with the right access, patching software, and retiring old accounts when people leave — handled proactively, not when something breaks.",
      },
      {
        name: "Remote Employee Support",
        description: "Support for distributed and work-from-home staff, so location never becomes an IT problem.",
      },
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    summary: "The wiring and compute nobody thinks about until it goes down.",
    services: [
      {
        name: "Network Design & Segmentation",
        description:
          "VLAN architecture, dual-ISP redundancy, and firewall policy built around how your team actually works — not a generic template.",
      },
      {
        name: "Cloud & Server Management",
        description:
          "Provisioning, deployment, and patching across cloud and on-prem servers, sized to your workload and budget.",
      },
      {
        name: "Managed Wi-Fi & LAN",
        description: "Reliable coverage across offices, campuses, or labs, with guest/staff separation handled properly.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    summary: "Monitoring that catches problems before they become incidents.",
    services: [
      {
        name: "Firewall & Endpoint Protection",
        description: "Perimeter and device security tuned to your traffic patterns, not left on factory defaults.",
      },
      {
        name: "SOC Monitoring",
        description:
          "Continuous log correlation and threat-intel matching, watched by people — not just dashboards nobody reads.",
      },
      {
        name: "Backup & Disaster Recovery",
        description: "Automated, tested backups — because an untested backup is just a hope.",
      },
    ],
  },
  {
    id: "business-apps",
    title: "Business Applications",
    summary: "The software your business actually runs on.",
    services: [
      {
        name: "Business Email",
        description: "Setup and administration on Microsoft 365 or Google Workspace, with proper security policy from day one.",
      },
      {
        name: "License & Vendor Management",
        description: "We track your renewals, licenses, and vendor relationships so nothing lapses quietly and nobody overpays for seats you don't use.",
      },
      {
        name: "Application Hosting",
        description: "Your websites and internal tools, deployed properly and kept that way.",
      },
    ],
  },
  {
    id: "growth",
    title: "Growth",
    summary: "Where your IT partner starts paying for itself.",
    services: [
      {
        name: "Automation",
        description: "Removing repetitive manual IT work so your team's time goes toward things that actually need a person.",
      },
      {
        name: "Technology Roadmaps",
        description: "Quarterly reviews of what your business needs next, before you're forced into a reactive decision.",
      },
      {
        name: "Virtual CIO Guidance",
        description: "Strategic technology input at board-meeting level, without a full-time executive hire.",
      },
    ],
  },
];

export type ProcessStep = { step: string; title: string; description: string };

export const processSteps: ProcessStep[] = [
  {
    step: "01",
    title: "Assessment",
    description: "We understand your business, users, devices, applications, and current IT environment.",
  },
  {
    step: "02",
    title: "Plan",
    description: "We design the right infrastructure and support model for your business — not a generic package.",
  },
  {
    step: "03",
    title: "Deploy",
    description: "We implement networking, cloud, email, security, backups, and documentation.",
  },
  {
    step: "04",
    title: "Manage",
    description: "We monitor, maintain, update, and support everything — quietly, in the background.",
  },
  {
    step: "05",
    title: "Scale",
    description: "As your company grows, your technology grows with it.",
  },
];

export type PricingTier = {
  name: string;
  audience: string;
  features: string[];
  highlighted?: boolean;
};

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    audience: "5–15 employees",
    features: ["Remote help desk", "Business email administration", "Patch management", "Basic monitoring"],
  },
  {
    name: "Growth",
    audience: "15–50 employees",
    features: [
      "Everything in Starter",
      "Firewall management",
      "Automated backups",
      "Cloud administration",
      "Website & uptime monitoring",
    ],
    highlighted: true,
  },
  {
    name: "Business",
    audience: "50–250 employees",
    features: [
      "Everything in Growth",
      "Quarterly security reviews",
      "Vendor management",
      "Compliance assistance",
      "Priority support",
    ],
  },
];

export const statusMetrics = [
  {
    label: "Technology",
    value: "One Partner",
    description:
      "One trusted partner for cloud, networking, cybersecurity, websites, and business IT.",
  },
  {
    label: "Support",
    value: "One Help Desk",
    description:
      "One place to call for every technology issue, regardless of the vendor.",
  },
  {
    label: "Pricing",
    value: "One Monthly Plan",
    description:
      "Transparent monthly pricing with no hidden costs or surprise invoices.",
  },
  {
    label: "Accountability",
    value: "One Team",
    description:
      "One point of contact. Complete ownership from start to finish.",
  },
]; 