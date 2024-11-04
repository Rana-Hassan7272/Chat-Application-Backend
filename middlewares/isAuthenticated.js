import jwt from 'jsonwebtoken';
import { HASSAN_TOKEN } from '../constants/events.js';
import { User } from '../models/user.js';
import { ErrorHandling } from '../utils/ErrorHandling.js';

const isAuthenticated = async (req, res, next) => {
    // Assuming the token is stored in cookies
    const token = req.cookies[HASSAN_TOKEN]; 
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        // Verifying the token using your secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRETKEY); 
        
        // Attaching the full decoded user info to the request object
        req.user = decoded.id || decoded._id; 
        
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
};



const adminVerify = async (req, res, next) => {
    const token = req.cookies[HASSAN_TOKEN]; // Retrieve token from cookies

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        // Decode the token using the JWT secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRETKEY);

        const adminSecretKey = process.env.ADMIN_SECRETKEY || "hehehe"; // Fallback admin key

        // Validate if the decoded token has the correct admin secret key
      //  if (decoded.secretKey !== adminSecretKey) {
        //    return res.status(401).json({ message: 'Unauthorized: Admin access only' });
        //}

        // Attach user ID from token to req.user for further use
        req.user = decoded.id || decoded._id;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
};



const socketAuthentication = async (socket, err,next) => {
    try {
      const authToken = socket.request.cookies[HASSAN_TOKEN]; // Ensure HASSAN_TOKEN is defined
      if (!authToken) return next(new ErrorHandling("Please login to access", 401));
  
      const decoded = jwt.verify(authToken, process.env.JWT_SECRETKEY);
      const user = await User.findById(decoded._id);
      if (!user) return next(new ErrorHandling("Please login to access", 401));
  
      socket.user = user;
      next(); // Proceed to the next middleware
    } catch (error) {
      console.error(error);
      return next(new ErrorHandling("Please login to access", 401));
    }
  };
  

export { isAuthenticated,adminVerify,socketAuthentication };
