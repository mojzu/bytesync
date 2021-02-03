import express from "express";
import {API} from "./api";
import cors from "cors";

export const app = express();
const router = express.Router();

const indexRouter = router.get('/', async (req, res) => {
    res.json(await API.handleRequest({type: "request.size"}));
});

const apiRouter = router.post('/', async (req, res) => {
    res.json(await API.handleRequest(req.body));
});

app.use(express.json());
app.use(cors());

app.use('/', indexRouter);
app.use('/api', apiRouter);
