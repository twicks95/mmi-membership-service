require('dotenv').config()
const express = require('express')
const app = express()
const http = require('http')
const cors = require('cors')
const bodyParser = require("body-parser")
const db = require('./config/db');
const { isBefore, isAfter } = require("date-fns")

// enable cors
app.use(cors({
    // origin: `${process.env.FE_HOST}`,
    origin: `*`,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
}))

// parsing body request
app.use(bodyParser.json())

// register
app.post("/api/auth/register", async (req, res) => {
    try {
        const { fullName, phoneNumber, idNumber, birthDate, email, password, confirmPassword } = req.body;
        const defaultMemberTypeId = 1 // silver tier
        const defaultMemberPoint = 0

        // check password and confirm password
        if (password !== confirmPassword) {
            return res.status(422).json({
                errors: [
                    {
                        value: '',
                        msg: "Confirm password doesn't match",
                        param: 'confirmPassword',
                        location: 'body'
                    }
                ]
            })
        }

        // check if email or phone namber already registered as member
        const emailRegistered = await db.query(`SELECT u.* FROM t2_user u WHERE u.email=$1`, [email])
        const phoneRegistered = await db.query(`SELECT u.* FROM t2_user u WHERE u.phone_number=$1`, [phoneNumber])
        if (emailRegistered.rowCount === 1) {
            return res.status(400).json({
                errors: [
                    {
                        value: email,
                        msg: "Email is already registered as member",
                        param: 'email',
                        location: 'body'
                    }
                ]
            })
        } else if (phoneRegistered.rowCount === 1) {
            return res.status(400).json({
                errors: [
                    {
                        value: phoneNumber,
                        msg: "Phone number is already registered as member",
                        param: 'phoneNumber',
                        location: 'body'
                    }
                ]
            })
        }

        // Insert user data into the database
        const result = await db.query(
            `INSERT INTO t2_user 
                (
                    phone_number, 
                    name, 
                    email, 
                    password, 
                    date_of_birth, 
                    gender, 
                    id_card, 
                    current_poin, 
                    membership_id
                ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING id`
            , [phoneNumber, fullName, email, password, birthDate, null, idNumber, defaultMemberPoint, defaultMemberTypeId]
        );

        // Assuming 'id' is the primary key of the users table
        const userId = result.rows[0].id;

        // Redirect URL to the dashboard with the user's ID
        const redirectURL = `${process.env.FE_HOST}/dashboard/${userId}`;

        // Respond with the redirect URL
        return res.status(201).json({ success: true, redirectURL });
    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(400).send(JSON.stringify({ status: 400, message: error.message }));
    }
})

// auth login
app.post("/api/auth/login", async (req, res) => {
    try {
        console.log({ body: req.body })
        const { memberId, password } = req.body

        // validate user is login either using email or phone number
        let useEmail = false
        let usePhoneNumber = false
        const isEmailOrPhoneNumber = async () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const phoneRegex = /^[0-9]{1,20}$/;
            if (emailRegex.test(memberId)) {
                useEmail = true
                usePhoneNumber = false
            } else if (phoneRegex.test(memberId)) {
                useEmail = false
                usePhoneNumber = true
            } else {
                useEmail = false
                usePhoneNumber = false

                throw new Error("Member Id is required")
            }
            return memberId
        }

        await isEmailOrPhoneNumber()
        let userData = {}
        if (useEmail) {
            console.log("Login with email")
            const isRegistered = await db.query(`SELECT * FROM t2_user WHERE email=$1`, [memberId])
            if (isRegistered.rowCount !== 1) {
                return res.status(404).json({
                    errors: [
                        {
                            value: memberId,
                            msg: "Email is not registered",
                            param: 'email',
                            location: 'body'
                        }
                    ]
                })
                // throw new Error("Unregistered user")
            }

            const result = await db.query(`SELECT * FROM t2_user WHERE email=$1 AND password=$2`, [memberId, password])
            if (!result.rows[0]) {
                return res.status(422).json({
                    errors: [
                        {
                            value: '',
                            msg: "Invalid credential",
                            param: 'password',
                            location: 'body'
                        }
                    ]
                })
                // throw new Error("Invalid credential")
            }
            userData = result.rows[0]
        } else {
            console.log("Login with phone")
            const isRegistered = await db.query(`SELECT * FROM t2_user WHERE phone_number=$1`, [memberId])
            if (isRegistered.rowCount !== 1) {
                return res.status(404).json({
                    errors: [
                        {
                            value: memberId,
                            msg: "Phone is not registered",
                            param: 'email',
                            location: 'body'
                        }
                    ]
                })
                // throw new Error("Unregistered user")
            }

            const result = await db.query(`SELECT * FROM t2_user WHERE phone_number=$1 AND password=$2`, [memberId, password]);
            if (!result.rows[0]) {
                return res.status(422).json({
                    errors: [
                        {
                            value: '',
                            msg: "Invalid credential",
                            param: 'password',
                            location: 'body'
                        }
                    ]
                })
                // throw new Error("Invalid credential")
            }
            userData = result.rows[0]
        }

        // res.setHeader('Location', `http://localhost:3000/dashboard/${userData.id}`)
        // res.status(302).send(); //302 indicates found and redirect to another url
        return res.status(200).json({ success: true, data: userData, redirectURL: `${process.env.FE_HOST}/dashboard/${userData.id}` });
    } catch (error) {
        return res.status(400).send(JSON.stringify({ status: 400, message: error.message }))
    }
})

