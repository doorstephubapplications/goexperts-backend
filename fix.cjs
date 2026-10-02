const fs = require('fs');
let c = fs.readFileSync('src/controllers/investor/investor.controller.ts', 'utf8');

c = c.replace(/req\.user\?\.id \|\| req\.userId/g, 'req.user?.id || (req as any).userId');

fs.writeFileSync('src/controllers/investor/investor.controller.ts', c);
