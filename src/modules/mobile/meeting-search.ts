export type MeetingListWhereOptions = {
  userId: string;
  search?: string;
  matchedUserIds?: string[];
  includeCreatedBy?: boolean;
};

export const buildMeetingListWhere = ({
  userId,
  search,
  matchedUserIds = [],
  includeCreatedBy = false,
}: MeetingListWhereOptions) => {
  const normalizedSearch = search?.trim();
  const selfMatches: Array<{ founder: string } | { investor: string } | { createdBy: string }> = [
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

  const where: any = {
    deletedAt: null,
    OR: normalizedSearch
      ? [
          { title: { contains: normalizedSearch } },
          ...participantMatches,
          ...selfMatches,
        ]
      : [...selfMatches],
  };

  return where;
};
