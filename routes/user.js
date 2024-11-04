import express from "express";
import { login ,newUser,getProfile,logOut, searchUser, sendRequest, getMyNotifications, acceptRequest, myFriends} from "../controllers/user.js";
import { singleFile } from "../middlewares/multer.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { acceptreqValidator, loginValidator, registerValidator, sendreqValidator, validationHandler } from "../middlewares/validator.js";
const app=express.Router();


app.post("/new",singleFile,registerValidator(),validationHandler,newUser)
app.post("/login",loginValidator(),validationHandler,login)
app.use(isAuthenticated)
app.get("/profile",getProfile)
app.get("/logout",logOut)
app.get("/search",searchUser)
app.put("/sendrequest",sendreqValidator(),validationHandler,sendRequest)
app.get("/getnotify",getMyNotifications)
app.put("/acceptrequest",acceptreqValidator(),validationHandler,acceptRequest)
app.get("/getfriends",myFriends)


export default app