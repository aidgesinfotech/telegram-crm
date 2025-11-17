const jwt = require("jsonwebtoken");
const axios = require('axios');
const Users = require('../models/usersModel');

exports.createUser = async (req, res) => {
    const ip = req.body.ip;
    try {
        if(ip){
            const IPData = await axios.get(`http://ip-api.com/json/${ip}`);
            const { lat, lon } = IPData.data;
            
            const result = await Users.create(lat, lon, req.body,req.userDetails);
            res.status(201).json({ message: 'User created', id: result.insertId });
        }else{
            res.status(400).json({ error: 'Ip Required for Creating any User' });
        }
    } catch (err) {
        console.error('Error creating User:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const results = await Users.getAll();
        res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching Users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllUsersByPage = async (req, res) => {
    try {
      const { limit = 10, page = 1, searchtxt = '' } = req.query;
      
      const results = await Users.getAllByPage(Number(limit), Number(page), searchtxt);
  
      res.status(200).json({
        status: 'success',
        data: results.data,
        totalCount: results.totalCount,
        totalPages: Math.ceil(results.totalCount / limit),
        currentPage: page
      });
    } catch (err) {
      console.error('Error fetching Users:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
exports.updateUser = async (req, res) => {
    const ip = req.body.ip;
    const id = req.params.id;
    try {
        if(ip){
            const IPData = await axios.get(`http://ip-api.com/json/${ip}`);
            const { lat, lon } = IPData.data;

            const results = await Users.update(lat, lon, id, req.body,req.userDetails);
            res.status(200).json(results);
        }else{
            res.status(400).json({ error: 'Ip Required for Updating any User' });
        }
    } catch (err) {
        console.error('Error updating User:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateUserStatus = async (req, res) => {
    const id = req.params.id;
    const { isActive } = req.body;
    try {
        await Users.updateUserStatus(id, isActive,req.userDetails);
        res.status(200).json({ message: 'User Status updated' });
    } catch (err) {
        console.error('Error updating User Status:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteUser = async (req, res) => {
    const id = req.params.id;
    try {
        await Users.delete(id,req.userDetails);
        res.status(200).json({ message: 'User deleted' });
    } catch (err) {
        console.error('Error deleting User:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.loginUser = async (req, res) => {
    const ip = req.body.ip;
    try {
        if(ip){
            const IPData = await axios.get(`http://ip-api.com/json/${ip}`);
            const { lat, lon } = IPData.data;
            
            const { email, password } = req.body;

            const user = await Users.findByEmail(lat, lon ,email , ip); 
            if (!user || !user.data) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            if (password !== user.data.password) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            const isActive = await Users.getUserStatus(user.data.id);
            if(!isActive){
                return res.status(403).json({ error: 'User is Inactive' });
            }

            let token;
            if(user.data){
                token = jwt.sign({id : user.data.id, type : 'Administrator User'}, process.env.JWT_KEY);
                await Users.updateUserToken(user.data.id, token);
            }
            res.status(200).json({
                message: 'Login successful',
                user: user.data,
                token: token
            });
        }else{
            res.status(400).json({ error: 'Ip Required for Login to User' });
        }

    } catch (err) {
        console.error('Error logging in user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};