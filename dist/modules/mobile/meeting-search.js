export const buildMeetingListWhere = ({ userId, search, matchedUserIds = [], includeCreatedBy = false, }) => {
    const normalizedSearch = search?.trim();
    const selfMatches = [
        { founder: userId },
        { investor: userId },
    ];
    if (includeCreatedBy) {
        selfMatches.push({ createdBy: userId });
    }
    const participantMatches = matchedUserIds.length
        ? [
            { founder: { in: matchedUserIds } },
            { investor: { in: matchedUserIds } },
        ]
        : [];
    const where = {
        deletedAt: null,
        OR: selfMatches,
    };
    if (normalizedSearch) {
        where.AND = [
            {
                OR: [
                    { title: { contains: normalizedSearch } },
                    ...(participantMatches.length ? participantMatches : []),
                ],
            },
        ];
    }
    return where;
};
