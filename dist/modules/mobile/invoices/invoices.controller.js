import { prisma } from '../../../config/database.js';
import { successResponse } from '../../../core/response.js';
import { buildPublicFileUrl } from '../../../utils/public-url.js';
export const getInvoices = async (req, res, next) => {
    try {
        const invoices = await prisma.invoice.findMany({ where: { userId: req.user.id } });
        return res.json(successResponse('Invoices retrieved', invoices));
    }
    catch (error) {
        next(error);
    }
};
export const getInvoice = async (req, res, next) => {
    try {
        const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        return res.json(successResponse('Invoice retrieved', invoice));
    }
    catch (error) {
        next(error);
    }
};
import { generateInvoicePdf } from '../../../services/invoice/invoice.service.js';
export const downloadInvoice = async (req, res, next) => {
    try {
        const id = req.params.id;
        // Verify ownership
        const inv = await prisma.invoice.findUnique({ where: { id } });
        if (!inv)
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        if (inv.userId !== req.user.id)
            return res.status(403).json({ success: false, message: 'Forbidden' });
        const { publicPath } = await generateInvoicePdf(id);
        return res.json(successResponse('Invoice download link generated', { url: buildPublicFileUrl(publicPath, req) }));
    }
    catch (error) {
        next(error);
    }
};