// get user data and membership tier
app.get("/api/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params
        console.log("Get user data and membership tier with id" + userId)
        const result = await db.query(
            `SELECT 
                u.id as user_id,
                u.phone_number,
                u.name,
                u.email,
                u.membership_id,
                u.date_of_birth,
                u.gender,
                u.current_poin,
                u.is_deleted, 
                m.id as membership_type_id,
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
        throw new Error(error)
    }
})

app.post("/api/buy-vouchers/:userId", async (req,res) => {
    try {
        const {userId} = req.params
        const {voucher_price} = req.body

        const result = await db.query(`
        SELECT 
            current_poin
        FROM t2_user
        WHERE id = $1
        
        `,[userId]);
        
        let tempVoucher = result.rows[0].current_poin

        tempVoucher = tempVoucher - voucher_price

        // Update the current_poin in the t2_user table
        await db.query(`
            UPDATE t2_user
            SET current_poin = $1
            WHERE id = $2
        `, [tempVoucher, userId]);

         // Send a success response back to the client
         res.status(200).json({ message: "Voucher purchased successfully." });

    } catch (error) {
        throw new Error(error)
    }
})

// get user voucher
app.get("/api/my-vouchers/:userId", async (req, res) => {
    try {
        const { userId } = req.params
        const result = await db.query(`
        SELECT
            va.*,
            v.id as voucher_code,
            v.voucher_type_id,
            v.name,
            v.value,
            v.voucher_price,
            vt.*
        FROM t2_user u
        INNER JOIN t3_voucher_available va ON u.phone_number = va.phone_number 
        INNER JOIN t2_voucher v ON va.voucher_id = v.id
        INNER JOIN t1_voucher_type vt ON v.voucher_type_id = vt.id
        WHERE u.id = $1
        LIMIT 5
        `, [userId]);
        if (!result.rows.length > 0) {
            return res.status(404).json({
                errors: [
                    {
                        msg: "No vouchers available",
                    }
                ]
            })
        }

        const activeVouchers = function findActiveVouchers(vouchers) {
            const today = new Date(Date.now())
            return vouchers.filter(voucher => isAfter(new Date(voucher.expired_at), today));
        }

        const expiredVouchers = function findExpiredVouchers(vouchers) {
            const today = new Date(Date.now())
            return vouchers.filter(voucher => isBefore(new Date(voucher.expired_at), today));
        }

        const resultVouchersInGroup = (vouchers) => {
            const active = activeVouchers(vouchers)
            const expired = expiredVouchers(vouchers)
            return [{ status: "active", data: active }, { status: "expired", data: expired || [] }]
        }


        const userVouchers = resultVouchersInGroup(result.rows)
        return res.status(200).json({ success: true, data: userVouchers });
    } catch (error) {
        throw new Error(error)
    }
})

// get all vouchers
app.get("/api/vouchers", async (req, res) => {
    try {
        const { } = req.params
        const result = await db.query(`
        SELECT 
            v.*,
            vt.*
        FROM t2_voucher v
        INNER JOIN t1_voucher_type vt ON v.voucher_type_id = vt.id 
        LIMIT 20
        `);
        if (!result.rows.length > 0) {
            throw new Error("No vouchers available")
        }

        const vouchers = result.rows
        return res.status(200).json({ success: true, data: vouchers });
    } catch (error) {
        throw new Error(error)
    }
})

// get all transaction history
app.get("/api/transaction-history/:userId", async (req, res) => {
    try {
        const { userId } = req.params
        // const month = req.query.month
        // const year = req.query.year
        const result = await db.query(`
        SELECT 
            u.phone_number,
            u.name,
            u.current_poin,
            p.created_at AS transaction_date,
            pt.*,
            pd.*,
            st.*,
            ct.city_name,
            td.district_name,
            rt.*,
            v.name AS voucher_name,
            v.*,
            vt.*
        FROM t2_user u
        LEFT JOIN t3_purchase p ON u.phone_number = p.phone_number
        LEFT JOIN t3_poin_transaction pt ON p.phone_number = pt.phone_number
        LEFT JOIN t3_redeem_transaction rt ON pt.invoice_redeem = rt.invoice_redeem 
        LEFT JOIN t4_purchase_detail pd ON p.invoice_number = pd.invoice_number
        LEFT JOIN t2_voucher v ON rt.voucher_id = v.id
        LEFT JOIN t1_voucher_type vt ON v.voucher_type_id  = vt.id  
        LEFT JOIN t2_store st ON p.store_id = st.id
        LEFT JOIN t1_city ct ON st.store_city_id = ct.id
        LEFT JOIN t1_district td ON st.store_district_id = td.id
        WHERE u.id = $1
        LIMIT 20
        `, [userId])

        if (!result.rows.length > 0) {
            return res.status(404).json({
                errors: [
                    {
                        value: date,
                        msg: "No transaction history",
                        param: 'date',
                        location: 'body'
                    }
                ]
            })
            // throw new Error("No transaction history")
        }

        // function findFThisMonthTransaction(array, dateField) {
        //     return array.find(obj => new Date(obj[dateField]) > new Date());
        // }

        // const mapTransactionHistory = result.map((transaction) => {

        // })


        const userTransactions = result.rows
        console.log(userTransactions)
        return res.status(200).json({ success: true, data: userTransactions });
    } catch (error) {
        throw new Error(error)
    }
})

const server = http.createServer(app).listen(process.env.BE_PORT, async () => {
    console.log(`Service is successfully running on DNS/IP:port ${process.env.BE_HOST}:${process.env.BE_PORT}`)
})