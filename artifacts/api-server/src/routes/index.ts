import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playerRouter from "./player";
import collectionRouter from "./collection";
import storyRouter from "./story";
import shopRouter from "./shop";
import promoCodesRouter from './promoCodes';
import multiplayerRouter from './multiplayer';

const router: IRouter = Router();

router.use(healthRouter);
router.use(playerRouter);
router.use(collectionRouter);
router.use(storyRouter);
router.use(shopRouter);
router.use(promoCodesRouter);
router.use(multiplayerRouter);

export default router;
