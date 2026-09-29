import { Response, NextFunction } from 'express';
import { prisma } from '../../../config/database.js';
import { errorResponse, successResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middlewares/auth.js';

import { buildPublicFileUrl } from '../../../utils/public-url.js';
export const getInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoices = await prisma.invoice.findMany({ where: { userId: req.user.id } });
    return res.json(successResponse('Invoices retrieved', invoices));
  } catch (error) { next(error); }
};

export const getInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    return res.json(successResponse('Invoice retrieved', invoice));
  } catch (error) { next(error); }
};

import { generateInvoicePdf } from '../../../services/invoice/invoice.service.js';

export const downloadInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    // Verify ownership
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return res.status(404).json(errorResponse('Invoice not found', 'NOT_FOUND'));
    if (inv.userId !== req.user.id) return res.status(403).json(errorResponse('Forbidden', 'FORBIDDEN'));

    if (inv.pdfPath) {
      return res.json(successResponse('Invoice download link', {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        url: buildPublicFileUrl(inv.pdfPath, req),
        downloadAvailable: true,
      }));
    }

    try {
      const { publicPath } = await generateInvoicePdf(id) as any;
      return res.json(successResponse('Invoice download link generated', {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        url: buildPublicFileUrl(publicPath, req),
        downloadAvailable: true,
      }));
    } catch (error) {
      console.error('Failed to generate mobile invoice PDF:', error);
      return res.json(successResponse('Invoice PDF is not available yet', {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        url: null,
        downloadAvailable: false,
      }));
    }
  } catch (error) { next(error); }
};
