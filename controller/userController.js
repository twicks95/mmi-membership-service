const db = require('../config/db');

class UserController {
    constructor() { }

    static async getUserById(req, res, next) {
        try {
            const { userId } = req.params
            const result = await db.query(
                `SELECT 
                    u.*, 
                    m.* 
                FROM t2_user u 
                JOIN t1_membership m ON u.membership_id = m.id
                WHERE u.id = $1`
                , [userId]
            );

            if (!result.rows[0]) {
                return res.status(404).json({
                    errors: [
                        {
                            value: userId,
                            msg: "User not found or unregistered",
                            param: 'userId',
                            location: 'params'
                        }
                    ]
                })
            }

            const userData = result.rows[0]
            return res.status(200).json({ success: true, data: userData });
        } catch (error) {
            next()
        }
    }
}

module.exports = UserController