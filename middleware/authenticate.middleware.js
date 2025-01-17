const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/ApiError.js");
const { ApiResponse } = require("../utils/ApiResponse.js");

const verifyJWT = async (req, res, next) => {
  // Extract the token from the Authorization header
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(403).json(new ApiResponse(403, null, "Unauthorized request, JWT token is required"));
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>, so we split and take the token part

  if (!token) {
    return res.status(403).json(new ApiResponse(403, null, "Unauthorized request, JWT token is required"));
  }

  try {
    // Verify the token
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decodedToken; // Attach the decoded token to req.user

    next(); // Pass control to the next middleware or route handler
  } catch (err) {
    console.log("Invalid token", err.message);
    return res.status(401).json(new ApiResponse(401, null, "Invalid token"));
  }
};

module.exports = verifyJWT;
