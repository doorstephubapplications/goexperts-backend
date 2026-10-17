import { prisma } from '../../config/database.js';
export class AboutStatsService {
    /**
     * Retrieves dynamically calculated statistics from the database.
     */
    async getDynamicStats() {
        const [registeredProfessionals, registeredBusinesses, investors, founders, projects,] = await Promise.all([
            this.getRegisteredProfessionals(),
            this.getBusinesses(),
            this.getInvestors(),
            this.getFounders(),
            this.getProjects(),
        ]);
        return [
            {
                key: 'professionals',
                label: 'Registered Professionals',
                value: registeredProfessionals,
                displayValue: this.formatDisplayValue(registeredProfessionals),
            },
            {
                key: 'businesses',
                label: 'Registered Businesses',
                value: registeredBusinesses,
                displayValue: this.formatDisplayValue(registeredBusinesses),
            },
            {
                key: 'investors',
                label: 'Active Investors',
                value: investors,
                displayValue: this.formatDisplayValue(investors),
            },
            {
                key: 'founders',
                label: 'Startup Founders',
                value: founders,
                displayValue: this.formatDisplayValue(founders),
            },
            {
                key: 'projects',
                label: 'Platform Projects',
                value: projects,
                displayValue: this.formatDisplayValue(projects),
            },
        ];
    }
    async getRegisteredProfessionals() {
        return prisma.user.count({
            where: { role: 'freelancer', status: 'active' },
        });
    }
    async getBusinesses() {
        return prisma.user.count({
            where: { role: 'client', status: 'active' },
        });
    }
    async getInvestors() {
        return prisma.user.count({
            where: { role: 'investor', status: 'active' },
        });
    }
    async getFounders() {
        return prisma.user.count({
            where: { role: 'founder', status: 'active' },
        });
    }
    async getProjects() {
        return prisma.project.count({
            where: { status: { not: 'closed' } }, // Adjust as per your active project status definition
        });
    }
    /**
     * Formats a raw number into a marketing-friendly format (e.g., 10284 -> 10K+)
     */
    formatDisplayValue(value) {
        if (value >= 1000000) {
            return `${Math.floor(value / 1000000)}M+`;
        }
        if (value >= 1000) {
            return `${Math.floor(value / 1000)}K+`;
        }
        return value.toString();
    }
}
