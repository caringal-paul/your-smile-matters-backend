import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./authMiddleware";

export const requirePermission = (permission: string) => {
	return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({
				status: "Error",
				message: "Authentication required",
			});
		}

		const userPermissions = req.user.role_and_permissions?.permissions || [];

		if (!userPermissions.includes(permission)) {
			return res.status(403).json({
				status: "Error",
				message: `Permission denied. Required: ${permission}`,
			});
		}

		next();
	};
};
