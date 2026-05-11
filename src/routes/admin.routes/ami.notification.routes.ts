import { Router, Request, Response } from "express";
import { Notification } from "../../models/Notification";

const router = Router();

// GET /api/notifications — paginated, newest first
router.get("/", async (req: Request, res: Response) => {
  try {
    const notifications = await Notification.find().lean();
    console.log("Notifications found:", notifications.length);
    console.log("Sample:", notifications[0]);

    res.json({
      status: 200,
      message: "Success",
      data: {
        notifications,
        total: notifications.length,
        unread_count: notifications.filter((n) => !n.is_read).length,
        page: 1,
        limit: 20,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});
// router.get("/", async (req: Request, res: Response) => {
//   try {
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 20;
//     const skip = (page - 1) * limit;
//     const unread_only = req.query.unread_only === "true";

//     const filter = unread_only ? { is_read: false } : {};

//     const [notifications, total, unread_count] = await Promise.all([
//       Notification.find(filter)
//         .sort({ created_at: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),
//       Notification.countDocuments(filter),
//       Notification.countDocuments({ is_read: false }),
//     ]);

//     res.json({ notifications, total, unread_count, page, limit });
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch notifications" });
//   }
// });

// PATCH /api/notifications/:id/read — mark one as read
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { is_read: true });
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update notification" });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch("/read-all", async (req: Request, res: Response) => {
  try {
    await Notification.updateMany({ is_read: false }, { is_read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update notifications" });
  }
});

export default router;
