import { prisma } from '../../config/database.js';
import { getVerificationStats } from '../../common/helpers/verification.js';
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasNumber = (value) => typeof value === 'number' && !isNaN(value);
const hasArray = (value) => Array.isArray(value) && value.length > 0;
function getProfileLevel(percentage) {
    if (percentage === 100)
        return 'COMPLETE';
    if (percentage >= 90)
        return 'STRONG';
    if (percentage >= 80)
        return 'READY';
    if (percentage >= 65)
        return 'NEARLY_READY';
    if (percentage >= 50)
        return 'DEVELOPING';
    if (percentage >= 30)
        return 'BASIC';
    return 'INCOMPLETE';
}
function getStrengthLabel(level) {
    switch (level) {
        case 'COMPLETE': return 'Complete & Verified';
        case 'STRONG': return 'Strong';
        case 'READY': return 'Ready for Work';
        case 'NEARLY_READY': return 'Nearly Ready';
        case 'DEVELOPING': return 'Developing';
        case 'BASIC': return 'Basic';
        default: return 'Incomplete';
    }
}
// ===========================================================================
// 1. FREELANCER EVALUATION (7 Steps, 100 Points Total)
// ===========================================================================
function evaluateFreelancer(user, fp) {
    const fields = {
        fullName: hasText(user.fullName),
        avatar: hasText(user.avatarUrl) || hasText(user.avatar),
        coverImage: hasText(user.coverImageUrl) || hasText(user.coverUrl),
        country: hasText(user.country) || hasText(user.countryName) || hasText(fp?.country) || hasText(fp?.countryName),
        city: hasText(user.city) || hasText(fp?.city),
        title: hasText(fp?.titleHeadline) || hasText(fp?.title) || hasText(user.title),
        bio: hasText(user.bio) || hasText(fp?.bio) || hasText(fp?.headline),
        industry: hasText(fp?.industry) || hasText(user.industry),
        skills: hasText(fp?.skills) || (Array.isArray(fp?.skills) && fp.skills.length > 0),
        hourlyRate: hasNumber(fp?.hourlyRate) || hasNumber(fp?.monthlyRate) || hasText(fp?.hourlyRate) || hasText(fp?.monthlyRate),
        availability: hasText(fp?.availability),
        experience: hasText(fp?.experience) || hasText(fp?.experienceLevel) || hasArray(user.freelancerExperiences),
        education: hasText(fp?.education) || hasArray(user.freelancerEducations) || hasArray(user.freelancerCertificates),
        portfolio: hasText(fp?.portfolioUrl) || hasText(fp?.githubUrl) || hasText(fp?.dribbbleUrl) || hasText(fp?.linkedInUrl) || hasText(fp?.linkedinUrl) || hasText(fp?.websiteUrl) || hasText(user.portfolioUrl),
    };
    const steps = [
        {
            id: 'step_identity',
            key: 'identity',
            title: 'Profile Identity',
            description: 'Full name, professional avatar, and location',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/dashboard/profile?tab=personal',
            tab: 'personal',
            focusField: 'fullName',
        },
        {
            id: 'step_headline_bio',
            key: 'headline_bio',
            title: 'Professional Headline & Bio',
            description: 'Catchy professional title and detailed biography',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/dashboard/profile?tab=personal&field=headline',
            tab: 'personal',
            focusField: 'headline',
        },
        {
            id: 'step_skills',
            key: 'skills_expertise',
            title: 'Skills & Expertise',
            description: 'Primary industry classification and verified skill tags',
            points: 20,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/dashboard/profile?tab=industry',
            tab: 'industry',
            focusField: 'skills',
        },
        {
            id: 'step_availability_rates',
            key: 'availability_rates',
            title: 'Availability & Rates',
            description: 'Hourly billing rate and work availability schedule',
            points: 10,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/dashboard/profile?tab=rates',
            tab: 'rates',
            focusField: 'monthlyRate',
        },
        {
            id: 'step_experience',
            key: 'experience',
            title: 'Experience & History',
            description: 'Work history, past roles, and experience level',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/dashboard/profile?tab=experience',
            tab: 'experience',
            focusField: 'experience',
        },
        {
            id: 'step_education',
            key: 'education_credentials',
            title: 'Education & Credentials',
            description: 'Academic degrees or professional certifications',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: false,
            missingFields: [],
            editRoute: '/dashboard/profile?tab=education',
            tab: 'education',
            focusField: 'education',
        },
        {
            id: 'step_portfolio',
            key: 'portfolio_links',
            title: 'Portfolio & External Links',
            description: 'Work samples, GitHub, LinkedIn, or personal website',
            points: 10,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: false,
            missingFields: [],
            editRoute: '/dashboard/profile?tab=portfolio',
            tab: 'portfolio',
            focusField: 'portfolioUrl',
        },
    ];
    // 1. Identity
    const identityMissing = [];
    if (!fields.fullName)
        identityMissing.push({ key: 'fullName', label: 'Full Name' });
    if (!fields.avatar)
        identityMissing.push({ key: 'avatar', label: 'Profile Photo' });
    if (!fields.country || !fields.city)
        identityMissing.push({ key: 'location', label: 'Country & City' });
    steps[0].missingFields = identityMissing;
    if (identityMissing.length === 0) {
        steps[0].earnedPoints = steps[0].points;
        steps[0].status = 'COMPLETED';
    }
    else if (fields.fullName || fields.avatar) {
        steps[0].earnedPoints = Math.round(steps[0].points * 0.5);
        steps[0].status = 'IN_PROGRESS';
    }
    // 2. Headline & Bio
    const bioMissing = [];
    if (!fields.title)
        bioMissing.push({ key: 'title', label: 'Professional Title' });
    if (!fields.bio)
        bioMissing.push({ key: 'bio', label: 'Professional Bio' });
    steps[1].missingFields = bioMissing;
    if (bioMissing.length === 0) {
        steps[1].earnedPoints = steps[1].points;
        steps[1].status = 'COMPLETED';
    }
    else if (fields.title || fields.bio) {
        steps[1].earnedPoints = Math.round(steps[1].points * 0.5);
        steps[1].status = 'IN_PROGRESS';
    }
    // 3. Skills
    const skillsMissing = [];
    if (!fields.industry)
        skillsMissing.push({ key: 'industry', label: 'Industry Domain' });
    if (!fields.skills)
        skillsMissing.push({ key: 'skills', label: 'Skills List' });
    steps[2].missingFields = skillsMissing;
    if (skillsMissing.length === 0) {
        steps[2].earnedPoints = steps[2].points;
        steps[2].status = 'COMPLETED';
    }
    else if (fields.skills || fields.industry) {
        steps[2].earnedPoints = Math.round(steps[2].points * 0.5);
        steps[2].status = 'IN_PROGRESS';
    }
    // 4. Availability & Rates
    const rateMissing = [];
    if (!fields.hourlyRate)
        rateMissing.push({ key: 'hourlyRate', label: 'Hourly Rate' });
    if (!fields.availability)
        rateMissing.push({ key: 'availability', label: 'Availability' });
    steps[3].missingFields = rateMissing;
    if (rateMissing.length === 0) {
        steps[3].earnedPoints = steps[3].points;
        steps[3].status = 'COMPLETED';
    }
    else if (fields.hourlyRate || fields.availability) {
        steps[3].earnedPoints = Math.round(steps[3].points * 0.5);
        steps[3].status = 'IN_PROGRESS';
    }
    // 5. Experience
    const expMissing = [];
    if (!fields.experience)
        expMissing.push({ key: 'experience', label: 'Experience Level / History' });
    steps[4].missingFields = expMissing;
    if (expMissing.length === 0) {
        steps[4].earnedPoints = steps[4].points;
        steps[4].status = 'COMPLETED';
    }
    // 6. Education & Credentials
    const eduMissing = [];
    if (!fields.education)
        eduMissing.push({ key: 'education', label: 'Education / Certifications' });
    steps[5].missingFields = eduMissing;
    if (eduMissing.length === 0) {
        steps[5].earnedPoints = steps[5].points;
        steps[5].status = 'COMPLETED';
    }
    // 7. Portfolio & Links
    const portMissing = [];
    if (!fields.portfolio)
        portMissing.push({ key: 'portfolio', label: 'Portfolio Link or Work Samples' });
    steps[6].missingFields = portMissing;
    if (portMissing.length === 0) {
        steps[6].earnedPoints = steps[6].points;
        steps[6].status = 'COMPLETED';
    }
    const score = Math.min(100, steps.reduce((sum, s) => sum + s.earnedPoints, 0));
    // Legacy mappings
    const legacySections = {
        personal_info: fields.fullName && (fields.country || fields.city),
        professional_info: fields.bio && fields.title,
        skills: fields.skills,
        experience: fields.experience || fields.hourlyRate,
        portfolio: fields.portfolio,
        avatar: fields.avatar,
        location: fields.city || fields.country,
        resume: hasText(fp?.resumeUrl),
    };
    const missingCore = steps.filter(s => s.required && s.status !== 'COMPLETED').flatMap(s => s.missingFields.map(m => ({ ...m, sectionKey: s.key })));
    const missingRecommended = steps.filter(s => !s.required && s.status !== 'COMPLETED').flatMap(s => s.missingFields.map(m => ({ ...m, sectionKey: s.key })));
    const capabilities = {
        browseProjects: { allowed: true },
        submitProposal: { allowed: score >= 50, missing: missingCore },
        publishProject: { allowed: true, missing: [] }
    };
    return { steps, score, missingCore, missingRecommended, capabilities, legacySections };
}
// ===========================================================================
// 2. CLIENT / BUSINESS EVALUATION (6 Steps, 100 Points Total)
// ===========================================================================
function evaluateClient(user, cp, extraData = {}) {
    const fields = {
        fullName: hasText(user.fullName),
        email: hasText(user.email),
        phone: hasText(user.phone),
        company: hasText(cp?.company) || hasText(user.company) || hasText(user.fullName),
        industry: hasText(cp?.industry) || hasText(user.industry),
        companySize: hasText(cp?.companySize),
        country: hasText(user.country) || hasText(cp?.country) || hasText(user.countryName),
        city: hasText(user.city) || hasText(cp?.city),
        websiteUrl: hasText(cp?.websiteUrl) || hasText(user.websiteUrl),
        bio: hasText(user.bio) || hasText(cp?.bio),
        hiringGoal: hasText(cp?.hiringGoal),
        projectHireBudget: hasText(cp?.projectHireBudget) || hasNumber(cp?.projectHireBudget),
        avatar: hasText(user.avatarUrl) || hasText(user.avatar) || hasText(cp?.logo),
        coverImage: hasText(user.coverImageUrl) || hasText(user.coverUrl) || hasText(cp?.coverUrl),
        hasServices: Boolean(extraData?.servicesCount > 0) || (Array.isArray(cp?.services) && cp.services.length > 0),
        hasSocialLinks: Boolean(extraData?.socialLinksCount > 0) || hasText(cp?.websiteUrl) || hasText(user.websiteUrl),
        hasFaqs: Boolean(extraData?.faqsCount > 0) || (Array.isArray(cp?.faqs) && cp.faqs.length > 0),
    };
    const steps = [
        {
            id: 'step_company_identity',
            key: 'company_identity',
            title: 'Company Identity & Branding',
            description: 'Company name, logo, and brand presence',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/business/profile?tab=company',
            tab: 'company',
            focusField: 'company',
        },
        {
            id: 'step_industry_scale',
            key: 'industry_scale',
            title: 'Industry & Business Scale',
            description: 'Industry sector and organization size',
            points: 10,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/business/profile?tab=company&field=industry',
            tab: 'company',
            focusField: 'industry',
        },
        {
            id: 'step_services_offerings',
            key: 'services_offerings',
            title: 'Company Services & Offerings',
            description: 'Add your specialized services and client solutions',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/business/profile?tab=services',
            tab: 'services',
            focusField: 'services',
        },
        {
            id: 'step_social_channels',
            key: 'social_channels',
            title: 'Social & Professional Profiles',
            description: 'Connect LinkedIn, corporate website, or social profiles',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/business/profile?tab=social',
            tab: 'social',
            focusField: 'websiteUrl',
        },
        {
            id: 'step_profile_faqs',
            key: 'profile_faqs',
            title: 'Profile FAQs',
            description: 'Add frequently asked questions for clients & partners',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/business/profile?tab=faqs',
            tab: 'faqs',
            focusField: 'faqs',
        },
        {
            id: 'step_hiring_scope',
            key: 'hiring_scope',
            title: 'Hiring Scope & Budget',
            description: 'Primary talent needs and expected project budget',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/business/profile?tab=hiring&field=hiringGoal',
            tab: 'hiring',
            focusField: 'hiringGoal',
        },
        {
            id: 'step_location_contact',
            key: 'location_contact',
            title: 'Location & Verified Contact',
            description: 'Operating city, country, and contact phone number',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/business/profile?tab=location&field=city',
            tab: 'location',
            focusField: 'city',
        },
    ];
    // 1. Company Identity
    const compMissing = [];
    if (!fields.company)
        compMissing.push({ key: 'company', label: 'Company Name' });
    steps[0].missingFields = compMissing;
    if (compMissing.length === 0) {
        steps[0].earnedPoints = 15;
        steps[0].status = 'COMPLETED';
    }
    else if (fields.company) {
        steps[0].earnedPoints = 8;
        steps[0].status = 'IN_PROGRESS';
    }
    // 2. Industry & Scale
    const indMissing = [];
    if (!fields.industry)
        indMissing.push({ key: 'industry', label: 'Industry Domain' });
    if (!fields.companySize)
        indMissing.push({ key: 'companySize', label: 'Company Size' });
    steps[1].missingFields = indMissing;
    if (indMissing.length === 0) {
        steps[1].earnedPoints = 10;
        steps[1].status = 'COMPLETED';
    }
    else if (fields.industry || fields.companySize) {
        steps[1].earnedPoints = 5;
        steps[1].status = 'IN_PROGRESS';
    }
    // 3. Services & Offerings
    const svcMissing = [];
    if (!fields.hasServices)
        svcMissing.push({ key: 'services', label: 'At least 1 Service or Solution' });
    steps[2].missingFields = svcMissing;
    if (svcMissing.length === 0) {
        steps[2].earnedPoints = 15;
        steps[2].status = 'COMPLETED';
    }
    // 4. Social Links
    const socMissing = [];
    if (!fields.hasSocialLinks)
        socMissing.push({ key: 'socialLinks', label: 'Website or Social Profile Link' });
    steps[3].missingFields = socMissing;
    if (socMissing.length === 0) {
        steps[3].earnedPoints = 15;
        steps[3].status = 'COMPLETED';
    }
    // 5. Profile FAQs
    const faqMissing = [];
    if (!fields.hasFaqs)
        faqMissing.push({ key: 'faqs', label: 'At least 1 Profile FAQ' });
    steps[4].missingFields = faqMissing;
    if (faqMissing.length === 0) {
        steps[4].earnedPoints = 15;
        steps[4].status = 'COMPLETED';
    }
    // 6. Hiring Scope & Budget
    const hireMissing = [];
    if (!fields.hiringGoal)
        hireMissing.push({ key: 'hiringGoal', label: 'Hiring Goals' });
    if (!fields.projectHireBudget)
        hireMissing.push({ key: 'projectHireBudget', label: 'Project Budget' });
    steps[5].missingFields = hireMissing;
    if (hireMissing.length === 0) {
        steps[5].earnedPoints = 15;
        steps[5].status = 'COMPLETED';
    }
    else if (fields.hiringGoal || fields.projectHireBudget) {
        steps[5].earnedPoints = 8;
        steps[5].status = 'IN_PROGRESS';
    }
    // 7. Location & Contact
    const locMissing = [];
    if (!fields.country || !fields.city)
        locMissing.push({ key: 'location', label: 'Operating City & Country' });
    if (!fields.phone)
        locMissing.push({ key: 'phone', label: 'Contact Phone Number' });
    steps[6].missingFields = locMissing;
    if (locMissing.length === 0) {
        steps[6].earnedPoints = 15;
        steps[6].status = 'COMPLETED';
    }
    else if (fields.country || fields.phone) {
        steps[6].earnedPoints = 8;
        steps[6].status = 'IN_PROGRESS';
    }
    const score = Math.min(100, steps.reduce((sum, s) => sum + s.earnedPoints, 0));
    const legacySections = {
        personal_info: fields.fullName && fields.email,
        company_info: fields.company || fields.industry,
        project_details: fields.hiringGoal || fields.projectHireBudget,
        avatar: fields.avatar,
        location: fields.city || fields.country,
    };
    const missingCore = steps.filter(s => s.required && s.status !== 'COMPLETED').flatMap(s => s.missingFields.map(m => ({ ...m, sectionKey: s.key })));
    const missingRecommended = steps.filter(s => !s.required && s.status !== 'COMPLETED').flatMap(s => s.missingFields.map(m => ({ ...m, sectionKey: s.key })));
    const capabilities = {
        browseFreelancers: { allowed: true },
        publishProject: { allowed: score >= 40, missing: missingCore },
    };
    return { steps, score, missingCore, missingRecommended, capabilities, legacySections };
}
// ===========================================================================
// 3. STARTUP FOUNDER EVALUATION (7 Steps, 100 Points Total)
// ===========================================================================
function evaluateFounder(user, fp) {
    const fields = {
        fullName: hasText(user.fullName),
        avatar: hasText(user.avatarUrl) || hasText(user.avatar),
        founderRole: hasText(fp?.founderRole) || hasText(fp?.founderTypeId) || hasText(user.title) || true,
        founderBio: hasText(fp?.founderBio) || hasText(user.bio),
        startupName: hasText(fp?.startupName) || hasText(user.fullName),
        industry: hasText(fp?.industry) || hasText(user.industry),
        stage: hasText(fp?.stage),
        pitch: hasText(fp?.pitch),
        primaryGoal: hasText(fp?.primaryGoal) || hasText(fp?.targetRaise) || hasNumber(fp?.amountRaising) || true,
        targetRaise: hasNumber(fp?.targetRaise) || hasText(fp?.targetRaise) || hasNumber(fp?.amountRaising),
        country: hasText(user.country) || hasText(fp?.countryId) || hasText(fp?.country) || hasText(user.countryName),
        city: hasText(user.city) || hasText(fp?.city),
        coverImage: hasText(user.coverImageUrl) || hasText(user.coverUrl) || hasText(fp?.coverUrl),
        teamSize: (hasNumber(fp?.teamSize) && fp.teamSize > 0) || true,
    };
    const steps = [
        {
            id: 'step_founder_identity',
            key: 'founder_identity',
            title: 'Founder Identity',
            description: 'Founder full name, portrait photo, and leadership title',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/founder/profile?tab=personal',
            tab: 'personal',
            focusField: 'fullName',
        },
        {
            id: 'step_startup_identity',
            key: 'startup_identity',
            title: 'Startup Identity & Stage',
            description: 'Startup venture name, industry category, and maturity stage',
            points: 20,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/founder/profile?tab=startup',
            tab: 'startup',
            focusField: 'startupName',
        },
        {
            id: 'step_elevator_pitch',
            key: 'elevator_pitch',
            title: 'Elevator Pitch & Venture Vision',
            description: 'One-line elevator pitch and core venture mission',
            points: 20,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/founder/profile?tab=pitch',
            tab: 'pitch',
            focusField: 'pitch',
        },
        {
            id: 'step_founder_bio',
            key: 'founder_bio',
            title: 'Founder Bio & Leadership Expertise',
            description: 'Personal entrepreneurial background and domain expertise',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/founder/profile?tab=personal',
            tab: 'personal',
            focusField: 'bio',
        },
        {
            id: 'step_hq_location',
            key: 'hq_location',
            title: 'Headquarters & Location',
            description: 'Startup operating country and headquarters city',
            points: 10,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/founder/profile?tab=location',
            tab: 'location',
            focusField: 'country',
        },
        {
            id: 'step_funding_capital',
            key: 'funding_capital',
            title: 'Funding & Capital Raise',
            description: 'Target raise amount and equity terms',
            points: 10,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: false,
            missingFields: [],
            editRoute: '/founder/profile?tab=funding',
            tab: 'funding',
            focusField: 'targetRaise',
        },
        {
            id: 'step_venture_snapshot',
            key: 'venture_snapshot',
            title: 'Venture Snapshot & Branding',
            description: 'Startup cover banner, team size, and brand assets',
            points: 10,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: false,
            missingFields: [],
            editRoute: '/founder/profile?tab=startup',
            tab: 'startup',
            focusField: 'coverImage',
        },
    ];
    // 1. Founder Identity
    const idMissing = [];
    if (!fields.fullName)
        idMissing.push({ key: 'fullName', label: 'Founder Full Name' });
    if (!fields.avatar)
        idMissing.push({ key: 'avatar', label: 'Founder Photo' });
    if (!fields.founderRole)
        idMissing.push({ key: 'founderRole', label: 'Founder Role' });
    steps[0].missingFields = idMissing;
    if (idMissing.length === 0) {
        steps[0].earnedPoints = steps[0].points;
        steps[0].status = 'COMPLETED';
    }
    else if (fields.fullName || fields.avatar) {
        steps[0].earnedPoints = Math.round(steps[0].points * 0.5);
        steps[0].status = 'IN_PROGRESS';
    }
    // 2. Startup Identity
    const startMissing = [];
    if (!fields.startupName)
        startMissing.push({ key: 'startupName', label: 'Startup Name' });
    if (!fields.industry)
        startMissing.push({ key: 'industry', label: 'Industry Domain' });
    if (!fields.stage)
        startMissing.push({ key: 'stage', label: 'Venture Stage' });
    steps[1].missingFields = startMissing;
    if (startMissing.length === 0) {
        steps[1].earnedPoints = steps[1].points;
        steps[1].status = 'COMPLETED';
    }
    else if (fields.startupName) {
        steps[1].earnedPoints = Math.round(steps[1].points * 0.5);
        steps[1].status = 'IN_PROGRESS';
    }
    // 3. Elevator Pitch
    const pitchMissing = [];
    if (!fields.pitch)
        pitchMissing.push({ key: 'pitch', label: 'Elevator Pitch' });
    if (!fields.primaryGoal)
        pitchMissing.push({ key: 'primaryGoal', label: 'Primary Goal' });
    steps[2].missingFields = pitchMissing;
    if (pitchMissing.length === 0) {
        steps[2].earnedPoints = steps[2].points;
        steps[2].status = 'COMPLETED';
    }
    else if (fields.pitch) {
        steps[2].earnedPoints = Math.round(steps[2].points * 0.5);
        steps[2].status = 'IN_PROGRESS';
    }
    // 4. Founder Bio
    const bioMissing = [];
    if (!fields.founderBio)
        bioMissing.push({ key: 'founderBio', label: 'Founder Background & Bio' });
    steps[3].missingFields = bioMissing;
    if (bioMissing.length === 0) {
        steps[3].earnedPoints = steps[3].points;
        steps[3].status = 'COMPLETED';
    }
    // 5. Location
    const locMissing = [];
    if (!fields.country || !fields.city)
        locMissing.push({ key: 'location', label: 'Country & City' });
    steps[4].missingFields = locMissing;
    if (locMissing.length === 0) {
        steps[4].earnedPoints = steps[4].points;
        steps[4].status = 'COMPLETED';
    }
    // 6. Funding
    if (fields.targetRaise) {
        steps[5].earnedPoints = steps[5].points;
        steps[5].status = 'COMPLETED';
    }
    else {
        steps[5].missingFields = [{ key: 'targetRaise', label: 'Target Raise Amount' }];
    }
    // 7. Venture Snapshot
    if (fields.coverImage || fields.teamSize) {
        steps[6].earnedPoints = steps[6].points;
        steps[6].status = 'COMPLETED';
    }
    else {
        steps[6].missingFields = [{ key: 'coverImage', label: 'Venture Cover Image / Team Size' }];
    }
    const score = Math.min(100, steps.reduce((sum, s) => sum + s.earnedPoints, 0));
    const legacySections = {
        personal_info: fields.fullName && (fields.avatar || fields.founderRole),
        startup_info: fields.startupName || fields.industry,
        pitch: fields.pitch,
        funding_info: fields.stage || fields.targetRaise,
        avatar: fields.avatar,
        location: fields.city || fields.country,
    };
    const missingCore = steps.filter(s => s.required && s.status !== 'COMPLETED').flatMap(s => s.missingFields.map(m => ({ ...m, sectionKey: s.key })));
    const missingRecommended = steps.filter(s => !s.required && s.status !== 'COMPLETED').flatMap(s => s.missingFields.map(m => ({ ...m, sectionKey: s.key })));
    const capabilities = {
        browseInvestors: { allowed: true },
        contactInvestor: { allowed: score >= 50, missing: missingCore },
        publishProject: { allowed: true, missing: [] },
    };
    return { steps, score, missingCore, missingRecommended, capabilities, legacySections };
}
// ===========================================================================
// 4. INVESTOR EVALUATION (6 Steps, 100 Points Total)
// ===========================================================================
function evaluateInvestor(user, ip) {
    const isIndividual = ip?.investorType === 'Angel Investor' || ip?.investorType === 'Individual';
    const fields = {
        fullName: hasText(user.fullName),
        avatar: hasText(user.avatarUrl) || hasText(user.avatar),
        investorType: hasText(ip?.investorType) || true,
        firm: hasText(ip?.firm) || isIndividual || hasText(user.fullName),
        website: hasText(ip?.websiteUrl) || hasText(user.websiteUrl),
        linkedin: hasText(ip?.linkedInUrl) || hasText(ip?.linkedinUrl) || hasText(user.linkedinUrl),
        bio: hasText(user.bio) || hasText(ip?.bio) || hasText(ip?.pitch),
        focusAreas: hasText(ip?.focusAreas) || (Array.isArray(ip?.focusAreas) && ip.focusAreas.length > 0),
        preferredStage: hasText(ip?.preferredStage) || (Array.isArray(ip?.preferredStage) && ip.preferredStage.length > 0),
        ticketMin: hasNumber(ip?.ticketMin) || hasText(ip?.ticketMin),
        country: hasText(user.country) || hasText(ip?.country) || hasText(user.countryName),
        city: hasText(user.city) || hasText(ip?.city),
        isAccredited: ip?.isAccredited === true || hasText(ip?.isAccredited),
    };
    const steps = [
        {
            id: 'step_investor_identity',
            key: 'investor_identity',
            title: 'Investor Identity',
            description: 'Investor full name, professional photo, and investor classification',
            points: 20,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/investor/profile?tab=personal',
            tab: 'personal',
            focusField: 'fullName',
        },
        {
            id: 'step_firm_presence',
            key: 'firm_presence',
            title: 'Firm & Public Presence',
            description: 'Venture fund or angel group affiliation, website, and LinkedIn',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: !isIndividual,
            missingFields: [],
            editRoute: '/investor/profile?tab=firm',
            tab: 'firm',
            focusField: 'firm',
        },
        {
            id: 'step_investment_thesis',
            key: 'investment_thesis',
            title: 'Investment Thesis & Background',
            description: 'Professional investment philosophy, track record, and bio',
            points: 20,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/investor/profile?tab=personal',
            tab: 'personal',
            focusField: 'bio',
        },
        {
            id: 'step_sector_stages',
            key: 'sector_stages',
            title: 'Sector Focus & Preferred Stages',
            description: 'Target industries (FinTech, AI, SaaS) and venture stage preferences',
            points: 20,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/investor/profile?tab=investment',
            tab: 'investment',
            focusField: 'focusAreas',
        },
        {
            id: 'step_ticket_size',
            key: 'ticket_size',
            title: 'Investment Ticket Range',
            description: 'Minimum and maximum check size per deal opportunity',
            points: 15,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: true,
            missingFields: [],
            editRoute: '/investor/profile?tab=investment',
            tab: 'investment',
            focusField: 'ticketMin',
        },
        {
            id: 'step_location_accreditation',
            key: 'location_accreditation',
            title: 'Location & Accreditation',
            description: 'Primary deployment location and regulatory status declaration',
            points: 10,
            earnedPoints: 0,
            status: 'INCOMPLETE',
            required: false,
            missingFields: [],
            editRoute: '/investor/profile?tab=investment',
            tab: 'investment',
            focusField: 'isAccredited',
        },
    ];
    // 1. Investor Identity
    const idMissing = [];
    if (!fields.fullName)
        idMissing.push({ key: 'fullName', label: 'Full Name' });
    if (!fields.avatar)
        idMissing.push({ key: 'avatar', label: 'Profile Photo' });
    if (!fields.investorType)
        idMissing.push({ key: 'investorType', label: 'Investor Type' });
    steps[0].missingFields = idMissing;
    if (idMissing.length === 0) {
        steps[0].earnedPoints = steps[0].points;
        steps[0].status = 'COMPLETED';
    }
    else if (fields.fullName || fields.investorType) {
        steps[0].earnedPoints = Math.round(steps[0].points * 0.5);
        steps[0].status = 'IN_PROGRESS';
    }
    // 2. Firm & Presence
    const firmMissing = [];
    if (!isIndividual && !fields.firm)
        firmMissing.push({ key: 'firm', label: 'Firm / Fund Name' });
    if (!fields.linkedin && !fields.website)
        firmMissing.push({ key: 'linkedin', label: 'LinkedIn or Website' });
    steps[1].missingFields = firmMissing;
    if (firmMissing.length === 0) {
        steps[1].earnedPoints = steps[1].points;
        steps[1].status = 'COMPLETED';
    }
    else if (fields.firm || fields.linkedin || isIndividual) {
        steps[1].earnedPoints = Math.round(steps[1].points * 0.5);
        steps[1].status = 'IN_PROGRESS';
    }
    // 3. Thesis & Bio
    const thesisMissing = [];
    if (!fields.bio)
        thesisMissing.push({ key: 'bio', label: 'Investment Thesis & Bio' });
    steps[2].missingFields = thesisMissing;
    if (thesisMissing.length === 0) {
        steps[2].earnedPoints = steps[2].points;
        steps[2].status = 'COMPLETED';
    }
    // 4. Sector & Stages
    const secMissing = [];
    if (!fields.focusAreas)
        secMissing.push({ key: 'focusAreas', label: 'Sector Focus Areas' });
    if (!fields.preferredStage)
        secMissing.push({ key: 'preferredStage', label: 'Preferred Stages' });
    steps[3].missingFields = secMissing;
    if (secMissing.length === 0) {
        steps[3].earnedPoints = steps[3].points;
        steps[3].status = 'COMPLETED';
    }
    else if (fields.focusAreas || fields.preferredStage) {
        steps[3].earnedPoints = Math.round(steps[3].points * 0.5);
        steps[3].status = 'IN_PROGRESS';
    }
    // 5. Ticket Size Range
    const ticketMissing = [];
    if (!fields.ticketMin)
        ticketMissing.push({ key: 'ticketMin', label: 'Minimum Ticket Size' });
    steps[4].missingFields = ticketMissing;
    if (ticketMissing.length === 0) {
        steps[4].earnedPoints = steps[4].points;
        steps[4].status = 'COMPLETED';
    }
    // 6. Location & Accreditation
    if ((fields.country || fields.city) && fields.isAccredited) {
        steps[5].earnedPoints = steps[5].points;
        steps[5].status = 'COMPLETED';
    }
    else if (fields.country || fields.isAccredited) {
        steps[5].earnedPoints = Math.round(steps[5].points * 0.5);
        steps[5].status = 'IN_PROGRESS';
        steps[5].missingFields = [{ key: 'location', label: 'Location & Accreditation' }];
    }
    else {
        steps[5].missingFields = [{ key: 'location', label: 'Location & Accreditation' }];
    }
    const score = Math.min(100, steps.reduce((sum, s) => sum + s.earnedPoints, 0));
    const legacySections = {
        personal_info: fields.fullName && fields.investorType,
        firm_info: fields.firm || isIndividual,
        focus_areas: fields.focusAreas,
        ticket_size: fields.ticketMin,
        avatar: fields.avatar,
        location: fields.city || fields.country,
    };
    const missingCore = steps.filter(s => s.required && s.status !== 'COMPLETED').flatMap(s => s.missingFields.map(m => ({ ...m, sectionKey: s.key })));
    const missingRecommended = steps.filter(s => !s.required && s.status !== 'COMPLETED').flatMap(s => s.missingFields.map(m => ({ ...m, sectionKey: s.key })));
    const capabilities = {
        browseStartups: { allowed: true },
        expressInterest: { allowed: score >= 50, missing: missingCore },
        publishProject: { allowed: true, missing: [] },
    };
    return { steps, score, missingCore, missingRecommended, capabilities, legacySections };
}
// ===========================================================================
// MAIN UNIFIED RESOLVER
// ===========================================================================
export const resolveProfileCompletion = async (userId, requestedRole) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            freelancerProfile: true,
            clientProfile: true,
            investorProfile: true,
            founderProfile: true,
            freelancerExperiences: true,
            freelancerEducations: true,
            freelancerCertificates: true,
        },
    });
    const fallback = {
        role: requestedRole || 'freelancer',
        completionPercentage: 0,
        profileCompletion: 0,
        profileLevel: 'INCOMPLETE',
        profileStrengthLabel: 'Incomplete',
        isComplete: false,
        isFinalized: false,
        operationalReady: false,
        completedStepsCount: 0,
        totalStepsCount: 0,
        nextStep: null,
        steps: [],
        missingFields: [],
        lastCalculatedAt: new Date().toISOString(),
        requirements: { core: { complete: false, missing: [] }, recommended: { missing: [] } },
        verification: { email: 'PENDING', phone: 'PENDING', identity: 'PENDING' },
        capabilities: {},
        isProfileComplete: false,
        completedSteps: [],
        pendingSteps: [],
        totalSteps: 0,
        completedCount: 0,
    };
    if (!user)
        return fallback;
    // Resolve counts for services, social links, and faqs
    const [servicesCount, socialLinksCount, faqsCount] = await Promise.all([
        prisma.freelancerService.count({ where: { userId } }).catch(() => 0),
        prisma.socialLink.count({ where: { userId } }).catch(() => 0),
        (async () => {
            try {
                const rows = await prisma.$queryRawUnsafe("SELECT count(*) as cnt FROM `user_profile_faqs` WHERE `user_id` = ?", userId);
                if (rows && rows[0]?.cnt)
                    return Number(rows[0].cnt);
            }
            catch { }
            const settingRow = await prisma.setting.findUnique({
                where: { key: `user_faqs:${userId}` },
            }).catch(() => null);
            if (settingRow?.value) {
                try {
                    const parsed = JSON.parse(settingRow.value);
                    if (Array.isArray(parsed))
                        return parsed.length;
                }
                catch { }
            }
            return 0;
        })().catch(() => 0),
    ]);
    const extraCounts = { servicesCount, socialLinksCount, faqsCount };
    const activeRole = (requestedRole || user.role || 'freelancer').toLowerCase();
    let evaluation;
    switch (activeRole) {
        case 'freelancer':
            evaluation = evaluateFreelancer(user, user.freelancerProfile);
            break;
        case 'client':
        case 'business':
            evaluation = evaluateClient(user, user.clientProfile, extraCounts);
            break;
        case 'investor':
            evaluation = evaluateInvestor(user, user.investorProfile);
            break;
        case 'founder':
            evaluation = evaluateFounder(user, user.founderProfile);
            break;
        default:
            evaluation = evaluateFreelancer(user, user.freelancerProfile);
    }
    const score = evaluation.score;
    const profileLevel = getProfileLevel(score);
    const profileStrengthLabel = getStrengthLabel(profileLevel);
    const isComplete = score === 100;
    // Persisted finalization check:
    // Finalized only if 100% complete AND user has saved finalized state in DB
    const rawCompletedSteps = user.completedSteps || '';
    const isFinalized = isComplete && (user.onboardingStatus === 'COMPLETED' ||
        rawCompletedSteps.includes('"finalized":true') ||
        user.completionPercentage === 100);
    const steps = evaluation.steps || [];
    const completedStepsCount = steps.filter(s => s.status === 'COMPLETED').length;
    const totalStepsCount = steps.length;
    const nextStep = steps.find(s => s.status !== 'COMPLETED') || null;
    const allMissingFields = steps.flatMap(s => s.missingFields.map(m => ({
        key: m.key,
        label: m.label,
        stepTitle: s.title,
        route: s.editRoute,
    })));
    const kycStats = getVerificationStats(user);
    const kycSubmitted = kycStats.missingCount === 0;
    const kycVerified = kycStats.requiredTotal > 0 && kycStats.requiredVerified >= kycStats.requiredTotal;
    const kycStatus = kycVerified ? 'VERIFIED' : kycSubmitted ? 'SUBMITTED' : 'PENDING';
    const allLegacyKeys = Object.keys(evaluation.legacySections || {});
    const legacyCompleted = allLegacyKeys.filter(k => evaluation.legacySections[k]);
    const legacyPending = allLegacyKeys.filter(k => !evaluation.legacySections[k]);
    return {
        role: activeRole,
        completionPercentage: score,
        profileCompletion: score,
        profileLevel,
        profileStrengthLabel,
        isComplete,
        isFinalized,
        operationalReady: score >= 80 && evaluation.missingCore.length === 0,
        completedStepsCount,
        totalStepsCount,
        nextStep,
        steps,
        missingFields: allMissingFields,
        lastCalculatedAt: new Date().toISOString(),
        requirements: {
            core: {
                complete: evaluation.missingCore.length === 0,
                missing: evaluation.missingCore,
            },
            recommended: {
                missing: evaluation.missingRecommended,
            },
        },
        verification: {
            email: user.isVerified ? 'VERIFIED' : 'PENDING',
            phone: user.phone ? 'VERIFIED' : 'PENDING',
            identity: kycStatus,
            kycStatus,
            kycSubmitted,
            kycVerified,
            missingCount: kycStats.missingCount,
            requiredVerified: kycStats.requiredVerified,
            requiredTotal: kycStats.requiredTotal,
        },
        capabilities: evaluation.capabilities,
        isProfileComplete: score >= 70,
        completedSteps: legacyCompleted,
        pendingSteps: legacyPending,
        totalSteps: allLegacyKeys.length,
        completedCount: legacyCompleted.length,
    };
};
/**
 * Server-authoritative profile completion finalization.
 * Only succeeds if the actual persisted profile data reaches exactly 100%.
 */
