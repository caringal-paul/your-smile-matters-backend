import { Router } from "express";
import { Role } from "../../models/Role";

const router = Router();

// GET all roles
router.get("/", async (req, res, next) => {
	try {
		const roles = await Role.find();

		const parsedRoles = roles.map((role) => {
			return {
				_id: role._id,
				name: role.name,
				description: role.description,
				permissions: role.permissions,
				is_active: role.is_active,
			};
		});

		res.json({ status: "Success", data: parsedRoles });
	} catch (error) {
		next(error);
	}
});

// GET role by ID
router.get("/:id", async (req, res, next) => {
	try {
		const role = await Role.findById(req.params.id);
		if (!role)
			return res
				.status(404)
				.json({ status: "Error", message: "Role not found" });
		res.json({ status: "Success", data: role });
	} catch (error) {
		next(error);
	}
});

// CREATE role
router.post("/", async (req, res, next) => {
	try {
		const role = new Role(req.body);
		await role.save();
		res.status(201).json({ status: "Success", data: role });
	} catch (error) {
		next(error);
	}
});

// UPDATE role
router.put("/:id", async (req, res, next) => {
	try {
		const role = await Role.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
		});
		if (!role)
			return res
				.status(404)
				.json({ status: "Error", message: "Role not found" });
		res.json({ status: "Success", data: role });
	} catch (error) {
		next(error);
	}
});

// DELETE role
router.delete("/:id", async (req, res, next) => {
	try {
		const role = await Role.findByIdAndDelete(req.params.id);
		if (!role)
			return res
				.status(404)
				.json({ status: "Error", message: "Role not found" });
		res.json({ status: "Success", message: "Role deleted" });
	} catch (error) {
		next(error);
	}
});

export default router;
