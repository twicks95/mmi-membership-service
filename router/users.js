const express = require('express');
const router = express.Router();
const UserController = require('../controller/userController');

router.get("/user/:userID", UserController.getUserById)