var jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports.auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        let decoded;
        
        if (token) {
            decoded = jwt.verify(token, process.env.JWT_KEY);
        }
        let user = [];
        if (decoded) {
            if (decoded.type === 'Administrator User') {
                user = await db.execute(`SELECT * FROM users WHERE token = ?`, [token]);
            }
            // else {
            //     user = await db.execute(`SELECT * FROM players WHERE token = ?`, [token]);
            // }
        }

        if (user.length == 0) {
            return res.status(401).send({ status: 401, msg: "Unauthorized" });
        } else {
            req.userDetails = {data : user[0] , type : decoded.type};
            next();
        }
    } catch (e) {
        console.log(e);
        return res.status(401).send({ status: 401, msg: "Unauthorized" });
    }
};