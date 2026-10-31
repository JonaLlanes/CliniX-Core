import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/env.js';
import { authenticate, authorize, canListUsers, canManageUsers } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';

const router = Router();

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const payload = {
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    email: user.email,
  };
  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
  res.json({ token, user: payload });
});

router.post(
  '/register',
  async (req: Request, res: Response, next) => {
    if (config.isDev) return next();
    return authenticate(req, res, () => authorize(...canManageUsers)(req, res, next));
  },
  validateBody(registerSchema),
  async (req: Request, res: Response) => {
    const { email, password, displayName, role } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      role,
    });
    res.status(201).json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  }
);

router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

router.get('/users', authenticate, authorize(...canListUsers), async (_req: Request, res: Response) => {
  const data = await User.find().select('displayName email role').sort({ displayName: 1 });
  res.json({ data });
});

export default router;
