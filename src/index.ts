import {Router} from 'express'
import {logPath, preValidateUser} from "chums-local-modules";
import Debug from "debug";
import {aboutAPI} from "./about/index.js";

const debug = Debug("chums:src:index");
const appRouter = Router();

appRouter.use(preValidateUser, logPath(debug));

appRouter.get('/about.json', aboutAPI);


export default appRouter;
