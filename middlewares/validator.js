import { body, validationResult ,check,param} from "express-validator";
import { ErrorHandling } from "../utils/ErrorHandling.js";


const validationHandler = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
  
    const errorMessages = errors.array().map((error) => error.msg);
    next(new ErrorHandling(errorMessages, 400));
  };


const registerValidator = () => [
  body("name", "Please enter your name").notEmpty(),
  body("bio", "Please enter bio").notEmpty(),
  body("username", "Please enter your username").notEmpty(),
  body("password", "Please enter your password").notEmpty(),
  check("avatar","Please upload avatar")
];

const loginValidator = () => [
   
    body("username", "Please enter your username").notEmpty(),
    body("password", "Please enter your password").notEmpty(),
  ];
  const newGroupValidator = () => [
   
    body("name", "Please enter your name").notEmpty(),
    body("members").notEmpty().withMessage("Please enter here members").isArray({min:3,max:100}).withMessage("Members must be within 3-100")
  ];
 

  const addMembersValidator = () => [
   
    body("chatId", "Please enter your chatId").notEmpty(),
    body("members").notEmpty().withMessage("Please enter here members").isArray({min:1,max:97}).withMessage("Members must be within 1-97")
  ];

  const removeMembersValidator = () => [
   
    body("chatId", "Please enter your chatId").notEmpty(),
    body("userId", "Please enter your userId").notEmpty(),
  ];
  const leaveMembersValidator = () => [
   param("id","Enter your ChatId").notEmpty()
    
  ];
  const attachmentsValidator = () => [
    body("chatId", "Please enter your chatId").notEmpty(),
     
   ];
   const renameValidator = () => [
    param("id","Enter your chatID").notEmpty(),body("name","Enter your name").notEmpty()
     
   ];
   const sendreqValidator=()=>[
    body("userId","Please enter  user Id").notEmpty()
   ];
   const acceptreqValidator = () => [
    body("requestId").notEmpty().withMessage("Enter request id"),
    body("accept").isBoolean().withMessage("Please add a valid boolean value for accept")
  ];
  const adminVerification=()=>[
    body("secretKey","Please enter secret  key to access").notEmpty()
  ]
  
export { registerValidator, validationHandler,adminVerification ,sendreqValidator,renameValidator,loginValidator,attachmentsValidator,leaveMembersValidator,newGroupValidator,addMembersValidator,acceptreqValidator,removeMembersValidator};
