import { Router, type IRouter } from "express";
import healthRouter from "./health";
import emailRouter from "./email";
import extensionRouter from "./extension";
import aiRouter from "./ai";
import uploadRouter from "./upload";
import diditRouter from "./didit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(emailRouter);
router.use("/extension", extensionRouter);
router.use("/ai", aiRouter);
router.use("/upload", uploadRouter);
router.use("/didit", diditRouter);

export default router;
