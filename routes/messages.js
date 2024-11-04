import express from "express";

import { files } from "../middlewares/multer.js";
import { sendAttachments } from "../controllers/chat.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { attachmentsValidator, validationHandler } from "../middlewares/validator.js";

//const app=express.Router();
//app.use(isAuthenticated)

//app.post("/attachments",files,attachmentsValidator(),validationHandler,sendAttachments)

//export default app