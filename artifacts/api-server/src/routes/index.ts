import { Router, type IRouter } from "express";
import healthRouter from "./health";
import emailRouter from "./email";
import extensionRouter from "./extension";

const router: IRouter = Router();

router.use(healthRouter);
router.use(emailRouter);
router.use("/extension", extensionRouter);

export default router;