export const finalizeProfileCompletionStatus = async (userId, role) => {
    const completion = await resolveProfileCompletion(userId, role);
    if (completion.completionPercentage < 100) {
        return {
            success: false,
            isFinalized: false,
            completionPercentage: completion.completionPercentage,
            message: `Cannot finalize profile. Current profile completion is ${completion.completionPercentage}%. Please complete all required fields.`,
            missingFields: completion.missingFields,
            data: completion,
        };
    }
    // Update user with finalized state in database
    await prisma.user.update({
        where: { id: userId },
        data: {
            completionPercentage: 100,
            onboardingStatus: 'COMPLETED',
            completedSteps: JSON.stringify({
                finalized: true,
                finalizedAt: new Date().toISOString(),
                role: completion.role,
            }),
        },
    });
    const updatedCompletion = {
        ...completion,
        isFinalized: true,
        isComplete: true,
    };
    // Trigger Direct Referral Qualification Engine (₹25 One-Time + 5% Recurring)
    import('../referral/direct-referral.service.js')
        .then(({ checkAndQualifyReferral }) => checkAndQualifyReferral(userId))
        .catch((err) => console.error('[Referral Qualification Trigger Error]:', err));
    return {
        success: true,
        isFinalized: true,
        completionPercentage: 100,
        message: 'Profile completion successfully finalized! Your profile is 100% complete and active.',
        data: updatedCompletion,
    };
};
