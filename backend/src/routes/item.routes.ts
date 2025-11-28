import { Router, type Request, type Response } from "express";
import Item from "../models/Item.model";

const  router = Router();

// Create
router.post("/", async (req: Request, res: Response) => {
  try {
    const item = await Item.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

// Read all
router.get("/", async (_req: Request, res: Response) => {
  const items = await Item.find();
  res.json(items);
});

// Read one
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

// Update
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

// Delete
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

export default router;
