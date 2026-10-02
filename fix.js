const fs = require('fs');
let content = fs.readFileSync('src/controllers/investor/investor.controller.ts', 'utf8');

content = content.replace(/const \{ requireUser \} = await import\('\.\.\/\.\.\/middlewares\/auth\.middleware\.js'\);\s*const userId = requireUser\(req, res\);\s*if \(!userId\) return;/g, 
`    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });`);

content = content.replace(/role: body\.role \|\| "Member"\s*\}/g, 
`role: body.role || "Member",
          permissions: "[]"
        }`);

content = content.replace(/const \{ renderEmailTemplate, sendEmail \} = await import\("\.\.\/\.\.\/services\/mobile\/email\.service\.js"\);/g, 
`const { sendEmail } = await import("../../services/mobile/email.service.js");
        const { renderEmailTemplate } = await import("../../services/settings/settings.service.js");`);

fs.writeFileSync('src/controllers/investor/investor.controller.ts', content);
