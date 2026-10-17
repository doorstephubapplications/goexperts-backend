import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../config/database.js';
import { resolveProfileCompletion, finalizeProfileCompletionStatus, } from '../../services/mobile/profile-completion.service.js';
describe('Unified Profile Completion Engine', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    describe('Freelancer Evaluation (100 Points Total)', () => {
        it('accurately scores partial and full freelancer profile', async () => {
            const mockUser = {
                id: 'user-free-1',
                role: 'freelancer',
                avatarUrl: 'https://example.com/avatar.jpg',
                fullName: 'Jane Doe',
                email: 'jane@example.com',
                phone: '+1234567890',
                country: 'USA',
                city: 'New York',
                onboardingStatus: 'NOT_STARTED',
                completedSteps: null,
                freelancerProfile: {
                    title: 'Senior Full Stack Engineer',
                    bio: 'Passionate software architect with 8+ years experience in scalable systems.',
                    industry: 'Software Engineering',
                    skills: JSON.stringify(['React', 'Node.js', 'TypeScript', 'GraphQL']),
                    hourlyRate: 75,
                    availability: 'Available for work',
                    workingHours: 'Full-time',
                    githubUrl: 'https://github.com/janedoe',
                    linkedinUrl: 'https://linkedin.com/in/janedoe',
                },
                freelancerExperiences: [
                    { company: 'Tech Corp', role: 'Lead Developer', duration: '3 years' },
                ],
                freelancerEducations: [
                    { school: 'State University', degree: 'B.S. Computer Science', year: 2018 },
                ],
                freelancerCertificates: [],
            };
            vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
            const result = await resolveProfileCompletion('user-free-1', 'freelancer');
            expect(result.completionPercentage).toBe(100);
            expect(result.isComplete).toBe(true);
            expect(result.steps.length).toBe(7);
            expect(result.missingFields.length).toBe(0);
            // Verify exact weights: 15+15+20+10+15+15+10 = 100
            const totalPoints = result.steps.reduce((sum, s) => sum + s.points, 0);
            expect(totalPoints).toBe(100);
        });
        it('identifies missing required fields on incomplete profile', async () => {
            const mockIncompleteUser = {
                id: 'user-free-2',
                role: 'freelancer',
                avatarUrl: null,
                fullName: 'John Basic',
                email: 'john@example.com',
                phone: null,
                country: null,
                city: null,
                freelancerProfile: {
                    title: null,
                    bio: null,
                    skills: null,
                },
                freelancerExperiences: [],
                freelancerEducations: [],
                freelancerCertificates: [],
            };
            vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockIncompleteUser);
            const result = await resolveProfileCompletion('user-free-2', 'freelancer');
            expect(result.completionPercentage).toBeLessThan(100);
            expect(result.isComplete).toBe(false);
            expect(result.missingFields.length).toBeGreaterThan(0);
            expect(result.nextStep).not.toBeNull();
        });
    });
    describe('Client / Business Evaluation (100 Points Total)', () => {
        it('evaluates business profile across 6 lifecycle steps (100 pts)', async () => {
            const mockClientUser = {
                id: 'user-client-1',
                role: 'client',
                avatarUrl: 'https://example.com/logo.jpg',
                coverImageUrl: 'https://example.com/cover.jpg',
                fullName: 'Acme Corp',
                email: 'contact@acme.com',
                phone: '+1987654321',
                country: 'USA',
                city: 'San Francisco',
                bio: 'Building the next generation of cloud developer platforms and APIs.',
                clientProfile: {
                    company: 'Acme Corporation Inc',
                    industry: 'Enterprise Software',
                    companySize: '51-200',
                    city: 'San Francisco',
                    country: 'USA',
                    websiteUrl: 'https://acme.com',
                    bio: 'Building the next generation of cloud developer platforms and APIs.',
                    hiringGoal: 'Looking for contract engineers',
                    projectHireBudget: '$5,000 - $10,000',
                },
            };
            vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockClientUser);
            const result = await resolveProfileCompletion('user-client-1', 'client');
            // 20 + 20 + 15 + 20 + 15 + 10 = 100
            const totalPoints = result.steps.reduce((sum, s) => sum + s.points, 0);
            expect(totalPoints).toBe(100);
            expect(result.steps.length).toBe(6);
            expect(result.completionPercentage).toBe(100);
        });
    });
    describe('Founder Evaluation (100 Points Total)', () => {
        it('evaluates startup founder across 7 lifecycle steps (100 pts)', async () => {
            const mockFounderUser = {
                id: 'user-founder-1',
                role: 'founder',
                avatarUrl: 'https://example.com/founder.jpg',
                coverImageUrl: 'https://example.com/cover.jpg',
                fullName: 'Alex Founder',
                country: 'USA',
                city: 'Austin',
                bio: 'Serial entrepreneur previously founded FinTech AI.',
                founderProfile: {
                    startupName: 'NextGen Autonomous AI',
                    industry: 'Artificial Intelligence',
                    stage: 'Seed',
                    pitch: 'Revolutionary agentic coding infrastructure for high-scale enterprise engineering.',
                    city: 'Austin',
                    countryId: 'USA',
                    founderRole: 'Chief Executive Officer',
                    founderBio: 'Serial entrepreneur previously founded FinTech AI.',
                    primaryGoal: 'Raising Seed round',
                    targetRaise: 2000000,
                    amountRaising: 2000000,
                    startupLogo: 'https://example.com/logo.png',
                },
            };
            vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFounderUser);
            const result = await resolveProfileCompletion('user-founder-1', 'founder');
            // 15 + 20 + 20 + 15 + 10 + 10 + 10 = 100
            const totalPoints = result.steps.reduce((sum, s) => sum + s.points, 0);
            expect(totalPoints).toBe(100);
            expect(result.steps.length).toBe(7);
            expect(result.completionPercentage).toBe(100);
        });
    });
    describe('Investor Evaluation (100 Points Total)', () => {
        it('evaluates investor across 6 lifecycle steps (100 pts)', async () => {
            const mockInvestorUser = {
                id: 'user-inv-1',
                role: 'investor',
                avatarUrl: 'https://example.com/investor.jpg',
                fullName: 'Sarah Ventures',
                country: 'USA',
                city: 'New York',
                bio: 'Angel investor and GP focusing on B2B SaaS and developer tooling.',
                investorProfile: {
                    firm: 'Horizon Capital',
                    investorType: 'Venture Capital',
                    websiteUrl: 'https://horizon.vc',
                    linkedinUrl: 'https://linkedin.com/in/sarahvc',
                    focusAreas: JSON.stringify(['AI/ML', 'Developer Tools', 'Fintech']),
                    preferredStage: JSON.stringify(['Pre-Seed', 'Seed', 'Series A']),
                    ticketMin: 100000,
                    ticketMax: 500000,
                    city: 'New York',
                    country: 'USA',
                    isAccredited: true,
                },
            };
            vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockInvestorUser);
            const result = await resolveProfileCompletion('user-inv-1', 'investor');
            // 20 + 15 + 20 + 20 + 15 + 10 = 100
            const totalPoints = result.steps.reduce((sum, s) => sum + s.points, 0);
            expect(totalPoints).toBe(100);
            expect(result.steps.length).toBe(6);
            expect(result.completionPercentage).toBe(100);
        });
    });
    describe('Finalization Behavior (Phase 7)', () => {
        it('rejects finalization when profile completion is under 100%', async () => {
            const mockIncomplete = {
                id: 'user-inc-1',
                role: 'freelancer',
                fullName: 'Incomplete User',
                country: null,
                city: null,
                freelancerProfile: {},
                freelancerExperiences: [],
                freelancerEducations: [],
            };
            vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockIncomplete);
            const finalizeRes = await finalizeProfileCompletionStatus('user-inc-1', 'freelancer');
            expect(finalizeRes.success).toBe(false);
            expect(finalizeRes.isFinalized).toBe(false);
            expect(finalizeRes.completionPercentage).toBeLessThan(100);
            expect(finalizeRes.message).toContain('Cannot finalize profile');
        });
        it('successfully finalizes when profile reaches 100% and updates DB', async () => {
            const mockFull = {
                id: 'user-full-1',
                role: 'client',
                avatarUrl: 'https://example.com/logo.jpg',
                coverImageUrl: 'https://example.com/cover.jpg',
                fullName: 'Full Client',
                email: 'full@client.com',
                phone: '+1234567890',
                country: 'USA',
                city: 'Seattle',
                bio: 'Full company description with mission and vision statements.',
                clientProfile: {
                    company: 'Acme Full Inc',
                    industry: 'Software',
                    companySize: '10-50',
                    city: 'Seattle',
                    country: 'USA',
                    websiteUrl: 'https://acmefull.com',
                    bio: 'Full company description with mission and vision statements.',
                    hiringGoal: 'Contract hires',
                    projectHireBudget: '$10k-$20k',
                },
            };
            vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFull);
            const updateSpy = vi.spyOn(prisma.user, 'update').mockResolvedValue(mockFull);
            const finalizeRes = await finalizeProfileCompletionStatus('user-full-1', 'client');
            expect(finalizeRes.success).toBe(true);
            expect(finalizeRes.isFinalized).toBe(true);
            expect(finalizeRes.completionPercentage).toBe(100);
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'user-full-1' },
                data: expect.objectContaining({
                    completionPercentage: 100,
                    onboardingStatus: 'COMPLETED',
                }),
            }));
        });
    });
});
