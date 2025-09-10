import { Request, Response } from 'express';

export function authUserHandler(req: Request, res: Response) {
  // If authenticated, req.user should be set by middleware
  if (req.user) {
    // You can customize what user info to return
    const { id, email, firstName, lastName, role } = req.user as any;
    res.json({ id, email, firstName, lastName, role });
  } else {
    res.status(401).json(null);
  }
}
