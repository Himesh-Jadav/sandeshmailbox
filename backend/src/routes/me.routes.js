import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { formatUserResponse } from '../utils/user.js';
import User from '../models/User.js';

const router = Router();

import {
  uploadAvatarToGridFS,
  downloadAvatarFromGridFS,
  deleteAvatarFromGridFS,
} from '../utils/gridfs.js';

// Multer memory storage for user avatar uploads directly into MongoDB GridFS
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF, SVG) are allowed'));
    }
  },
});

const updateMeSchema = z.object({
  name: z.string().trim().max(100).optional(),
  displayName: z.string().trim().max(100).optional(),
  dob: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say', '', null]).nullable().optional(),
  profilePictureUrl: z.string().nullable().optional(),
  publicKey: z.string().nullable().optional(),
});

/**
 * GET /api/me/avatar/stream/:identifier
 * Public/Protected streaming of avatar directly from MongoDB GridFS
 */
router.get('/avatar/stream/:identifier', async (req, res, next) => {
  try {
    const { stream, fileInfo } = await downloadAvatarFromGridFS(req.params.identifier);
    res.setHeader('Content-Type', fileInfo.contentType || 'image/jpeg');
    res.setHeader('Content-Length', fileInfo.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  } catch (err) {
    res.status(404).json({ error: 'Avatar not found' });
  }
});

/**
 * GET /api/me
 * Protected route — requires valid session JWT (Bearer token).
 * Returns { user }
 */
router.get('/', requireAuth, (req, res) => {
  res.json({ user: formatUserResponse(req.user) });
});

/**
 * POST /api/me/avatar
 * Uploads an avatar image directly into MongoDB GridFS database
 */
router.post('/avatar', requireAuth, uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const safeName = `avatar-${req.user._id}-${Date.now()}${ext}`;

    // Remove previous avatar from GridFS if one exists
    if (user.profilePictureGridFsId) {
      await deleteAvatarFromGridFS(user.profilePictureGridFsId);
    }

    // Store avatar directly in MongoDB GridFS
    const gridFsId = await uploadAvatarToGridFS(
      safeName,
      req.file.buffer,
      req.file.mimetype || 'image/jpeg'
    );

    const avatarUrl = `/api/uploads/avatars/${safeName}`;
    user.profilePictureGridFsId = gridFsId;
    user.profilePictureUrl = avatarUrl;
    await user.save();

    res.json({
      user: formatUserResponse(user),
      profilePictureUrl: avatarUrl,
      gridFsId: gridFsId.toString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/me
 * Updates user profile (name, displayName, dob, gender, profilePictureUrl, publicKey)
 */
router.patch('/', requireAuth, async (req, res, next) => {
  try {
    const data = updateMeSchema.parse(req.body);
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (data.name !== undefined) user.displayName = data.name;
    if (data.displayName !== undefined) user.displayName = data.displayName;
    if (data.dob !== undefined) user.dob = data.dob;
    if (data.gender !== undefined) user.gender = data.gender;
    if (data.profilePictureUrl !== undefined) user.profilePictureUrl = data.profilePictureUrl;
    if (data.publicKey !== undefined) user.publicKey = data.publicKey;

    await user.save();
    res.json({ user: formatUserResponse(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
