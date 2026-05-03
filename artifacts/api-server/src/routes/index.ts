import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import processesRouter from "./processes";
import candidatesRouter from "./candidates";
import interviewRouter from "./interview";
import evaluationRouter from "./evaluation";
import adminRouter from "./admin";
import settingsRouter from "./settings";
import managerRouter from "./manager";
import reportRouter from "./report";
import billingRouter from "./billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(processesRouter);
router.use(candidatesRouter);
router.use(interviewRouter);
router.use(evaluationRouter);
router.use(adminRouter);
router.use(settingsRouter);
router.use(managerRouter);
router.use(reportRouter);
router.use(billingRouter);

export default router;
