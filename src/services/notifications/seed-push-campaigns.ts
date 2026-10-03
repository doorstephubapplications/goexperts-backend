import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const DEFAULT_SCHEDULE_SETTINGS = [
  {
    slotKey: "slot_1",
    label: "Morning Kickoff Dispatch",
    time: "09:30",
    isEnabled: true,
    targetRole: "ALL"
  },
  {
    slotKey: "slot_2",
    label: "Midday Rush Dispatch",
    time: "12:30",
    isEnabled: true,
    targetRole: "ALL"
  },
  {
    slotKey: "slot_3",
    label: "Evening Wrap-up Dispatch",
    time: "18:30",
    isEnabled: true,
    targetRole: "ALL"
  }
];

export const CAMPAIGNS_120 = [
  // ==========================================
  // FREELANCER CAMPAIGNS (30 UNIQUE - ZOMATO STYLE)
  // ==========================================
  {
    title: "Chai is hot, and so are these 8 React gigs ☕🔥",
    description: "Don't let your morning brew get cold while someone else submits a proposal. Verified clients are waiting!",
    imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Morning Opportunities",
    offer: "0% Service Fee on your first winning proposal today",
    deepLink: "/freelancer/projects?filter=recent",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Client approved budget with zero bargaining! 😭🎉",
    description: "Yes, miracles do happen. A high-budget enterprise client just posted a backend architecture gig.",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "High Budget Gigs",
    offer: "VIP Badge applied to your bid",
    deepLink: "/freelancer/projects?budget=high",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Hungry for projects? We served fresh ones! 🍕💻",
    description: "Full-stack, UI/UX, and AI gigs straight out of the oven. Top freelancers are already submitting bids.",
    imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Fresh Feed",
    offer: "Free 2x Boost Token inside",
    deepLink: "/freelancer/projects",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Your bank account asked us to tell you this... 💸👀",
    description: "Milestone payments worth over ₹4,50,000 were cleared today. Tap to claim your next milestone project!",
    imageUrl: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Instant Escrow",
    offer: "Instant withdrawal with ₹0 gateway fee",
    deepLink: "/freelancer/wallet",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Psst... 3 clients visited your profile today 👀✨",
    description: "Your portfolio is catching eyes. Update your hourly rate and showcase your latest case studies now.",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Profile Spotlight",
    offer: "Featured Profile status for next 24 hours",
    deepLink: "/freelancer/profile",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch is done. Now let's grab that ₹85,000 project 🍱🚀",
    description: "A Delhi fintech company is looking for a senior developer for a 3-week sprint. Quick turnaround preferred.",
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Speed Hiring",
    offer: "Priority Client Review Guarantee",
    deepLink: "/freelancer/projects?tag=urgent",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Bug fixed? Now fix your weekend plans with this payout! 🏖️💰",
    description: "Close out pending deliverables before Friday 6 PM to enjoy instant milestone settlements directly to UPI.",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Weekend Perks",
    offer: "Express 15-minute UPI transfer",
    deepLink: "/freelancer/contracts",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Warning: High demand for Flutter & React Native 📱⚡",
    description: "Over 14 mobile app gigs were posted in the last 2 hours. Your tech stack is on fire today!",
    imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Tech Trends",
    offer: "5 Free Proposal Connects credited",
    deepLink: "/freelancer/projects?category=mobile",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Freelancing rule #1: Never sleep on an unread invite 💌⏰",
    description: "A verified client sent you a direct interview invite. Respond within 30 mins to boost your response score!",
    imageUrl: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Direct Invites",
    offer: "Client response guarantee boost",
    deepLink: "/freelancer/messages",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Late night coding session? Fuel up with a new contract 🌙💻",
    description: "US & European clients are active right now looking for remote engineers and UI designers.",
    imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Global Gigs",
    offer: "USD to INR best exchange rate lock",
    deepLink: "/freelancer/projects?region=international",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Your skills are too good for a dry spell 🌟🎯",
    description: "We handpicked 5 contracts matching your exact portfolio tags. See why algorithm picked you.",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Algorithm Picks",
    offer: "Top-Ranked Bid placement",
    deepLink: "/freelancer/recommended",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "100% Escrow Funded: Build without payment anxiety 🛡️💚",
    description: "Every gig in this section has 100% of the funds securely locked in platform escrow. Zero payment risk.",
    imageUrl: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Safe Payments",
    offer: "Escrow Protection Insurance included",
    deepLink: "/freelancer/projects?escrow=funded",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Did somebody say 5-star review streak? ⭐⭐⭐⭐⭐",
    description: "Your client satisfaction score is in the top 5% on Go Experts. Check out your badge rewards!",
    imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Reputation Boost",
    offer: "Pro Freelancer badge unlocked",
    deepLink: "/freelancer/profile",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Drop everything: UI/UX Redesign gig just posted 🎨✨",
    description: "E-commerce brand doing a ₹1.2L design overhaul. Needs modern Figma components and prototyping.",
    imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Design Spotlight",
    offer: "Portfolio presentation spotlight",
    deepLink: "/freelancer/projects?category=design",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Proposals sent: 0? Let's fix that before lunch 🍛⚡",
    description: "Top earning freelancers apply to 2-3 targeted gigs daily. Tap to submit your proposal in under 60 seconds.",
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Daily Hustle",
    offer: "AI Proposal Cover Letter Assistant free",
    deepLink: "/freelancer/projects",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Clock out with wallet green! ₹25,000 milestone released 🟢💸",
    description: "Your client just approved your milestone. Cash out instantly or reinvest in bid boost tokens.",
    imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Milestone Payout",
    offer: "Zero deduction instant payout",
    deepLink: "/freelancer/wallet",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Need coffee? We have that and 12 Python tasks ☕🐍",
    description: "Automation, scraping, and FastAPI backends are trending heavily this morning on the job board.",
    imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Python & AI",
    offer: "Direct client chat unlock",
    deepLink: "/freelancer/projects?tech=python",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Client is in a hurry: 48-Hour Rapid Sprint Available 🏃💨",
    description: "Quick landing page fix with a handsome bonus for express delivery. Are you ready for the sprint?",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Express Sprints",
    offer: "+20% Express Rush Bonus included",
    deepLink: "/freelancer/projects?type=sprint",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Your competition is resting. Time to pitch! 🎯🦉",
    description: "Less proposal traffic on the platform right now means your bid stays right at the top of client's inbox.",
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Evening Edge",
    offer: "Top-of-Inbox highlight free",
    deepLink: "/freelancer/projects",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Good morning! New long-term contract alert (6 Months) 📅💼",
    description: "Looking for stability? A Bangalore SaaS company wants a dedicated frontend engineer for 6 months.",
    imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Retainer Gigs",
    offer: "Monthly Retainer Escrow Protection",
    deepLink: "/freelancer/projects?type=retainer",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "No more scope creep! Protected contracts inside 🛡️📋",
    description: "All milestone requirements are locked before you write a single line of code. Work with 100% clarity.",
    imageUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Contract Safety",
    offer: "Dispute-free guarantee active",
    deepLink: "/freelancer/contracts",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Friday night flex: Top Freelancer Leaderboard updated 🏆✨",
    description: "Check where you stand among the top 100 earners this week. Exclusive tier perks await top rankers!",
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Leaderboard",
    offer: "Top 100 earner commission discount",
    deepLink: "/freelancer/leaderboard",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Breakfast with Next.js 14? 🥞⚡",
    description: "SSR, App Router, and Server Actions projects are surging. Show off your modern React chops today.",
    imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Modern Stack",
    offer: "Free proposal skill assessment badge",
    deepLink: "/freelancer/projects?tech=nextjs",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch break reading: How Sharma made ₹3.2L this month 📖💡",
    description: "Read the breakdown of how top Go Experts creators optimize their bids and close clients within 2 hours.",
    imageUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Creator Insights",
    offer: "Free Freelancer Playbook Guide",
    deepLink: "/freelancer/insights",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Wrap up your deliverables & trigger instant payout ⏱️💳",
    description: "Client confirmed all acceptance criteria. Tap approve to transfer funds straight into your account.",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Instant Transfer",
    offer: "Zero fee transfer pass valid today",
    deepLink: "/freelancer/wallet",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Rise and grind: 12 New Enterprise contracts live 🌅🏢",
    description: "Fortune 500 & Series A startups are actively staffing through Go Experts. High budgets, verified teams.",
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Enterprise Gigs",
    offer: "Enterprise Verified Freelancer tag",
    deepLink: "/freelancer/projects?tier=enterprise",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Midday Power-up: Your connects renewed! 🔋⚡",
    description: "We just topped up your proposal connects. Apply to that dream project you bookmarked yesterday.",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Proposal Boost",
    offer: "+10 Bonus proposal connects added",
    deepLink: "/freelancer/projects",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Dinner is served, but so is this ₹1.5L Mobile App Contract 🍲📱",
    description: "A travel tech startup is building an iOS & Android booking engine. Bidding closes in 4 hours!",
    imageUrl: "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Hot Contracts",
    offer: "Featured Bid badge included",
    deepLink: "/freelancer/projects?id=urgent-mobile",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Your code is poetry. Let's get it well paid! ✍️💎",
    description: "Clean code deserves premium rates. Check out our high-tier client listings with ₹2,000+/hr budgets.",
    imageUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Premium Rates",
    offer: "Rate negotiation tool unlocked",
    deepLink: "/freelancer/projects?minRate=1500",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Night owl special: International clients are hiring now 🦉🌍",
    description: "US clients just started their business day. Be the first proposal they review with your coffee ready.",
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
    targetRole: "FREELANCER",
    category: "Night Gigs",
    offer: "Instant notification for US jobs",
    deepLink: "/freelancer/projects?market=us",
    scheduleSlot: "SLOT_3"
  },

  // ==========================================
  // CLIENT CAMPAIGNS (30 UNIQUE - ZOMATO STYLE)
  // ==========================================
  {
    title: "Hiring a developer shouldn't feel like a Tinder date 🤝📱",
    description: "No ghosting, no fake resumes. Get 3 vetted senior engineers matched to your project in 30 minutes.",
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Instant Matching",
    offer: "₹2,500 Escrow Bonus on your first hire",
    deepLink: "/client/post-project",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Need your MVP built before your investor asks? ⏳🚀",
    description: "Top 1% developers ready to sprint. Review portfolios with live demo links and verified Github commits.",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "MVP Velocity",
    offer: "Free Code Review on completion",
    deepLink: "/client/freelancers?skill=fullstack",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Tired of missed deadlines? Meet our 99% on-time talent ⏱️🎯",
    description: "Every milestone comes with automated escrow safety. You only release funds when you're 100% satisfied.",
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Milestone Safety",
    offer: "100% Money-back escrow guarantee",
    deepLink: "/client/post-project",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Your competitor just launched their app. What about you? 👀⚡",
    description: "Post your project in 60 seconds and receive proposals from battle-tested mobile app creators today.",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Competitive Edge",
    offer: "Free Project Promotion to Top 50 devs",
    deepLink: "/client/post-project",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch time hiring sprint: 5 Proposals waiting for you 🥪💼",
    description: "Expert freelancers reviewed your job post and submitted technical proposals. Tap to interview the best.",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Proposal Review",
    offer: "1-Click Video Interview Link",
    deepLink: "/client/proposals",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Save up to 40% compared to traditional dev agencies 💰💡",
    description: "Direct talent hiring with zero agency overhead or middleman fees. Transparent hourly and fixed rates.",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Cost Efficiency",
    offer: "0% Client Processing Fee this week",
    deepLink: "/client/pricing",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Morning briefing: 15 New verified specialists joined 🌅✨",
    description: "Senior DevOps, AI engineers, and product designers are open for contracts. Check their verified badges.",
    imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "New Talent",
    offer: "Free Direct Talent Invites (5/5)",
    deepLink: "/client/freelancers?badge=verified",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "UI look like 2012? Time for a design revamp 🎨✨",
    description: "Top Figma designers available for design sprints. Get modern, sleek interfaces your users will fall in love with.",
    imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "UI/UX Talent",
    offer: "Free Design Audit with first hire",
    deepLink: "/client/freelancers?skill=figma",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Leave the bugs behind. Sleep peacefully tonight 🌙🛌",
    description: "Hire QA testers and automation engineers to stress-test your web and mobile applications.",
    imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "QA & Testing",
    offer: "Comprehensive Bug Report guarantee",
    deepLink: "/client/freelancers?skill=qa",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Your dream developer is probably sipping chai right now ☕💻",
    description: "Invite verified talent directly to your project before other companies book their sprint schedule.",
    imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Direct Outreach",
    offer: "Priority Direct Message Dispatch",
    deepLink: "/client/freelancers",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Need an AI integration yesterday? 🤖⚡",
    description: "LangChain, OpenAI API, and custom RAG pipeline experts ready to integrate LLMs into your SaaS.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "AI & ML",
    offer: "Free AI Architecture Consultation",
    deepLink: "/client/freelancers?skill=ai",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Friday deadline looming? Bring in an emergency sprint dev 🚨⚡",
    description: "Rapid deployment engineers available for on-demand 24 to 48-hour turnarounds.",
    imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Emergency Sprint",
    offer: "Express Turnaround Guarantee",
    deepLink: "/client/post-project?urgent=true",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Post once, relax. Top proposals arrive in 15 mins ☕✨",
    description: "Our smart-match algorithm alerts the best matched freelancers the moment your job goes live.",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Instant Reach",
    offer: "Featured Job Listing at no extra cost",
    deepLink: "/client/post-project",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Got an unfinished project? Let our fixers finish it 🔧💪",
    description: "Rescue projects from abandoned codebases. Our senior engineers specialize in auditing and fixing broken apps.",
    imageUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Code Rescue",
    offer: "Complimentary Code Audit",
    deepLink: "/client/post-project?type=rescue",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Review work before paying a single rupee 🛡️💎",
    description: "With Go Experts Milestone Escrow, funds stay in your name until you inspect and approve the work.",
    imageUrl: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Protected Hiring",
    offer: "Escrow Assurance Policy active",
    deepLink: "/client/contracts",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Scale your dev team without HR headaches 📈🏢",
    description: "Hire full squads or individual contractors with zero payroll overhead, compliantly and fast.",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Team Scaling",
    offer: "Dedicated Account Manager for 3+ hires",
    deepLink: "/client/team-hiring",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch special: Hire a WordPress / Shopify wizard 🛍️⚡",
    description: "E-commerce stores needing speed optimization, custom checkout, or redesign. Fast turnaround.",
    imageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "E-Commerce",
    offer: "Speed Optimization score guarantee",
    deepLink: "/client/freelancers?skill=shopify",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Your project deserves better than average work ⭐⭐⭐⭐⭐",
    description: "Explore our Top Rated Plus freelancers with 100% project completion records and client praises.",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Top Tier Talent",
    offer: "VIP Talent Matching session free",
    deepLink: "/client/freelancers?rating=5",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Good morning! Ready to kick off that mobile app? 📱🚀",
    description: "Over 50 iOS and Android specialists available for immediate sprint kickoff. Check recent portfolios.",
    imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Mobile Launch",
    offer: "Free App Store Deployment support",
    deepLink: "/client/post-project?category=mobile",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Midday reminder: Your project draft is almost done 📝⏳",
    description: "You're 1 step away from reaching 15,000+ top freelancers. Hit publish and get bids rolling in.",
    imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Draft Recovery",
    offer: "Boosted placement upon publishing",
    deepLink: "/client/drafts",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Evening check-in: 3 New deliverables ready for your approval 📬✅",
    description: "Your assigned freelancer just submitted milestone artifacts. Review code and design updates now.",
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Milestone Approval",
    offer: "1-Click Feedback & Revision tool",
    deepLink: "/client/contracts",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Stop waiting weeks for agencies to reply 😤⚡",
    description: "On Go Experts, verified developers start within 24 hours of contract acceptance. Try modern hiring.",
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Agile Speed",
    offer: "24-Hour Kickoff Guarantee",
    deepLink: "/client/post-project",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Need a high-converting landing page before next week? 🎯📈",
    description: "Copywriters + Webflow / Next.js developers paired together to build conversion-driven pages.",
    imageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Growth & Landing",
    offer: "Free SEO Starter Package included",
    deepLink: "/client/freelancers?skill=webflow",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Night owls working on your product right now 🌙🦉",
    description: "Global talent across time zones keeps your product building 24/7 while you rest.",
    imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "24/7 Development",
    offer: "Cross-timezone coordination tool",
    deepLink: "/client/dashboard",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Coffee brewed? Let's find your lead architect ☕🏛️",
    description: "Microservices, AWS/GCP cloud setups, and scalable architectures built by veterans.",
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Cloud Architecture",
    offer: "Free Cloud Cost Optimization audit",
    deepLink: "/client/freelancers?skill=aws",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Hiring on budget? Transparent hourly rates starting ₹500/hr 💵✨",
    description: "Filter by skill level, past client reviews, and hourly rates to match your budget perfectly.",
    imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Budget Matching",
    offer: "Transparent rate calculator",
    deepLink: "/client/freelancers",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Wrap up your week: 100% of your milestones on track 📊🎉",
    description: "Check your active project progress dashboard and communicate with your team effortlessly.",
    imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Progress Dashboard",
    offer: "Automated Weekly Progress Report",
    deepLink: "/client/dashboard",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "New feature idea? Validate it with an expert in 1 hour 💡💬",
    description: "Book an advisory consultation call with industry specialists before investing in heavy coding.",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Tech Consultation",
    offer: "First 30-min consultation subsidized",
    deepLink: "/client/consultations",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Post a job in under 60 seconds with our AI Assistant 🤖✨",
    description: "Just type your project idea and let AI generate the job scope, budget estimate, and required skills.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "AI Job Creation",
    offer: "AI Job Description Generator free",
    deepLink: "/client/post-project?ai=true",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "End of day alert: Top 3 freelancers available for next week 🌟💼",
    description: "Book top-rated talent before their calendar fills up for next week's sprint cycles.",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
    targetRole: "CLIENT",
    category: "Advance Booking",
    offer: "Zero reservation deposit required",
    deepLink: "/client/freelancers",
    scheduleSlot: "SLOT_3"
  },

  // ==========================================
  // FOUNDER CAMPAIGNS (30 UNIQUE - ZOMATO STYLE)
  // ==========================================
  {
    title: "Coffee cold? Pitch deck hot! ☕🔥 5 Angels browsing tech",
    description: "Early-stage angel investors are scouting B2B SaaS and AI startups today. Update your deck.",
    imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Investor Access",
    offer: "Featured Pitch Deck spotlight",
    deepLink: "/founder/fundraising",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Looking for a Technical Co-founder without equity fights? 🤝💡",
    description: "Partner with fractional CTOs and senior tech leads to build your product while retaining your cap table.",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Fractional CTO",
    offer: "Cap-table legal advisory template",
    deepLink: "/founder/co-founders",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Runway looking tight? Build lean with verified contractors 📉🛡️",
    description: "Cut monthly burn by 60% compared to full-time hires. Hire sprint-by-sprint with zero long-term liabilities.",
    imageUrl: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Runway Optimization",
    offer: "Free Burn-Rate Calculator Tool",
    deepLink: "/founder/hiring",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Your pitch deck was viewed 14 times this week 👀📊",
    description: "Investors are spending an average of 3m 40s on your financial projections. See who checked your startup.",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Deck Analytics",
    offer: "Investor Identity Reveal token",
    deepLink: "/founder/analytics",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch pitch: ₹50L seed syndicate open for entries 🍱🦄",
    description: "Curated founder showcase happening this Thursday. Submit your traction numbers to get shortlisted.",
    imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Syndicate Access",
    offer: "Fast-Track Review by Lead Partner",
    deepLink: "/founder/syndicate",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "From zero to product-market fit: The Founder Playbook 📚🚀",
    description: "Read how 3 founders on Go Experts reached $10k MRR in under 90 days with remote development teams.",
    imageUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Founder Stories",
    offer: "Free Growth Playbook PDF",
    deepLink: "/founder/resources",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Morning check: Is your MVP launch-ready? 🌅📱",
    description: "Get a 24-hour security, performance, and UX audit from seasoned startup engineering leads.",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "MVP Audit",
    offer: "Free Pre-Launch Checklist Report",
    deepLink: "/founder/audit",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Don't build in secret. Show your beta to 5,000 users 📣✨",
    description: "Launch your private beta on the Go Experts Community and get real feedback from day one.",
    imageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Beta Testing",
    offer: "Free Community Featured Banner",
    deepLink: "/founder/community",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Cap table clean? Term sheet season is officially here 📑✍️",
    description: "Get legal and compliance templates tailored for Indian and US Delaware C-corp startups.",
    imageUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Legal & SAFE",
    offer: "Standard SAFE Agreement templates",
    deepLink: "/founder/legal",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Good morning! New grant & credit perks available ☕🎁",
    description: "Claim up to $10,000 in AWS, Stripe, and Google Cloud credits through our founder perk network.",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Cloud Perks",
    offer: "$10,000 Cloud credits bundle",
    deepLink: "/founder/perks",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Stop attending useless webinars. Talk to real investors 🎯💼",
    description: "Skip the middlemen. Schedule 1-on-1 virtual speed pitches with active pre-seed and seed funds.",
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Speed Pitching",
    offer: "Direct Partner Matchmaking pass",
    deepLink: "/founder/pitching",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Night owl founders: Let's clean up that backlog 🌙💻",
    description: "Hire a dedicated bug squad to clear out pending Github issues before Monday morning sprint review.",
    imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Sprint Backlog",
    offer: "Sprint Setup Assistance free",
    deepLink: "/founder/hiring",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Your competitors are raising. Time to accelerate 🚀💸",
    description: "Highlight your MoM traction to our network of 250+ verified angel investors and venture scouts.",
    imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Fundraise Acceleration",
    offer: "Weekly Venture Digest feature",
    deepLink: "/founder/fundraising",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Hire your core founding engineer in 48 hours ⚡👨‍💻",
    description: "We filtered out candidates with verified 4+ years of startup experience who know how to ship fast.",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Founding Engineer",
    offer: "Zero placement fee on first hire",
    deepLink: "/founder/hiring",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Friday celebration: Another founder on Go Experts raised ₹1Cr 🥂🎉",
    description: "Read how MedTech founder Ananya connected with her lead angel through our Deal Flow showcase.",
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Success Stories",
    offer: "Case study & Pitch Deck template",
    deepLink: "/founder/stories",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Chai time thought: What's holding back your release? ☕🤔",
    description: "Is it design, frontend, or APIs? Book an on-demand specialist to unblock your product roadmap today.",
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Roadmap Unblock",
    offer: "Free Roadmap Consultation",
    deepLink: "/founder/hiring",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Tired of managing 5 different freelancers? Hire a squad 🤝🏢",
    description: "Get a pre-assembled pod: 1 UI designer, 2 full-stack engineers, and 1 QA lead working as one unit.",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Product Pods",
    offer: "10% Squad Discount for 3 months",
    deepLink: "/founder/squads",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Wrap up the week: Share your monthly investor update 📊💌",
    description: "Clean investor updates build trust. Use our automated update builder to send metrics in 2 minutes.",
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Investor Relations",
    offer: "Automated Investor Memo Builder",
    deepLink: "/founder/updates",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Breakfast with angels: 3 Micro-VCs joined Go Experts 🥞💼",
    description: "Specializing in SaaS, D2C, and Fintech early-stage rounds. Review their investment thesis.",
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Micro-VC Network",
    offer: "Direct intro request credit (1/1)",
    deepLink: "/founder/investors",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Turn your napkin sketch into a clickable prototype 🎨✨",
    description: "Prototype before coding. Top product designers deliver interactive Figma demos in 5 business days.",
    imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Prototyping",
    offer: "Figma Component Library included",
    deepLink: "/founder/hiring?type=prototype",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "No more 18-hour days. Delegate execution tonight 🌙🧘",
    description: "Focus on strategy, hiring, and customers. Let verified contractors handle the repetitive engineering tasks.",
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Founder Wellness",
    offer: "Delegation Starter Guide",
    deepLink: "/founder/dashboard",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Good morning! New AI grant program for early founders 🌅🤖",
    description: "Apply for up to ₹25L in compute credits and accelerator mentorship through our platform partners.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "AI Grants",
    offer: "Fast-Track Grant Application",
    deepLink: "/founder/grants",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Need customer acquisition? Meet Growth Hacker specialists 📈🎯",
    description: "Performance marketing, programmatic SEO, and B2B cold outreach experts ready to jump in.",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Growth & GTM",
    offer: "Free GTM Audit Session",
    deepLink: "/founder/hiring?skill=growth",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Friday night pitch practice: AI Deck Coach is live 🎤🤖",
    description: "Upload your deck and get instant feedback on clarity, market sizing, and valuation realism.",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "AI Deck Coach",
    offer: "Free AI Pitch Scorecard",
    deepLink: "/founder/pitch-coach",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Build your Advisory Board: Industry veterans open for calls 📞🏛️",
    description: "Ex-founders and CXOs offering 1-hour strategic advisory to guide product-market fit and B2B pricing.",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Advisory Board",
    offer: "1st Advisory call subsidized by 50%",
    deepLink: "/founder/advisors",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch reminder: Your traction data is out of date 🥪📈",
    description: "Founders with updated MRR and user metrics receive 3.5x more investor meeting inquiries. Update now!",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Traction Metrics",
    offer: "Automated Stripe metric sync",
    deepLink: "/founder/profile",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Evening inspiration: 3 Mistakes that kill early startups ⚠️💡",
    description: "Read our teardown of the top technical mistakes that burn founder capital before launch.",
    imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Founder Teardown",
    offer: "Technical Debt Checklist",
    deepLink: "/founder/articles",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Start your week strong: 5 Vetted Fractional CTOs ready 🚀👨‍💻",
    description: "Need senior technical architecture without a 50L salary? Fractional leadership gives you 20 hrs/week.",
    imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Fractional Tech",
    offer: "Interview 2 candidates free",
    deepLink: "/founder/hiring?type=fractional",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Product demo ready? Record a 2-min Loom and get featured 📹✨",
    description: "Founders with video demos get 4x more investor clicks on our weekly curated digest.",
    imageUrl: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Video Demos",
    offer: "Featured Video slot on Explore feed",
    deepLink: "/founder/showcase",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Dream big, build lean: Rest up for tomorrow's sprint 🌟🛌",
    description: "Over 80 founder milestones were successfully completed today. Your turn is coming up next.",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80",
    targetRole: "FOUNDER",
    category: "Founder Motivation",
    offer: "Weekly Founder Digest delivery",
    deepLink: "/founder/dashboard",
    scheduleSlot: "SLOT_3"
  },

  // ==========================================
  // INVESTOR CAMPAIGNS (30 UNIQUE - ZOMATO STYLE)
  // ==========================================
  {
    title: "Profitable from Day 1? Rare, but real 🦄💎",
    description: "A bootstrapped B2B SaaS startup with ₹18L ARR just opened a ₹50L growth round on Go Experts.",
    imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Exclusive Deal Flow",
    offer: "Full Due Diligence Data Room Access",
    deepLink: "/investor/dealflow",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Your morning coffee pairs well with 12% IRR ☕📈",
    description: "Review 3 newly vetted early-stage startups in AI Infrastructure, Fintech, and HealthTech.",
    imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Curated Deals",
    offer: "1-Click Term Sheet Request",
    deepLink: "/investor/dealflow?tier=vetted",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Skip the fluff: 1-Page verified traction memos inside 📄✨",
    description: "Verified Stripe revenue, active churn rate, and CAC numbers audited before listing.",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Verified Metrics",
    offer: "Direct Founder AMA Access",
    deepLink: "/investor/memos",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Co-invest alongside Top Tier Angel Syndicates 🤝🏛️",
    description: "A seed round led by ex-Unicorn founders is 75% subscribed. ₹2.5L ticket sizes open for angels.",
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Syndicate Co-Invest",
    offer: "Zero Syndicate Carry on your first deal",
    deepLink: "/investor/syndicates",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Early bird deal alert: Pre-Seed AI tool with 40k MAUs 🤖🚀",
    description: "Founders graduated from IIT Madras and are raising a SAFE round at a reasonable cap. Review deck.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Early Bird",
    offer: "Early Cap Valuation discount access",
    deepLink: "/investor/dealflow?id=ai-tool",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunchtime portfolio update: Q3 Valuation reports live 🍱📊",
    description: "Check updated cap table valuations and founder quarterly updates for your existing commitments.",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Portfolio Tracking",
    offer: "Automated Tax Loss & Gain report",
    deepLink: "/investor/portfolio",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Want zero noise in your inbox? We do the vetting 🛡️🎯",
    description: "Only 4 out of 100 applied startups make it past our tech and revenue verification filter.",
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Quality Filter",
    offer: "Personalized Deal Alerts setup",
    deepLink: "/investor/preferences",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Founders with 80% repeat customers are raising now 🔁💎",
    description: "B2B SaaS with incredible retention metrics. Founder open for 15-minute introductory Zoom calls.",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "High Retention",
    offer: "Direct Calendar booking link",
    deepLink: "/investor/dealflow?metric=retention",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Midday deal drop: Clean Energy IoT Startup ⚡🌱",
    description: "Patent-pending smart grid controller with enterprise pilot contracts in Gujarat and Karnataka.",
    imageUrl: "https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "CleanTech",
    offer: "Pilot Contracts verification audit",
    deepLink: "/investor/dealflow?sector=cleantech",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Evening wrap-up: 2 Deals closing allocation tonight ⏱️🚪",
    description: "Rounds for CloudSec and RetailAI are closing oversubscribed at 11:59 PM. Reserve ticket size.",
    imageUrl: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Closing Soon",
    offer: "Priority Allocation Hold (2 Hours)",
    deepLink: "/investor/closing-soon",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Morning Market Pulse: India Seed Venture Digest 🌅📰",
    description: "Key valuation benchmarks, sector multiples, and active angel syndicate trends this quarter.",
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Market Intelligence",
    offer: "Quarterly Valuation Multiples Chart",
    deepLink: "/investor/insights",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "D2C Brand with ₹80L annual run-rate looking for angels 🛍️📈",
    description: "Healthy gross margins of 68% and positive unit economics. Tap to review product samples and deck.",
    imageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "D2C & Consumer",
    offer: "Product Sample Box dispatch request",
    deepLink: "/investor/dealflow?sector=d2c",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Review Term Sheets from your smartphone in 60 seconds 📱✍️",
    description: "Digital signatures, escrow settlement, and automated share certificate issuance all built-in.",
    imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Frictionless Investing",
    offer: "Complimentary Legal Verification",
    deepLink: "/investor/contracts",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Good morning! 2 New Founders matched your thesis 🎯☕",
    description: "Based on your focus on FinTech and B2B SaaS, algorithm matched 2 seed-stage startups for you.",
    imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Thesis Matching",
    offer: "Instant Founder Intro link",
    deepLink: "/investor/matched",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch briefing: Secondary shares opportunity available 🍱🔄",
    description: "Discounted secondary shares in a high-growth Series A logistics startup. Limited allocation.",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Secondary Deals",
    offer: "15% Discount to last round cap",
    deepLink: "/investor/secondaries",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Diversify your portfolio with fractional venture tickets 🧩💰",
    description: "Spread your capital across 5 high-potential startups instead of betting big on just one.",
    imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Portfolio Diversity",
    offer: "Syndicate Bundle Discount",
    deepLink: "/investor/syndicates",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Ex-Google founders building an enterprise workflow tool 🏢💻",
    description: "Already backed by prominent seed funds in the US. India allocation open for strategic angel advisors.",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Marquee Founders",
    offer: "Direct Advisory Equity terms",
    deepLink: "/investor/dealflow?founder=ex-faang",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Midday traction alert: Startup hit $50k MRR this month 🚀📈",
    description: "Growth rate at 22% MoM for 5 consecutive months. Check their verified revenue telemetry chart.",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "High Velocity",
    offer: "Live Telemetry Chart access",
    deepLink: "/investor/dealflow?id=rapid-saas",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Friday night unwind: Read our quarterly angel report 🍷📖",
    description: "How top angel networks achieved 3.4x MOIC on early Indian tech seed investments this year.",
    imageUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Angel Teardown",
    offer: "Free Angel Benchmarks PDF",
    deepLink: "/investor/reports",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Early stage HealthTech: AI diagnostics tool raising ₹1Cr 🩺🤖",
    description: "Clinical trials approved by top tier hospital network. High IP moat and strong regulatory readiness.",
    imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "HealthTech & Bio",
    offer: "Clinical Trial Validation Dossier",
    deepLink: "/investor/dealflow?sector=healthtech",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch deal: PropTech startup disrupting commercial rentals 🏢🏙️",
    description: "Positive EBITDA since Month 6. Founders seeking angel syndicate for multi-city expansion.",
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "PropTech",
    offer: "City Expansion Financial Model",
    deepLink: "/investor/dealflow?sector=proptech",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Your active investments generated ₹4.2L in distributions 💸✨",
    description: "Review quarterly profit distributions and tax deduction statements in your Investor Vault.",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Payouts & Yield",
    offer: "Instant Distribution Settlement",
    deepLink: "/investor/wallet",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Good morning! New EdTech startup with 120,000 students 🌅🎓",
    description: "Regional language learning platform with strong viral loops. Raising Pre-Series A round.",
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "EdTech",
    offer: "User Retention Cohort Chart",
    deepLink: "/investor/dealflow?sector=edtech",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Midday invite: Private Demo Day this Wednesday at 4 PM 🎟️💻",
    description: "6 Handpicked founders will pitch live for 5 mins each. RSVP to receive your private stream link.",
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Private Demo Day",
    offer: "VIP Demo Day Ticket + Recording",
    deepLink: "/investor/events",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Zero paperwork angel investing: Done in 2 taps ✍️📜",
    description: "All regulatory e-sign, KYC checks, and MCA filings handled automatically by Go Experts legal engine.",
    imageUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Compliance Engine",
    offer: "Zero Stamp Duty Processing Fee",
    deepLink: "/investor/compliance",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Coffee briefing: CyberSecurity SaaS with 8 US clients ☕🛡️",
    description: "Zero trust security tool built by certified white-hat security researchers. Seed round open.",
    imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "CyberSec SaaS",
    offer: "Customer Reference Call access",
    deepLink: "/investor/dealflow?sector=cybersec",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Lunch update: Agritech startup with ₹2Cr GMV 🌾🚜",
    description: "Connecting 25,000 farmers directly with food processing corporations. Strong Moat and margins.",
    imageUrl: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "AgriTech",
    offer: "Farmer Unit Economics Report",
    deepLink: "/investor/dealflow?sector=agritech",
    scheduleSlot: "SLOT_2"
  },
  {
    title: "Weekend wrap-up: New Syndicate Allocation Reserved for You 🌟💼",
    description: "Based on your angel profile, an exclusive ₹5L allocation is held for 48 hours in the FinFlow deal.",
    imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Reserved Allocation",
    offer: "48-Hour Priority Ticket Hold",
    deepLink: "/investor/reserved",
    scheduleSlot: "SLOT_3"
  },
  {
    title: "Build your angel legacy: Join the 10-Deal Portfolio Club 🏆💎",
    description: "Diversify across stages and sectors with curated monthly deal drops tailored to your thesis.",
    imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Angel Club",
    offer: "Angel Network Membership Badge",
    deepLink: "/investor/membership",
    scheduleSlot: "SLOT_1"
  },
  {
    title: "Good night: Tomorrow’s deal pipeline is looking incredible 🌙✨",
    description: "3 New seed rounds in SpaceTech, EV Mobility, and Generative AI go live at 09:30 AM IST.",
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
    targetRole: "INVESTOR",
    category: "Upcoming Deals",
    offer: "Early Access notification enabled",
    deepLink: "/investor/dealflow",
    scheduleSlot: "SLOT_3"
  }
];

