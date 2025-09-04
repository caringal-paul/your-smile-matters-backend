import { Router } from "express";
import { Permission } from "../../models/Permission";

const router = Router();

// GET all permissions
router.get("/", async (req, res, next) => {
	try {
		const permissions = await Permission.find();
		res.json({ status: "Success", data: permissions });
	} catch (error) {
		next(error);
	}
});

// CREATE permission
router.post("/", async (req, res, next) => {
	try {
		const permission = new Permission(req.body);
		await permission.save();
		res.status(201).json({ status: "Success", data: permission });
	} catch (error) {
		next(error);
	}
});

export default router;
