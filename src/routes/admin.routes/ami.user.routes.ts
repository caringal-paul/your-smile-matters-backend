import { Router, Request, Response, NextFunction } from "express";
import { UserModel, User } from "../../models/User";
import { RoleModel, Role } from "../../models/Role";
import mongoose, { Types } from "mongoose";
import { MetaData, TypedResponse } from "../../types/base.types";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
} from "../../middleware/authAmiMiddleware";
import { requirePermission } from "../../middleware/permissionMiddleware";
import { generateRandomPassword } from "../../utils/generateRandomValues";
import { hashPassword } from "../../utils/tokenHandler";
import { customError } from "../../middleware/errorHandler";
import { renderNewAccountEmail } from "../../utils/generateEmailTemplate";
import { sendEmail } from "../../utils/emailSender";

const router = Router();

type UserGetAllResponse = {
	_id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	mobile_number: string;
	role_id: string;
	role_and_permissions: {
		name: string;
		description?: string;
		permissions: string[];
	} | null;
};

type UserResponse = MetaData & {
	_id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	mobile_number: string;
	role_id: string;
	role_and_permissions: {
		name: string;
		description?: string;
		permissions: string[];
	} | null;
};

type UserCreateResponse = UserResponse & {
	temporary_password: string; // Include the temporary password in the response
};

// GET ALL /api/users
router.get(
	"/",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<UserGetAllResponse[]>,
		next: NextFunction
	) => {
		try {
			const users = await User.find()
				.populate({
					path: "role_id",
					select: "name description permissions",
				})
				.lean();

			const usersWithRoles: UserGetAllResponse[] = users.map(
				({ role_id, ...user }) => {
					// Check if role_id is populated (not just an ObjectId)
					const isPopulated =
						role_id &&
						typeof role_id === "object" &&
						!(role_id instanceof mongoose.Types.ObjectId) &&
						"name" in role_id;

					const roleDoc = isPopulated
						? (role_id as unknown as RoleModel)
						: null;

					return {
						_id: user._id.toString(),
						email: user.email,
						username: user.username,
						first_name: user.first_name,
						last_name: user.last_name,
						mobile_number: user.mobile_number,
						is_active: user.is_active,
						updated_at: user.updated_at,
						role_id: roleDoc?._id?.toString() ?? "",
						role_and_permissions: roleDoc
							? {
									name: roleDoc.name,
									description: roleDoc.description,
									permissions: roleDoc.permissions || [],
							  }
							: null,
					};
				}
			);

			res.status(200).json({
				status: 200,
				message: "Users fetched successfully!",
				data: usersWithRoles,
			});
		} catch (error) {
			console.error("Error fetching users:", error);
			next(error);
		}
	}
);

// GET /api/users/:id
router.get(
	"/:id",
	authenticateAmiUserToken,
	async (
		req: Request,
		res: TypedResponse<UserResponse>,
		next: NextFunction
	) => {
		try {
			// Validate ObjectId format

			if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
				throw customError(400, "Invalid user ID format");
			}

			const user = await User.findById(req.params.id)
				.populate({
					path: "role_id",
					select: "name description permissions",
				})
				.lean();

			if (!user) {
				throw customError(404, "User not found");
			}

			// Check if role_id is populated (not just an ObjectId)
			const isPopulated =
				user.role_id &&
				typeof user.role_id === "object" &&
				!(user.role_id instanceof mongoose.Types.ObjectId) &&
				"name" in user.role_id;

			const roleDoc = isPopulated
				? (user.role_id as unknown as RoleModel)
				: null;

			const { _id, ...userWithoutObjectId } = user;

			const userWithRole: UserResponse = {
				_id: _id.toString(),
				...userWithoutObjectId,
				role_id: String(roleDoc?._id) ?? String(user.role_id) ?? "",
				role_and_permissions: roleDoc
					? {
							name: roleDoc.name,
							description: roleDoc.description,
							permissions: roleDoc.permissions || [],
					  }
					: null,
			};

			res.status(200).json({
				status: 200,
				message: "User fetched successfully!",
				data: userWithRole,
			});
		} catch (error) {
			console.error("Error fetching user:", error);
			next(error);
		}
	}
);

