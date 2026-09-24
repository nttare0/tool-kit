import { Router, type IRouter } from "express";
import healthRouter from "./health";
import toolsRouter from "./tools";
import categoriesRouter from "./categories";
import authRouter from "./auth";
import seoRouter from "./seo";
import accountRouter from "./account";
import adminManagementRouter from "./admin-management";
import aiSuggestionsRouter from "./ai-suggestions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(toolsRouter);
router.use(categoriesRouter);
router.use(authRouter);
router.use(seoRouter);
router.use(accountRouter);
router.use(adminManagementRouter);
router.use(aiSuggestionsRouter);

export default router;
