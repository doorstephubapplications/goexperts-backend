import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { globalSearch } from '../../../../services/mobile/search.service.js';

export const search = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { q, query, type, page, limit, city, category, industry, stage, sort, status } = req.query as Record<string, string>;
    const searchQuery = String(query || q || '').trim();

    if (searchQuery.length < 2) {
      return res.json(successResponse('Search results', []));
    }

    const results = await globalSearch(req.user?.id || null, {
      query: searchQuery, type, city, category, industry, stage, sort, status,
      page: parseInt(page || '1'),
      limit: parseInt(limit || '10')
    });

    const flattenedResults = Object.entries(results).flatMap(([group, items]) =>
      items.map((item) => ({
        ...item,
        type: group,
      })),
    );

    return res.json(successResponse('Search results', flattenedResults));
  } catch (error) { next(error); }
};

export const suggestions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { query } = req.query as Record<string, string>;
    const skills = await prisma.skill.findMany({
      where: query ? { name: { contains: query } } : undefined,
      take: 8,
      orderBy: { name: 'asc' }
    });

    return res.json(successResponse('Suggestions', {
      matching: skills.map((skill) => skill.name),
      recent: [],
      popular: skills.map((skill) => skill.name),
      trending: skills.map((skill) => skill.name)
    }));
  } catch (error) { next(error); }
};

export const getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Search history', []));
  } catch (error) { next(error); }
};

export const clearHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Search history cleared'));
  } catch (error) { next(error); }
};

export const deleteHistoryItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Search history item deleted'));
  } catch (error) { next(error); }
};
