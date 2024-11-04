import { MODE } from "../app.js";

const errorMiddleware = (err, req, res, next) => {
    console.error(err.stack); 
    if(err.code===11000){
      const error=Object.keys(err.keyPattern).join(",");
      err.message=`Duplicate feild -${error}`
      err.statusCode=400
    }// Log the error stack trace for debugging
  
    if(err.name==="CastError"){
      const path=err.path;
      err.message=`Invalide path ${path}`
      err.statusCode=400
      
    }
    res.status(err.status || 500).json({
      success: false,
      message: MODE==="DEVELOPMENT"?err :err.message|| 'Internal Server Error',

      
    });

  };
  
  export default errorMiddleware;
  