// POST /api/users
router.post(
	"/",
	// authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<UserCreateResponse>,
		next: NextFunction
	) => {
		try {
			const { username, email, first_name, last_name, mobile_number, role_id } =
				req.body;

			// const userId = req.user?._id;
			// if (!userId)
			// 	throw customError(400, "No user id found. Please login again.");

			// ✅ Validate role_id
			if (!mongoose.Types.ObjectId.isValid(role_id)) {
				throw customError(400, "Invalid Role ID");
			}

			const roleDoc = await Role.findById(role_id);
			if (!roleDoc) throw customError(400, "Role does not exist");

			// ✅ Generate and hash password
			const generatedPassword = generateRandomPassword(12);
			const hashedPassword = await hashPassword(generatedPassword);

			// ✅ Create user
			const user = new User({
				username,
				password: hashedPassword,
				email,
				first_name,
				last_name,
				mobile_number,
				role_id,
				is_active: true,
				version: 0,
				// created_by: new Types.ObjectId(userId),
				// updated_by: new Types.ObjectId(userId),
				created_by: new Types.ObjectId(),
				updated_by: new Types.ObjectId(),
			});

			await user.save();

			// ✅ Populate role_id
			await user.populate({
				path: "role_id",
				select: "name description permissions",
			});

			// ✅ Map response
			const populatedUser = user as any;
			const rolePopulated =
				typeof user.role_id === "object" && "name" in user.role_id
					? (user.role_id as unknown as RoleModel)
					: null;

			const userResponse: UserCreateResponse = {
				_id: populatedUser._id.toString(),
				username: user.username,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				mobile_number: user.mobile_number,
				role_id: rolePopulated?._id?.toString() ?? "",
				role_and_permissions: rolePopulated
					? {
							name: rolePopulated.name,
							description: rolePopulated.description,
							permissions: rolePopulated.permissions || [],
					  }
					: null,
				created_at: user.created_at,
				updated_at: user.updated_at,
				temporary_password: generatedPassword,
			};

			// ✅ Send styled email
			try {
				const htmlContent = renderNewAccountEmail({
					role: rolePopulated?.name ?? "User",
					firstName: first_name,
					email,
					password: generatedPassword,
					loginUrl: "https://localhost.com/auth",
					companyName: "Your Smile Matters",
					supportEmail: "ysmphotographysupport@gmail.com",
				});

				await sendEmail({
					to: email,
					subject: `Your ${
						rolePopulated?.name ?? "User"
					} account has been created`,
					html: htmlContent,
				});
			} catch (emailErr) {
				throw customError(
					500,
					"Email not sent! Please contact your administrator."
				);
			}

			// ✅ Respond
			res.status(201).json({
				status: 201,
				message: "User created successfully!",
				data: userResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/users/:id
router.patch(
	"/:id",
	authenticateAmiUserToken,
	// requirePermission("user:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<UserResponse>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;
			const {
				username,
				email,
				first_name,
				last_name,
				mobile_number,
				role_id,
				is_active,
			} = req.body;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// ✅ Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid user ID format");
			}

			// ✅ Check role validity if role_id is provided
			if (role_id && !mongoose.Types.ObjectId.isValid(role_id)) {
				throw customError(400, "Invalid Role ID");
			}
			if (role_id) {
				const roleExists = await Role.findById(role_id);
				if (!roleExists) {
					throw customError(400, "Role does not exist");
				}
			}

			// ✅ Find and update user
			const user = await User.findById(id).populate({
				path: "role_id",
				select: "name description permissions",
			});

			if (!user) {
				throw customError(404, "User not found");
			}

			// ✅ Update only allowed fields
			if (username !== undefined) user.username = username;
			if (email !== undefined) user.email = email;
			if (first_name !== undefined) user.first_name = first_name;
			if (last_name !== undefined) user.last_name = last_name;
			if (mobile_number !== undefined) user.mobile_number = mobile_number;
			if (role_id !== undefined) user.role_id = role_id;
			if (is_active !== undefined) user.is_active = is_active;

			// Track audit info (if you use created_by/updated_by in your schema)
			user.updated_by = user.updated_by = new Types.ObjectId(userId);
			user.updated_at = new Date();

			await user.save();
			await user.populate({
				path: "role_id",
				select: "name description permissions",
			});

			const roleDoc =
				typeof user.role_id === "object" && "name" in user.role_id
					? (user.role_id as unknown as RoleModel)
					: null;

			const userResponse: UserResponse = {
				_id: user._id as string,
				username: user.username,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				mobile_number: user.mobile_number,
				role_id: roleDoc?._id?.toString() ?? user.role_id?.toString() ?? "",
				created_at: user.created_at,
				updated_at: user.updated_at,
				is_active: user.is_active,
				created_by: user.created_by,
				updated_by: user.updated_by,
				role_and_permissions: roleDoc
					? {
							name: roleDoc.name,
							description: roleDoc.description,
							permissions: roleDoc.permissions || [],
					  }
					: null,
			};

			res.status(200).json({
				status: 200,
				message: "User updated successfully!",
				data: userResponse,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/users/deactivate/:id
router.patch(
	"/deactivate/:id",
	authenticateAmiUserToken,
	// requirePermission("user:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// ✅ Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid user ID format");
			}

			// ✅ Find and update user
			const user = await User.findById(id).populate({
				path: "role_id",
				select: "name description permissions",
			});

			if (!user) {
				throw customError(404, "User not found");
			}

			// Track audit info (if you use created_by/updated_by in your schema)
			user.updated_by = user.updated_by = new Types.ObjectId(userId);
			user.deleted_by = user.deleted_by = new Types.ObjectId(userId);
			user.is_active = false;
			user.updated_at = new Date();
			user.deleted_at = new Date();

			await user.save();

			res.status(200).json({
				status: 200,
				message: "User deactivated successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

// PATCH /api/users/reactivate/:id
router.patch(
	"/reactivate/:id",
	authenticateAmiUserToken,
	// requirePermission("user:update"),
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { id } = req.params;

			const userId = req.user?._id;

			if (!userId) {
				throw customError(400, "No user id found. Please login again.");
			}

			// ✅ Validate ObjectId
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw customError(400, "Invalid user ID format");
			}

			// ✅ Find and update user
			const user = await User.findById(id).populate({
				path: "role_id",
				select: "name description permissions",
			});

			if (!user) {
				throw customError(404, "User not found");
			}

			user.updated_by = user.updated_by = new Types.ObjectId(userId);
			user.retrieved_by = user.retrieved_by = new Types.ObjectId(userId);
			user.is_active = true;
			user.updated_at = new Date();
			user.retrieved_at = new Date();

			await user.save();

			res.status(200).json({
				status: 200,
				message: "User re-activated successfully!",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