export async function seedPushCampaigns() {
  console.log("Seeding Push Schedule Settings...");
  for (const s of DEFAULT_SCHEDULE_SETTINGS) {
    await prisma.pushScheduleSetting.upsert({
      where: { slotKey: s.slotKey },
      update: {
        label: s.label,
        time: s.time,
        isEnabled: s.isEnabled,
        targetRole: s.targetRole
      },
      create: s
    });
  }

  console.log(`Checking existing push campaigns...`);
  const existingCount = await prisma.pushCampaign.count({ where: { deletedAt: null } });

  if (existingCount < 120) {
    console.log(`Current campaigns: ${existingCount}. Seeding 120 unique Zomato-style industry campaigns...`);
    let added = 0;
    for (const c of CAMPAIGNS_120) {
      const existing = await prisma.pushCampaign.findFirst({
        where: { title: c.title, targetRole: c.targetRole }
      });
      if (!existing) {
        await prisma.pushCampaign.create({
          data: {
            ...c,
            status: "ACTIVE"
          }
        });
        added++;
      }
    }
    console.log(`Successfully seeded ${added} new campaigns. Total now >= 120.`);
  } else {
    console.log(`Already have ${existingCount} campaigns in database.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv.includes("--run")) {
  seedPushCampaigns()
    .then(() => {
      console.log("Seed completed successfully!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
