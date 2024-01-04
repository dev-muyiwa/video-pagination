import { Router } from "express";
import fileUploader from "../middlewares/file-uploader.middleware";
import transcodeVideo from "../controllers/VideoController";

const transcodeRouter: Router = Router();

transcodeRouter.post("/new", fileUploader.single("file"), transcodeVideo);

export default transcodeRouter;
