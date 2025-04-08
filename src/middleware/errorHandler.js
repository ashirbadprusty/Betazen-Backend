// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error(err.stack); // Log the error stack trace
  
    // Determine the status code
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
    res.status(statusCode).json({
      error: {
        message: err.message || 'Internal Server Error',
        details: err.details || null,
      },
    });
  };
  
  export default errorHandler;
  