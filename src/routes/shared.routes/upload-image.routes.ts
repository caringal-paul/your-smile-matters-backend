import { Router, Request, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
	AuthenticatedRequest,
	authenticateAmiUserToken,
} from "../../middleware/authAmiMiddleware";
import { customError } from "../../middleware/errorHandler";
import { TypedResponse } from "../../types/base.types";
import { fileURLToPath } from "url";

const router = Router();

// ---------------------------
// TYPES
// ---------------------------
export type ImageUploadResponse = {
	filename: string;
	path: string;
	mimetype: string;
	size: number;
};

// ---------------------------
// MULTER CONFIGURATION
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../../uploads");

if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadsDir);
	},
	filename: (req, file, cb) => {
		// Create unique filename with timestamp
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, `${uniqueSuffix}${ext}`);
	},
});

// File filter for images only
const fileFilter = (
	req: Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback
) => {
	const allowedMimeTypes = [
		"image/jpeg",
		"image/png",
		"image/jpg",
		"image/gif",
		"image/webp",
	];

	if (allowedMimeTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
	}
};

// Initialize multer
const upload = multer({
	storage: storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
	fileFilter: fileFilter,
});

router.post(
	"/image",
	(req, res, next) => {
		upload.single("image")(req, res, (err) => {
			if (err) {
				return res.status(400).json({
					status: 400,
					message: err.message,
				});
			}
			next();
		});
	},
	async (
		req: Request,
		res: TypedResponse<ImageUploadResponse>,
		next: NextFunction
	) => {
		try {
			if (!req.file) {
				throw customError(400, "No image file uploaded");
			}

			let finalFilename = req.file.filename;
			let filePath = `/uploads/${finalFilename}`;

			const customPrefix = req.body.custom_filename
				? req.body.custom_filename
						.replace(/\s+/g, "_")
						.replace(/[^a-zA-Z0-9_-]/g, "")
				: null;

			// Apply custom filename prefix if provided
			if (customPrefix) {
				const ext = path.extname(req.file.originalname);
				const random = Math.round(Math.random() * 1e9);

				finalFilename = `${customPrefix}_${random}${ext}`;
				const newPath = path.join(uploadsDir, finalFilename);

				// Rename file
				fs.renameSync(req.file.path, newPath);

				filePath = `/uploads/${finalFilename}`;
			}

			const responseData: ImageUploadResponse = {
				filename: finalFilename,
				path: filePath,
				mimetype: req.file.mimetype,
				size: req.file.size,
			};

			res.status(200).json({
				status: 200,
				message: "Image uploaded successfully",
				data: responseData,
			});
		} catch (error) {
			// Delete temporary file if rename or logic fails
			if (req.file && req.file.path) {
				fs.unlink(req.file.path, () => {});
			}
			next(error);
		}
	}
);

router.post(
	"/images",
	(req, res, next) => {
		upload.array("images", 10)(req, res, (err) => {
			if (err) {
				return res.status(400).json({
					status: 400,
					message: err.message,
				});
			}
			next();
		});
	},
	async (
		req: Request,
		res: TypedResponse<ImageUploadResponse[]>,
		next: NextFunction
	) => {
		try {
			if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
				throw customError(400, "No image files uploaded");
			}

			const customPrefix = req.body.custom_filename
				? req.body.custom_filename
						.replace(/\s+/g, "_")
						.replace(/[^a-zA-Z0-9_-]/g, "")
				: null;

			const uploadedFiles: ImageUploadResponse[] = [];

			for (const file of req.files) {
				let finalFilename = file.filename;
				let filePath = `/uploads/${finalFilename}`;

				// Rename logic (applied to each file)
				if (customPrefix) {
					const ext = path.extname(file.originalname);
					const random = Math.round(Math.random() * 1e9);

					finalFilename = `${customPrefix}_${random}${ext}`;
					const newPath = path.join(uploadsDir, finalFilename);

					fs.renameSync(file.path, newPath);

					filePath = `/uploads/${finalFilename}`;
				}

				uploadedFiles.push({
					filename: finalFilename,
					path: filePath,
					mimetype: file.mimetype,
					size: file.size,
				});
			}

			res.status(200).json({
				status: 200,
				message: `${uploadedFiles.length} image(s) uploaded successfully`,
				data: uploadedFiles,
			});
		} catch (error) {
			// Delete temporarily saved files on failure
			if (req.files && Array.isArray(req.files)) {
				req.files.forEach((f) => {
					fs.unlink(f.path, () => {});
				});
			}
			next(error);
		}
	}
);

router.delete(
	"/delete/:filename",
	authenticateAmiUserToken,
	async (
		req: AuthenticatedRequest,
		res: TypedResponse<null>,
		next: NextFunction
	) => {
		try {
			const { filename } = req.params;

			if (!filename) {
				throw customError(400, "Filename is required");
			}

			const filePath = path.join(uploadsDir, filename);

			// Check if file exists
			if (!fs.existsSync(filePath)) {
				throw customError(404, "Image file not found");
			}

			// TODO: Delete from database first
			// Example:
			// await YourModel.deleteOne({ image_path: `/uploads/${filename}` });

			// Delete file from filesystem
			fs.unlinkSync(filePath);

			res.status(200).json({
				status: 200,
				message: "Image deleted successfully",
				data: null,
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
