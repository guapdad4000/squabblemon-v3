import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playerRouter from "./player";
import collectionRouter from "./collection";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playerRouter);
router.use(collectionRouter);

export default router;
