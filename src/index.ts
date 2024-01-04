import express, { Application } from "express";
import transcodeRouter from "./routes/transcode.route";
import errorHandler from "./middlewares/error-handler.middleware";

const app: Application = express();
const PORT: number = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/api/transcode", transcodeRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
