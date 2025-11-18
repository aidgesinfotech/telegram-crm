const Permissions = require('../models/permissionsModel');
const db = require('../config/db');

exports.createPermission = async (req, res) => {
    try {
        const result = await Permissions.create(req.body);
        res.status(201).json({ message: 'Permission created', id: result.insertId });
    } catch (err) {
        console.error('Error creating Permission:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllPermissions = async (req, res) => {
    try {
        const results = await Permissions.getAll();
        res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching Permission:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.getPermissionsByRole = async (req, res) => {
    const roleId = req.params.roleId;
    try {
        const results = await Permissions.getPermissionsByRole(roleId);
        res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching Permission:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.updatePermission = async (req, res) => {
    const id = req.params.id;
    try {
        await Permissions.update(id, req.body);
        res.status(200).json({ message: 'Permission updated' });
    } catch (err) {
        console.error('Error updating Permission:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deletePermission = async (req, res) => {
    const id = req.params.id;
    try {
        await Permissions.delete(id);
        res.status(200).json({ message: 'Permission deleted' });
    } catch (err) {
        console.error('Error deleting Permission:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updatePermissionByRole = async (req, res) => {
    const roleId = req.params.roleid;
    const data = req.body;

    try {
      if (!Array.isArray(data) || data.some(item => !item.pageid || (item.action == null || item.action == undefined))) {
        return res.status(400).json({ error: 'Invalid request body' });
      }
  
      const result = await Permissions.updateByRole(roleId, data);
      res.status(200).json(result);
    } catch (err) {
      console.error('Error updating or inserting permissions by role:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  