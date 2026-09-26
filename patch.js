import fs from 'fs';

let content = fs.readFileSync('src/routes/index.ts', 'utf8');

// Replace freelancers
content = content.replace(
  /const \{ rows, total, degraded \} = await listFreelancersCompat\(\{[\s\S]*?res\.json\(\{ success: true, rows: await sanitizeUserRowsAsync\(rows\), total, degraded \}\);/m,
  `let verificationStrict = filters.verificationStrict;
      delete filters.verificationStrict;

      const { rows: fetchedRows, total: fetchedTotal, degraded } = await listFreelancersCompat({
        page: verificationStrict ? 1 : page,
        pageSize: verificationStrict ? 100000 : pageSize,
        search,
        orderBy,
        ascending,
        filters,
        include: freelancerInclude,
      });

      let finalRows = fetchedRows;
      let finalTotal = fetchedTotal;

      if (verificationStrict) {
        finalRows = fetchedRows.filter(user => {
          const stats = getVerificationStats(user);
          const isVerified = stats.profileApproved && stats.kycApproved;
          return verificationStrict === "verified" ? isVerified : !isVerified;
        });
        finalTotal = finalRows.length;
        finalRows = finalRows.slice((page - 1) * pageSize, page * pageSize);
      }

      res.json({ success: true, rows: await sanitizeUserRowsAsync(finalRows), total: finalTotal, degraded });`
);

// Function for standard Prisma findMany routes
function patchPrismaFindMany(routeStr) {
    const regex = new RegExp(
        `const total = await prisma\\.user\\.count\\(\\{ where \\}\\);\\s*const rows = await prisma\\.user\\.findMany\\(\\{[\\s\\S]*?orderBy: \\{ \\\[orderBy\\\]: ascending \\? "asc" : "desc" \\},\\s*\\}\\);([\\s\\S]*?)res\\.json\\(\\{ success: true, rows: (.*?), total(.*?)\\}\\);`,
        'm'
    );
    
    return routeStr.replace(regex, (match, intermediateCode, rowsArg, totalArg) => {
        let includeArg = 'clientInclude';
        if (match.includes('investorInclude')) includeArg = 'investorInclude';
        if (match.includes('founderInclude')) includeArg = 'founderInclude';

        return `let verificationStrict = filters.verificationStrict;
      delete where.verificationStrict;

      let take = pageSize;
      let skip = (page - 1) * pageSize;
      
      if (verificationStrict) {
        take = 100000;
        skip = 0;
      }

      const total = await prisma.user.count({ where });
      const fetchedRows = await prisma.user.findMany({
        where,
        include: ${includeArg},
        skip,
        take,
        orderBy: { [orderBy]: ascending ? "asc" : "desc" },
      });

      let finalRows = fetchedRows;
      let finalTotal = total;

      if (verificationStrict) {
        finalRows = fetchedRows.filter((user: any) => {
          const stats = getVerificationStats(user);
          const isVerified = stats.profileApproved && stats.kycApproved;
          return verificationStrict === "verified" ? isVerified : !isVerified;
        });
        finalTotal = finalRows.length;
        finalRows = finalRows.slice((page - 1) * pageSize, page * pageSize);
      }

      const rows = finalRows;
${intermediateCode}
      res.json({ success: true, rows: ${rowsArg}, total: finalTotal${totalArg} });`;
    });
}

// Split into chunks by routes to avoid regex overlapping
let parts = content.split('adminClientsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {');
if(parts.length > 1) {
    parts[1] = patchPrismaFindMany(parts[1]);
    content = parts.join('adminClientsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {');
}

let parts2 = content.split('adminInvestorsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {');
if(parts2.length > 1) {
    parts2[1] = patchPrismaFindMany(parts2[1]);
    content = parts2.join('adminInvestorsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {');
}

let parts3 = content.split('adminFoundersRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {');
if(parts3.length > 1) {
    parts3[1] = patchPrismaFindMany(parts3[1]);
    content = parts3.join('adminFoundersRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {');
}

fs.writeFileSync('src/routes/index.ts', content);
console.log("Success");
