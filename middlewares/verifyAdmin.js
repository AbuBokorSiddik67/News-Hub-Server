const verifyAdmin = (usersCollection) => async (req, res, next) => {
    if (!req.decoded || !req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden Access: Token not decoded or email missing' });
    }
    const email = req.decoded.email;
    const query = { email: email };
    const user = await usersCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    if (!isAdmin) {
        return res.status(403).send({ message: 'Forbidden Access: Not an Admin' });
    }
    next();
};

module.exports = verifyAdmin;