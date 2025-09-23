import 'dotenv/config';
import Debug from 'debug';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import http from 'node:http';
import appRouter from "./src/index.js";
import {notFoundHandler} from "./src/error-handler.js";

const debug = Debug('chums:api');

const app = express();
app.set('trust proxy', 'loopback');
app.use(helmet());
app.set('json spaces', 2);
app.set('view engine', 'pug');
app.use(cookieParser(process.env.COOKIE_SECRET ?? undefined));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(appRouter)
app.use('*', notFoundHandler);

const {PORT, NODE_ENV} = process.env;
const server = http.createServer(app);
server.listen(PORT);
debug(`server started on port: ${PORT}; mode: ${NODE_ENV}`);

