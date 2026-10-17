/**
 * Comprehensive Festival, National Occasion & Observance Calendar
 * Covers Major Indian Festivals, International Observances, and GoExperts Platform Milestones.
 * Uses the Gregorian Calendar with verified yearly dates for lunar/astronomical occasions (2025-2027).
 */

export interface FestivalOccasionDefinition {
  id: string;
  name: string;
  category: "INDIAN_FESTIVAL" | "INTERNATIONAL_OBSERVANCE" | "PLATFORM_MILESTONE";
  // "MM-DD" for fixed annual, or "YYYY-MM-DD" for verified year-specific date
  date: string;
  year?: number | null; // null if fixed Gregorian date every year
  recurrence: "ANNUAL_FIXED" | "VERIFIED_YEARLY";
  title: string;
  description: string;
  imageUrl: string;
  targetRole: "ALL" | "FREELANCER" | "CLIENT" | "FOUNDER" | "INVESTOR";
  scheduledTime: string; // e.g. "09:00" in Asia/Kolkata
  timezone: string; // "Asia/Kolkata"
  deepLink: string;
  offer?: string;
  isActive: boolean;
}

export const FESTIVAL_CALENDAR_SEEDS: FestivalOccasionDefinition[] = [
  // =========================================================================
  // 1. MAJOR INDIAN FESTIVALS & NATIONAL OCCASIONS
  // =========================================================================
  {
    id: "occ_new_year",
    name: "New Year's Day",
    category: "INTERNATIONAL_OBSERVANCE",
    date: "01-01",
    recurrence: "ANNUAL_FIXED",
    title: "Happy New Year from GoExperts! 🥂✨",
    description: "New year, bigger goals, higher earnings! Kickstart 2026 with exciting new project opportunities and partnerships.",
    imageUrl: "https://images.unsplash.com/photo-1546271876-af61566eb085?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Flat 0% Platform Commission on your first deal this January",
    isActive: true
  },
  {
    id: "occ_startup_day",
    name: "National Startup Day",
    category: "INTERNATIONAL_OBSERVANCE",
    date: "01-16",
    recurrence: "ANNUAL_FIXED",
    title: "Happy National Startup Day! 🚀🇮🇳",
    description: "Saluting bold founders, visionaries, and builders shaping tomorrow. Pitch your startup ideas to verified angel investors today!",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/founder/pitch",
    offer: "Complimentary Investor Pitch Review session",
    isActive: true
  },
  {
    id: "occ_republic_day",
    name: "Republic Day of India",
    category: "INDIAN_FESTIVAL",
    date: "01-26",
    recurrence: "ANNUAL_FIXED",
    title: "Happy 77th Republic Day! 🇮🇳",
    description: "Honoring India's spirit of innovation, unity, and excellence. We celebrate every expert shaping our nation's digital economy.",
    imageUrl: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Republic Day Special: Unlock Verified Pro Badge for 30 Days",
    isActive: true
  },
  // Holi (Verified Gregorian dates: 2025: 03-14, 2026: 03-04, 2027: 03-22)
  {
    id: "occ_holi_2025",
    name: "Holi - Festival of Colors",
    category: "INDIAN_FESTIVAL",
    date: "2025-03-14",
    year: 2025,
    recurrence: "VERIFIED_YEARLY",
    title: "Wishing You a Vibrant & Joyous Holi! 🎨🌈",
    description: "May your career and business be painted with colors of success, high-paying clients, and milestone payouts!",
    imageUrl: "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Use code HOLI2025 for instant 20% cashback on milestone escrow",
    isActive: true
  },
  {
    id: "occ_holi_2026",
    name: "Holi - Festival of Colors",
    category: "INDIAN_FESTIVAL",
    date: "2026-03-04",
    year: 2026,
    recurrence: "VERIFIED_YEARLY",
    title: "Wishing You a Vibrant & Joyous Holi! 🎨🌈",
    description: "May your career and business be painted with colors of success, high-paying clients, and milestone payouts!",
    imageUrl: "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Use code HOLI2026 for instant 20% cashback on milestone escrow",
    isActive: true
  },
  {
    id: "occ_womens_day",
    name: "International Women's Day",
    category: "INTERNATIONAL_OBSERVANCE",
    date: "03-08",
    recurrence: "ANNUAL_FIXED",
    title: "Happy International Women's Day! 🌸💪",
    description: "Celebrating remarkable women creators, tech architects, clients, and investors driving impact across GoExperts.",
    imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Featured Spotlight badge for top female founders and freelancers",
    isActive: true
  },
  // Eid ul-Fitr (Verified Gregorian dates: 2025: 03-31, 2026: 03-20)
  {
    id: "occ_eid_2025",
    name: "Eid ul-Fitr",
    category: "INDIAN_FESTIVAL",
    date: "2025-03-31",
    year: 2025,
    recurrence: "VERIFIED_YEARLY",
    title: "Eid Mubarak from GoExperts! 🌙✨",
    description: "May this festive occasion bring peace, prosperity, and abundant new business milestones to you and your loved ones.",
    imageUrl: "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Express Instant Payouts with ₹0 processing fee today",
    isActive: true
  },
  {
    id: "occ_eid_2026",
    name: "Eid ul-Fitr",
    category: "INDIAN_FESTIVAL",
    date: "2026-03-20",
    year: 2026,
    recurrence: "VERIFIED_YEARLY",
    title: "Eid Mubarak from GoExperts! 🌙✨",
    description: "May this festive occasion bring peace, prosperity, and abundant new business milestones to you and your loved ones.",
    imageUrl: "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Express Instant Payouts with ₹0 processing fee today",
    isActive: true
  },
  {
    id: "occ_labour_day",
    name: "International Workers' Day / Labour Day",
    category: "INTERNATIONAL_OBSERVANCE",
    date: "05-01",
    recurrence: "ANNUAL_FIXED",
    title: "Happy May Day! Celebrating Your Hard Work 🛠️💼",
    description: "Every line of code, design asset, and business deliverable creates value. Today we honor our incredible freelance workforce!",
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/freelancer/projects",
    offer: "Double Referral Bonus for every peer invited this week",
    isActive: true
  },
  {
    id: "occ_independence_day",
    name: "Independence Day of India",
    category: "INDIAN_FESTIVAL",
    date: "08-15",
    recurrence: "ANNUAL_FIXED",
    title: "Happy 79th Independence Day! 🇮🇳🕊️",
    description: "Celebrating freedom, digital empowerment, and Indian tech talent leading the world. Proud to build with GoExperts!",
    imageUrl: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Freedom Deal: 0% Platform Fee on milestone contracts",
    isActive: true
  },
  // Raksha Bandhan (2025: 08-09, 2026: 08-28)
  {
    id: "occ_raksha_bandhan_2026",
    name: "Raksha Bandhan",
    category: "INDIAN_FESTIVAL",
    date: "2026-08-28",
    year: 2026,
    recurrence: "VERIFIED_YEARLY",
    title: "Happy Raksha Bandhan! 🧵❤️",
    description: "Celebrating cherished bonds of trust, protection, and care. Gift yourself high-value contracts and reliable collaborations.",
    imageUrl: "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Instant Milestone Escrow Protection on every contract",
    isActive: true
  },
  // Ganesh Chaturthi (2025: 08-27, 2026: 09-14)
  {
    id: "occ_ganesh_chaturthi_2026",
    name: "Ganesh Chaturthi",
    category: "INDIAN_FESTIVAL",
    date: "2026-09-14",
    year: 2026,
    recurrence: "VERIFIED_YEARLY",
    title: "Happy Ganesh Chaturthi! Ganpati Bappa Morya! 🙏🐘",
    description: "May Lord Ganesha remove every obstacle on your entrepreneurial path and bless you with wisdom and immense prosperity.",
    imageUrl: "https://images.unsplash.com/photo-1567591414240-e15a77fcf98d?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Auspicious Launch: 50% discount on Verified Client posting pack",
    isActive: true
  },
  {
    id: "occ_gandhi_jayanti",
    name: "Gandhi Jayanti",
    category: "INDIAN_FESTIVAL",
    date: "10-02",
    recurrence: "ANNUAL_FIXED",
    title: "Remembering Mahatma Gandhi on Gandhi Jayanti 🕊️👓",
    description: "\"Be the change you wish to see in the world.\" We celebrate ethical business, integrity, and truthful collaboration.",
    imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "100% Escrow Integrity Guarantee on all GoExperts contracts",
    isActive: true
  },
  {
    id: "occ_freelancers_day",
    name: "International Freelancers Day",
    category: "INTERNATIONAL_OBSERVANCE",
    date: "10-19",
    recurrence: "ANNUAL_FIXED",
    title: "Happy International Freelancers Day! 💻🌟",
    description: "To the architects of modern independent work: You build products, launch companies, and solve tough problems daily. We salute you!",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/freelancer/profile",
    offer: "Free 1-Month Premium Freelancer Pro Membership",
    isActive: true
  },
  // Dussehra (2025: 10-02, 2026: 10-20)
  {
    id: "occ_dussehra_2026",
    name: "Dussehra / Vijayadashami",
    category: "INDIAN_FESTIVAL",
    date: "2026-10-20",
    year: 2026,
    recurrence: "VERIFIED_YEARLY",
    title: "Happy Dussehra & Vijayadashami! 🏹🔥",
    description: "Celebrating the triumph of hard work over failure, and innovation over stagnation. Win your next major project milestone today!",
    imageUrl: "https://images.unsplash.com/photo-1601662528567-526cd06f6582?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Vijayadashami Victory Boost: 3x Bidding Visibility for 7 Days",
    isActive: true
  },
  // Diwali (2025: 10-20, 2026: 11-08)
  {
    id: "occ_diwali_2026",
    name: "Diwali - Festival of Lights",
    category: "INDIAN_FESTIVAL",
    date: "2026-11-08",
    year: 2026,
    recurrence: "VERIFIED_YEARLY",
    title: "Shubh Deepavali from GoExperts! 🪔✨",
    description: "May your life and business glow with prosperity, happiness, and high-value partnerships. Wishing you a luminous Diwali!",
    imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Diwali Dhamaka: Flat ₹5,000 Milestone Cashback on contracts > ₹50,000",
    isActive: true
  },
  {
    id: "occ_christmas",
    name: "Christmas Day",
    category: "INDIAN_FESTIVAL",
    date: "12-25",
    recurrence: "ANNUAL_FIXED",
    title: "Merry Christmas from the GoExperts Family! 🎄🎅",
    description: "Wishing you warmth, cheer, and rewarding achievements. May your holiday season be filled with joy and new beginnings!",
    imageUrl: "https://images.unsplash.com/photo-1512474932049-78ac69ede12c?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Holiday Season Gift: Zero Escrow Commission until Dec 31",
    isActive: true
  },
  {
    id: "occ_new_years_eve",
    name: "New Year's Eve",
    category: "INTERNATIONAL_OBSERVANCE",
    date: "12-31",
    recurrence: "ANNUAL_FIXED",
    title: "Cheers to What We Built Together in 2026! 🥂🎆",
    description: "As the year comes to a close, review your completed projects and set your sights on higher heights for the coming year.",
    imageUrl: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Year-End Rewind Report & Pro Tier Renewal Savings",
    isActive: true
  },

  // =========================================================================
  // 2. GOEXPERTS PLATFORM MILESTONES & ANNIVERSARIES
  // =========================================================================
  {
    id: "occ_platform_anniversary",
    name: "GoExperts Platform Anniversary",
    category: "PLATFORM_MILESTONE",
    date: "06-15",
    recurrence: "ANNUAL_FIXED",
    title: "Celebrating GoExperts Foundation Day! 🎂🚀",
    description: "Thank you for being an indispensable part of India's premier expert ecosystem. Together, we empower top talent and businesses.",
    imageUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80",
    targetRole: "ALL",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/dashboard",
    offer: "Founders & Experts Special: Flat 50% Off Annual Subscriptions",
    isActive: true
  },
  {
    id: "occ_super_freelancer_day",
    name: "GoExperts Super Freelancer Day",
    category: "PLATFORM_MILESTONE",
    date: "09-01",
    recurrence: "ANNUAL_FIXED",
    title: "GoExperts Super Freelancer Day! 🏆💻",
    description: "Top-rated freelancers are receiving boosted client exposure and zero payout fees all day. Keep shining!",
    imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/freelancer/contracts",
    offer: "Exclusive Super Freelancer Badge awarded today",
    isActive: true
  },
  {
    id: "occ_founder_summit",
    name: "GoExperts Innovation & Founder Summit",
    category: "PLATFORM_MILESTONE",
    date: "11-15",
    recurrence: "ANNUAL_FIXED",
    title: "GoExperts Startup Summit is Live! 🎙️💡",
    description: "Connect with accredited angel syndicates, venture capitalists, and tech leaders looking to fund promising ideas.",
    imageUrl: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    scheduledTime: "09:00",
    timezone: "Asia/Kolkata",
    deepLink: "/founder/pitch",
    offer: "Direct VIP Fast-Track to top 10 Angel Investors",
    isActive: true
  }
];
