import { Router, type IRouter } from "express";
import healthRouter from "./health";
import toolsRouter from "./tools";
import categoriesRouter from "./categories";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(toolsRouter);
router.use(categoriesRouter);
router.use(authRouter);

export default router;
