import { Router } from "express";
import { authRouter } from "./auth.route";
import { accountRouter } from "./account.route";
import { onboardingRouter } from "./onboarding.route";
import { channelsRouter } from "./channels.route";
import { homeRouter } from "./home.route";
import { cardsRouter } from "./cards.route";
import { eventsRouter } from "./events.route";
import { billingRouter } from "./billing.route";

export const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use(accountRouter);
apiRouter.use(onboardingRouter);
apiRouter.use(channelsRouter);
apiRouter.use(homeRouter);
apiRouter.use(cardsRouter);
apiRouter.use(eventsRouter);
apiRouter.use(billingRouter);
