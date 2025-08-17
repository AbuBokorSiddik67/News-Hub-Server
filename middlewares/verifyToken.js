const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized Access: No Authorization header' });
    }
    const token = req.headers.authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(401).send({ message: 'Unauthorized Access: Invalid Token' });
        }
        req.decoded = decoded; // Attach decoded payload (e.g., user email) to request
        next();
    });
};

module.exports = verifyToken;