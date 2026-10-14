const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/routes/admin/admin-users.routes.ts');
let code = fs.readFileSync(filePath, 'utf8');

if (!code.includes('getVerificationStats')) {
  code = code.replace(
    'import { decryptPassword } from " ../../utils/crypto.util.js\;',
 'import { decryptPassword } from \../../utils/crypto.util.js\;\nimport { getVerificationStats } from \../../common/helpers/verification.js\;'
 );
}

const targetSearch = ' let verificationCenter: any = {';
if (code.includes(targetSearch)) {
 const replaceWith = \ let verificationStats: any = null;
 try {
 verificationStats = getVerificationStats(user);
 } catch (e) {
 console.error(\Error getting verificationStats:\, e);
 }

 let verificationCenter: any = {\;
 code = code.replace(targetSearch, replaceWith);
}

code = code.replace(
 'kyc: \PENDING\,',
 'kyc: verificationStats?.kycApproved ? \APPROVED\ : (verificationStats?.kycStatus || \PENDING\),'
);

code = code.replace(
 'documents: \PENDING\,',
 'documents: verificationStats?.kycApproved ? \APPROVED\ : \PENDING\,'
);

const oldKycBranches = \ if (vJson.kycApproved) {
 verificationCenter.kyc = \APPROVED\;
 verificationCenter.documents = \APPROVED\;
 } else if (vJson.kycSubmitted) {
 verificationCenter.kyc = \IN_REVIEW\;
 verificationCenter.documents = \SUBMITTED\;
 }\;

const newKycBranches = \ if (vJson.kycApproved) {
 verificationCenter.kyc = \APPROVED\;
 verificationCenter.documents = \APPROVED\;
 } else if (vJson.kycRejected) {
 verificationCenter.kyc = \REJECTED\;
 verificationCenter.documents = \REJECTED\;
 } else if (vJson.kycSubmitted) {
 verificationCenter.kyc = \IN_REVIEW\;
 verificationCenter.documents = \SUBMITTED\;
 }\;

if (code.includes(oldKycBranches)) {
 code = code.replace(oldKycBranches, newKycBranches);
}

if (!code.includes('verificationStats,')) {
 code = code.replace(
 'verificationCenter,',
 'verificationCenter,\n verificationStats,'
 );
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated admin-users.routes.ts');
